import { FastifyInstance } from 'fastify'
import { eq, and, gte, lte, ilike, desc, asc, count } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../lib/db'
import { products, users } from '@cripex/db'
import { uploadImage, uploadProductMetadata } from '../services/ipfs.service'
import { assertCanOperate } from '../services/reputation.service'
import type { ProductCategory, ProductCondition } from '@cripex/shared'

export async function productRoutes(app: FastifyInstance) {
  // GET /products — listado con filtros
  app.get('/', async (request, reply) => {
    const querySchema = z.object({
      category: z.enum(['electronics', 'clothing', 'home', 'services', 'other']).optional(),
      condition: z.enum(['new', 'used', 'refurbished']).optional(),
      search: z.string().optional(),
      minPrice: z.coerce.number().optional(),
      maxPrice: z.coerce.number().optional(),
      orderBy: z.enum(['price_asc', 'price_desc', 'newest', 'views']).default('newest'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    })

    const parsed = querySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Parámetros inválidos', details: parsed.error.issues })
    }

    const { category, condition, search, minPrice, maxPrice, orderBy, page, limit } = parsed.data

    const conditions = [eq(products.isActive, true)]

    if (category) conditions.push(eq(products.category, category))
    if (condition) conditions.push(eq(products.condition, condition))
    if (search) conditions.push(ilike(products.title, `%${search}%`))
    if (minPrice !== undefined) conditions.push(gte(products.priceUsdt, String(minPrice)))
    if (maxPrice !== undefined) conditions.push(lte(products.priceUsdt, String(maxPrice)))

    const orderClause = {
      price_asc: asc(products.priceUsdt),
      price_desc: desc(products.priceUsdt),
      newest: desc(products.createdAt),
      views: desc(products.viewsCount),
    }[orderBy]

    const [items, totalResult] = await Promise.all([
      db.query.products.findMany({
        where: and(...conditions),
        orderBy: [orderClause],
        limit,
        offset: (page - 1) * limit,
        with: { seller: { columns: { id: true, username: true, walletAddress: true, reputationScore: true } } },
      }),
      db.select({ count: count() }).from(products).where(and(...conditions)),
    ])

    const total = Number(totalResult[0]?.count ?? 0)

    return reply.send({
      data: items,
      total,
      page,
      limit,
      hasMore: page * limit < total,
    })
  })

  // GET /products/:id — detalle de producto
  app.get('/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const product = await db.query.products.findFirst({
      where: eq(products.id, id),
      with: { seller: true },
    })

    if (!product) return reply.status(404).send({ error: 'Producto no encontrado' })

    // Incrementar views de forma asíncrona
    db.update(products)
      .set({ viewsCount: product.viewsCount + 1 })
      .where(eq(products.id, id))
      .execute()
      .catch(() => {})

    return reply.send(product)
  })

  // POST /products — crear publicación
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      title: z.string().min(5).max(150),
      description: z.string().min(20).max(5000),
      priceUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/),
      category: z.enum(['electronics', 'clothing', 'home', 'services', 'other']),
      condition: z.enum(['new', 'used', 'refurbished']),
      stock: z.number().int().min(1).max(999).default(1),
      imagesIpfs: z.array(z.string()).min(0).max(10).default([]),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const { userId } = request.user

    const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
    if (!user) return reply.status(404).send({ error: 'Usuario no encontrado' })

    try { await assertCanOperate(userId) } catch (e: any) {
      return reply.status(403).send({ error: e.message })
    }

    const [product] = await db.insert(products).values({
      sellerId: userId,
      title: parsed.data.title,
      description: parsed.data.description,
      priceUsdt: parsed.data.priceUsdt,
      category: parsed.data.category as ProductCategory,
      condition: parsed.data.condition as ProductCondition,
      stock: parsed.data.stock,
      imagesIpfs: parsed.data.imagesIpfs,
    }).returning()

    return reply.status(201).send(product)
  })

  // PUT /products/:id — editar publicación (solo el vendedor)
  app.put('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const product = await db.query.products.findFirst({ where: eq(products.id, id) })
    if (!product) return reply.status(404).send({ error: 'Producto no encontrado' })
    if (product.sellerId !== userId) return reply.status(403).send({ error: 'Sin permisos' })

    const schema = z.object({
      title: z.string().min(5).max(150).optional(),
      description: z.string().min(20).max(5000).optional(),
      priceUsdt: z.string().regex(/^\d+(\.\d{1,6})?$/).optional(),
      stock: z.number().int().min(0).optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const [updated] = await db.update(products)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(products.id, id))
      .returning()

    return reply.send(updated)
  })

  // DELETE /products/:id — soft delete
  app.delete('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const product = await db.query.products.findFirst({ where: eq(products.id, id) })
    if (!product) return reply.status(404).send({ error: 'Producto no encontrado' })
    if (product.sellerId !== userId) return reply.status(403).send({ error: 'Sin permisos' })

    await db.update(products)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(products.id, id))

    return reply.send({ ok: true })
  })

  // POST /products/:id/images — upload imagen a IPFS
  app.post('/:id/images', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const product = await db.query.products.findFirst({ where: eq(products.id, id) })
    if (!product) return reply.status(404).send({ error: 'Producto no encontrado' })
    if (product.sellerId !== userId) return reply.status(403).send({ error: 'Sin permisos' })

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'No se recibió archivo' })

    const buffer = await data.toBuffer()
    const cid = await uploadImage(buffer, data.filename)

    const newImages = [...(product.imagesIpfs || []), cid]
    await db.update(products)
      .set({ imagesIpfs: newImages, updatedAt: new Date() })
      .where(eq(products.id, id))

    return reply.send({ cid, url: `https://gateway.pinata.cloud/ipfs/${cid}` })
  })
}

import { FastifyInstance } from 'fastify'
import { eq, ilike, and } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../lib/db'
import { users, products, reviews, userAddresses } from '@shopix/db'

const addressSchema = z.object({
  label: z.string().min(1).max(30).default('Casa'),
  name: z.string().min(2).max(100),
  street: z.string().min(3).max(150),
  city: z.string().min(2).max(80),
  province: z.string().min(2).max(80),
  zip: z.string().min(3).max(10),
  phone: z.string().max(20).optional(),
  isDefault: z.boolean().default(false),
})

export async function userRoutes(app: FastifyInstance) {
  // GET /users/:address — perfil público por wallet address
  app.get('/:address', async (request, reply) => {
    const { address } = request.params as { address: string }

    const user = await db.query.users.findFirst({
      where: ilike(users.walletAddress, address.toLowerCase()),
      with: {
        products: {
          where: eq(products.isActive, true),
          orderBy: (p, { desc }) => [desc(p.createdAt)],
          limit: 20,
        },
        reviewsReceived: {
          with: { reviewer: { columns: { id: true, username: true, walletAddress: true } } },
          orderBy: (r, { desc }) => [desc(r.createdAt)],
          limit: 20,
        },
      },
    })

    if (!user) return reply.status(404).send({ error: 'Usuario no encontrado' })

    // No exponer datos sensibles en el perfil público
    const { ...publicUser } = user
    return reply.send(publicUser)
  })

  // PUT /users/me — actualizar perfil propio
  app.put('/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      username: z.string().min(3).max(30).regex(/^[a-zA-Z0-9_]+$/).optional(),
      avatarIpfs: z.string().optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const { userId } = request.user

    if (parsed.data.username) {
      const existing = await db.query.users.findFirst({
        where: ilike(users.username, parsed.data.username),
      })
      if (existing && existing.id !== userId) {
        return reply.status(400).send({ error: 'Nombre de usuario ya existe' })
      }
    }

    const [updated] = await db.update(users)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning()

    return reply.send(updated)
  })

  // ── Mis Direcciones ──────────────────────────────────────────────

  // GET /users/me/addresses
  app.get('/me/addresses', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user
    const addrs = await db.query.userAddresses.findMany({
      where: eq(userAddresses.userId, userId),
      orderBy: (a, { desc }) => [desc(a.isDefault), desc(a.createdAt)],
    })
    return reply.send(addrs)
  })

  // POST /users/me/addresses
  app.post('/me/addresses', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const parsed = addressSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }
    const { userId } = request.user

    // Si se marca como default, quitar default a las demás
    if (parsed.data.isDefault) {
      await db.update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(userAddresses.userId, userId))
    }

    // Si es la primera dirección, que sea default automáticamente
    const existing = await db.query.userAddresses.findMany({
      where: eq(userAddresses.userId, userId),
    })

    const [addr] = await db.insert(userAddresses).values({
      userId,
      ...parsed.data,
      isDefault: parsed.data.isDefault || existing.length === 0,
    }).returning()

    return reply.status(201).send(addr)
  })

  // PUT /users/me/addresses/:id
  app.put('/me/addresses/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const addr = await db.query.userAddresses.findFirst({
      where: and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)),
    })
    if (!addr) return reply.status(404).send({ error: 'Dirección no encontrada' })

    const parsed = addressSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    if (parsed.data.isDefault) {
      await db.update(userAddresses)
        .set({ isDefault: false, updatedAt: new Date() })
        .where(eq(userAddresses.userId, userId))
    }

    const [updated] = await db.update(userAddresses)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(userAddresses.id, id))
      .returning()

    return reply.send(updated)
  })

  // PATCH /users/me/addresses/:id/default
  app.patch('/me/addresses/:id/default', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const addr = await db.query.userAddresses.findFirst({
      where: and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)),
    })
    if (!addr) return reply.status(404).send({ error: 'Dirección no encontrada' })

    // Quitar default a todas
    await db.update(userAddresses)
      .set({ isDefault: false, updatedAt: new Date() })
      .where(eq(userAddresses.userId, userId))

    // Poner default a la elegida
    const [updated] = await db.update(userAddresses)
      .set({ isDefault: true, updatedAt: new Date() })
      .where(eq(userAddresses.id, id))
      .returning()

    return reply.send(updated)
  })

  // DELETE /users/me/addresses/:id
  app.delete('/me/addresses/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const addr = await db.query.userAddresses.findFirst({
      where: and(eq(userAddresses.id, id), eq(userAddresses.userId, userId)),
    })
    if (!addr) return reply.status(404).send({ error: 'Dirección no encontrada' })

    await db.delete(userAddresses).where(eq(userAddresses.id, id))

    // Si era la default y hay más, poner la más reciente como default
    if (addr.isDefault) {
      const remaining = await db.query.userAddresses.findMany({
        where: eq(userAddresses.userId, userId),
        orderBy: (a, { desc }) => [desc(a.createdAt)],
        limit: 1,
      })
      if (remaining.length > 0) {
        await db.update(userAddresses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(eq(userAddresses.id, remaining[0].id))
      }
    }

    return reply.status(204).send()
  })
}

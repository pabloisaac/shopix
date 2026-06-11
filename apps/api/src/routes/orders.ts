import { FastifyInstance } from 'fastify'
import { eq, and } from 'drizzle-orm'
import { z } from 'zod'
import { randomBytes, randomUUID } from 'crypto'
import { db } from '../lib/db'
import { orders, orderEvents, orderMessages, products, users } from '@shopix/db'
import { getTrackingStatus } from '../services/tracking.service'
import { assertCanOperate } from '../services/reputation.service'
import { generarDireccionDeposito } from '../services/deposit.service'
import type { TrackingCarrier, ShippingAddress } from '@shopix/shared'

const SHIPPING_DEADLINE_HOURS = 48
const SHIPPING_WARNING_HOURS = 6 // warn if < 6h remain

const MESSAGE_LABELS: Record<string, { label: string; role: 'buyer' | 'seller' }> = {
  buyer_asking_shipping_date: { label: '¿Cuándo enviás el producto?', role: 'buyer' },
  buyer_asking_status: { label: '¿Hay novedades sobre mi pedido?', role: 'buyer' },
  buyer_asking_delay: { label: 'Pasaron varios días, ¿está todo bien?', role: 'buyer' },
  buyer_received_damaged: { label: 'El producto llegó con daños', role: 'buyer' },
  seller_shipped: { label: 'El producto ya fue enviado', role: 'seller' },
  seller_shipping_delayed: { label: 'Hubo una demora, envío pronto', role: 'seller' },
  seller_problem_stock: { label: 'Tuve un inconveniente con el stock', role: 'seller' },
  seller_pickup_ready: { label: 'El producto está listo para retiro', role: 'seller' },
  seller_shipped_late_warning: { label: 'Enviado cerca del límite de tiempo — seguí el tracking', role: 'seller' },
}

export async function orderRoutes(app: FastifyInstance) {

  // POST /orders/checkout — nuevo flujo híbrido sin wallet (cualquier exchange)
  app.post('/checkout', async (request, reply) => {
    const schema = z.object({
      productId:       z.string().uuid(),
      refundAddress:   z.string().regex(/^0x[0-9a-fA-F]{40}$/, 'Dirección USDT inválida'),
      buyerEmail:      z.string().email().optional(),
      shippingAddress: z.object({
        name:     z.string().min(1),
        street:   z.string().min(1),
        city:     z.string().min(1),
        province: z.string().min(1),
        zip:      z.string().min(1),
        phone:    z.string().optional(),
      }),
      timeoutDays: z.number().int().min(1).max(30).default(7),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const { productId, refundAddress, buyerEmail, shippingAddress, timeoutDays } = parsed.data

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      with: { seller: true },
    })
    if (!product || !product.isActive) {
      return reply.status(404).send({ error: 'Producto no encontrado o inactivo' })
    }
    if (product.stock < 1) {
      return reply.status(400).send({ error: 'Producto sin stock' })
    }

    // Verificar que el vendedor tiene dirección de cobro configurada
    const sellerPayoutAddress = (product.seller as any).payoutAddress || product.seller.walletAddress
    if (!sellerPayoutAddress || sellerPayoutAddress === '0x0') {
      return reply.status(400).send({ error: 'El vendedor no tiene dirección de cobro configurada' })
    }

    // Generar dirección de depósito única para esta orden
    const { address: depositAddress, encryptedKey } = generarDireccionDeposito()
    const orderId       = randomUUID()
    const confirmToken  = randomBytes(32).toString('hex')
    const timeoutAt     = new Date(Date.now() + timeoutDays * 24 * 60 * 60 * 1000)

    // Buscar o crear usuario anónimo para el comprador
    let buyerUser = await db.query.users.findFirst({
      where: eq(users.walletAddress, refundAddress.toLowerCase()),
    })
    if (!buyerUser) {
      const [newUser] = await db.insert(users).values({
        walletAddress: refundAddress.toLowerCase(),
        username: null,
      }).returning()
      buyerUser = newUser
    }

    const [order] = await db.insert(orders).values({
      id:                  orderId,
      productId,
      buyerId:             buyerUser.id,
      sellerId:            product.sellerId,
      amountUsdt:          product.priceUsdt,
      contractOrderId:     orderId,
      status:              'awaiting_payment',
      shippingAddress:     shippingAddress as ShippingAddress,
      timeoutAt,
      depositAddress,
      depositEncryptedKey: encryptedKey,
      sellerPayoutAddress,
      buyerRefundAddress:  refundAddress,
      buyerEmail:          buyerEmail || null,
      confirmationToken:   confirmToken,
    }).returning()

    await db.insert(orderEvents).values({
      orderId: order.id,
      eventType: 'created',
      actorAddress: refundAddress,
      metadata: { productId, amountUsdt: product.priceUsdt, depositAddress },
    })

    return reply.status(201).send({
      orderId:        order.id,
      depositAddress,
      amountUsdt:     product.priceUsdt,
      timeoutAt:      timeoutAt.toISOString(),
    })
  })

  // GET /orders/:id/status — estado público de la orden (para polling del comprador)
  app.get('/:id/status', async (request, reply) => {
    const { id } = request.params as { id: string }
    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      columns: { id: true, status: true, depositAddress: true, amountUsdt: true },
    })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    return reply.send({ status: order.status, amountUsdt: order.amountUsdt })
  })

  // POST /orders/:id/confirm — confirmar recepción por token (sin wallet)
  app.post('/:id/confirm', async (request, reply) => {
    const { id } = request.params as { id: string }
    const schema = z.object({ token: z.string() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Token requerido' })

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.confirmationToken !== parsed.data.token) {
      return reply.status(403).send({ error: 'Token inválido' })
    }
    if (order.status !== 'active') {
      return reply.status(400).send({ error: `La orden no está activa (estado: ${order.status})` })
    }

    // El operador ejecuta confirmarRecepcion() en el contrato
    // Por ahora actualizamos el estado en DB — el job lo procesa on-chain
    await db.update(orders)
      .set({ status: 'completed', updatedAt: new Date() })
      .where(eq(orders.id, id))

    await db.insert(orderEvents).values({
      orderId: id,
      eventType: 'delivered',
      actorAddress: order.buyerRefundAddress || '',
      metadata: { confirmedByToken: true },
    })

    return reply.send({ ok: true, message: 'Recepción confirmada. Fondos liberados al vendedor.' })
  })

  // POST /orders — crear orden (flujo legacy con wallet — mantenido para compatibilidad)
  app.post('/', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const schema = z.object({
      productId: z.string().uuid(),
      shippingAddress: z.object({
        name: z.string(),
        street: z.string(),
        city: z.string(),
        province: z.string(),
        zip: z.string(),
        phone: z.string().optional(),
      }),
      timeoutDays: z.number().int().min(1).max(30).default(7),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const { userId } = request.user
    const { productId, shippingAddress, timeoutDays } = parsed.data

    try { await assertCanOperate(userId) } catch (e: any) {
      return reply.status(403).send({ error: e.message })
    }

    const product = await db.query.products.findFirst({
      where: eq(products.id, productId),
      with: { seller: true },
    })
    if (!product || !product.isActive) {
      return reply.status(404).send({ error: 'Producto no encontrado o inactivo' })
    }
    if (product.sellerId === userId) {
      return reply.status(400).send({ error: 'No podés comprarte tu propio producto' })
    }
    if (product.stock < 1) {
      return reply.status(400).send({ error: 'Producto sin stock' })
    }

    const orderId   = `0x${randomBytes(32).toString('hex')}` as `0x${string}`
    const timeoutAt = new Date(Date.now() + timeoutDays * 24 * 60 * 60 * 1000)

    const [order] = await db.insert(orders).values({
      id: randomUUID(),
      productId,
      buyerId:         userId,
      sellerId:        product.sellerId,
      amountUsdt:      product.priceUsdt,
      contractOrderId: orderId,
      status:          'pending_payment',
      shippingAddress: shippingAddress as ShippingAddress,
      timeoutAt,
    }).returning()

    await db.insert(orderEvents).values({
      orderId: order.id,
      eventType: 'created',
      actorAddress: (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || '',
      metadata: { productId, amountUsdt: product.priceUsdt },
    })

    return reply.status(201).send({
      order,
      contractParams: {
        orderId,
        vendedor: product.seller.walletAddress,
        monto:    product.priceUsdt,
        timeoutDias: timeoutDays,
      },
    })
  })

  // GET /orders/:id — detalle de orden
  app.get('/:id', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { product: true, buyer: true, seller: true, events: true, dispute: true },
    })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })

    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }

    return reply.send(order)
  })

  // GET /orders/my/buying — órdenes como comprador
  app.get('/my/buying', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user

    const myOrders = await db.query.orders.findMany({
      where: eq(orders.buyerId, userId),
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      with: { product: { columns: { id: true, title: true, imagesIpfs: true } }, seller: { columns: { id: true, username: true, walletAddress: true } } },
    })

    return reply.send(myOrders)
  })

  // GET /orders/my/selling — órdenes como vendedor
  app.get('/my/selling', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user

    const myOrders = await db.query.orders.findMany({
      where: eq(orders.sellerId, userId),
      orderBy: (o, { desc }) => [desc(o.createdAt)],
      with: { product: { columns: { id: true, title: true, imagesIpfs: true } }, buyer: { columns: { id: true, username: true, walletAddress: true } } },
    })

    return reply.send(myOrders)
  })

  // POST /orders/:id/tracking — vendedor carga número de tracking
  app.post('/:id/tracking', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const schema = z.object({
      trackingNumber: z.string().min(5).max(50),
      carrier: z.enum(['andreani', 'oca', 'correo_argentino', 'pickup']),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos' })
    }

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.sellerId !== userId) return reply.status(403).send({ error: 'Solo el vendedor' })
    if (order.status !== 'active') return reply.status(400).send({ error: 'Orden no activa' })

    const now = Date.now()
    const deadlineMs = order.shippingDeadlineAt ? new Date(order.shippingDeadlineAt).getTime() : Infinity
    const remainingMs = deadlineMs - now
    const remainingHours = remainingMs / (1000 * 60 * 60)

    // Si ya expiró el deadline, rechazar y auto-cancelar
    if (remainingMs <= 0) {
      await db.update(orders).set({ status: 'refunded', updatedAt: new Date() }).where(eq(orders.id, id))
      const actorAddress = (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || ''
      await db.insert(orderEvents).values({
        orderId: id, eventType: 'auto_cancelled', actorAddress,
        metadata: { reason: 'shipping_deadline_expired' },
      })
      return reply.status(400).send({
        error: 'El plazo de envío expiró. La orden fue cancelada y el dinero reembolsado al comprador.',
        code: 'SHIPPING_DEADLINE_EXPIRED',
      })
    }

    const actorAddress = (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || ''
    const isLate = remainingHours < SHIPPING_WARNING_HOURS
    const eventType = isLate ? 'shipping_deadline_warning' : 'shipped'

    await db.update(orders)
      .set({ trackingNumber: parsed.data.trackingNumber, trackingCarrier: parsed.data.carrier as TrackingCarrier, updatedAt: new Date() })
      .where(eq(orders.id, id))

    await db.insert(orderEvents).values({
      orderId: id, eventType: 'shipped', actorAddress,
      metadata: { trackingNumber: parsed.data.trackingNumber, carrier: parsed.data.carrier, lateShipping: isLate },
    })

    if (isLate) {
      // Agregar mensaje estructurado automático al hilo
      const sellerUser = await db.query.users.findFirst({ where: eq(users.id, userId) })
      if (sellerUser) {
        await db.insert(orderMessages).values({
          orderId: id, senderId: userId, messageType: 'seller_shipped_late_warning',
        })
      }
    }

    return reply.send({
      ok: true,
      warning: isLate ? `Atención: enviaste con menos de ${SHIPPING_WARNING_HOURS}h antes del límite. Si la orden se cancela automáticamente podrías perder el producto. Guardá el comprobante de envío como evidencia.` : null,
    })
  })

  // POST /orders/:id/cancel — cancelar orden pending_payment expirada
  app.post('/:id/cancel', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }
    const cancellableStatuses = ['pending_payment', 'active']
    if (!cancellableStatuses.includes(order.status)) {
      return reply.status(400).send({ error: 'No se puede cancelar una orden en este estado' })
    }

    if (order.status === 'pending_payment') {
      const expiresAt = new Date(order.createdAt).getTime() + 10 * 60 * 1000
      if (Date.now() < expiresAt && order.sellerId !== userId) {
        return reply.status(400).send({ error: 'La orden aún no expiró' })
      }
    }

    if (order.status === 'active') {
      // Solo el vendedor o auto-cancel (comprador no puede cancelar una activa)
      const shippingExpired = order.shippingDeadlineAt && Date.now() > new Date(order.shippingDeadlineAt).getTime()
      if (!shippingExpired && order.sellerId !== userId) {
        return reply.status(403).send({ error: 'El plazo de envío aún no expiró' })
      }
    }

    await db.update(orders)
      .set({ status: 'refunded', updatedAt: new Date() })
      .where(eq(orders.id, id))

    await db.insert(orderEvents).values({
      orderId: id,
      eventType: 'refunded',
      actorAddress: (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || '',
      metadata: { reason: 'payment_timeout' },
    })

    return reply.send({ ok: true })
  })

  // POST /orders/:id/activate — transacción blockchain confirmada, fondos en escrow
  app.post('/:id/activate', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const schema = z.object({ txHash: z.string() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'txHash requerido' })

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId) return reply.status(403).send({ error: 'Solo el comprador' })

    const shippingDeadlineAt = new Date(Date.now() + SHIPPING_DEADLINE_HOURS * 60 * 60 * 1000)
    await db.update(orders)
      .set({ status: 'active', txHashCreate: parsed.data.txHash, shippingDeadlineAt, updatedAt: new Date() })
      .where(eq(orders.id, id))

    await db.insert(orderEvents).values({
      orderId: id,
      eventType: 'payment_confirmed',
      actorAddress: (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || '',
      metadata: { txHash: parsed.data.txHash },
      txHash: parsed.data.txHash,
    })

    return reply.send({ ok: true })
  })

  // POST /orders/:id/confirm — comprador confirma recepción
  app.post('/:id/confirm', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const schema = z.object({ txHash: z.string() })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'txHash requerido' })

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId) return reply.status(403).send({ error: 'Solo el comprador' })

    await db.update(orders)
      .set({ status: 'completed', txHashComplete: parsed.data.txHash, updatedAt: new Date() })
      .where(eq(orders.id, id))

    await db.insert(orderEvents).values({
      orderId: id,
      eventType: 'completed',
      actorAddress: (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || '',
      metadata: { txHash: parsed.data.txHash },
      txHash: parsed.data.txHash,
    })

    return reply.send({ ok: true })
  })

  // GET /orders/:id/messages — hilo de mensajes estructurados
  app.get('/:id/messages', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }

    const msgs = await db.query.orderMessages.findMany({
      where: eq(orderMessages.orderId, id),
      with: { sender: { columns: { id: true, username: true, walletAddress: true } } },
      orderBy: (m, { asc }) => [asc(m.createdAt)],
    })

    return reply.send(msgs.map(m => ({
      ...m,
      label: MESSAGE_LABELS[m.messageType]?.label || m.messageType,
    })))
  })

  // POST /orders/:id/messages — enviar mensaje estructurado
  app.post('/:id/messages', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const schema = z.object({
      messageType: z.string().min(1),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'messageType requerido' })

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }
    if (order.status === 'pending_payment' || order.status === 'refunded') {
      return reply.status(400).send({ error: 'El chat solo está disponible en órdenes activas o en disputa' })
    }

    const msgConfig = MESSAGE_LABELS[parsed.data.messageType]
    if (!msgConfig) {
      return reply.status(400).send({ error: 'Tipo de mensaje no válido' })
    }

    // Validar que el rol coincida
    const isBuyer = order.buyerId === userId
    if (isBuyer && msgConfig.role !== 'buyer') {
      return reply.status(403).send({ error: 'Ese mensaje es solo para el vendedor' })
    }
    if (!isBuyer && msgConfig.role !== 'seller') {
      return reply.status(403).send({ error: 'Ese mensaje es solo para el comprador' })
    }

    const [msg] = await db.insert(orderMessages).values({
      orderId: id,
      senderId: userId,
      messageType: parsed.data.messageType as any,
    }).returning()

    return reply.status(201).send({ ...msg, label: msgConfig.label })
  })

  // POST /orders/:id/return-tracking — comprador carga tracking de devolución
  app.post('/:id/return-tracking', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const schema = z.object({
      trackingNumber: z.string().min(5).max(50),
      carrier: z.enum(['andreani', 'oca', 'correo_argentino', 'pickup']),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos' })

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId) return reply.status(403).send({ error: 'Solo el comprador' })
    if (order.status !== 'return_required') {
      return reply.status(400).send({ error: 'La orden no requiere devolución' })
    }

    // Verificar que no expiró el plazo
    if (order.returnDeadlineAt && Date.now() > new Date(order.returnDeadlineAt).getTime()) {
      return reply.status(400).send({ error: 'El plazo de devolución expiró' })
    }

    const actorAddress = (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || ''

    await db.update(orders).set({
      status: 'return_in_transit',
      returnTrackingNumber: parsed.data.trackingNumber,
      returnCarrier: parsed.data.carrier as any,
      updatedAt: new Date(),
    }).where(eq(orders.id, id))

    await db.insert(orderEvents).values({
      orderId: id,
      eventType: 'return_tracking_uploaded',
      actorAddress,
      metadata: { trackingNumber: parsed.data.trackingNumber, carrier: parsed.data.carrier },
    })

    return reply.send({ ok: true })
  })

  // POST /orders/:id/confirm-return — vendedor confirma recepción de la devolución
  app.post('/:id/confirm-return', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.sellerId !== userId) return reply.status(403).send({ error: 'Solo el vendedor' })
    if (order.status !== 'return_in_transit') {
      return reply.status(400).send({ error: 'El comprador aún no cargó el tracking de devolución' })
    }

    const actorAddress = (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || ''

    await db.update(orders).set({ status: 'refunded', updatedAt: new Date() }).where(eq(orders.id, id))
    await db.insert(orderEvents).values({
      orderId: id, eventType: 'return_received', actorAddress,
      metadata: { confirmedBy: 'seller' },
    })

    return reply.send({ ok: true })
  })

  // POST /orders/:id/return-deadline-missed — sistema detecta que expiró el plazo de devolución
  app.post('/:id/return-deadline-missed', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({
      where: eq(orders.id, id),
      with: { buyer: true },
    })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    // Solo el vendedor o el propio comprador pueden reportar el incumplimiento
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }
    if (order.status !== 'return_required') {
      return reply.status(400).send({ error: 'Estado incorrecto' })
    }
    if (!order.returnDeadlineAt || Date.now() < new Date(order.returnDeadlineAt).getTime()) {
      return reply.status(400).send({ error: 'El plazo aún no expiró' })
    }

    const actorAddress = (await db.query.users.findFirst({ where: eq(users.id, userId) }))?.walletAddress || ''

    await db.update(orders).set({ status: 'refunded_no_return', updatedAt: new Date() }).where(eq(orders.id, id))
    await db.insert(orderEvents).values({
      orderId: id, eventType: 'return_deadline_missed', actorAddress,
      metadata: { buyerId: order.buyerId },
    })

    // Afectar reputación del comprador por no devolver
    const { recordDisputeLost } = await import('../services/reputation.service')
    await recordDisputeLost(order.buyerId)

    return reply.send({ ok: true, message: 'Plazo de devolución vencido — reputación del comprador afectada' })
  })

  // GET /orders/:id/tracking-status — estado actual del envío
  app.get('/:id/tracking-status', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const { userId } = request.user

    const order = await db.query.orders.findFirst({ where: eq(orders.id, id) })
    if (!order) return reply.status(404).send({ error: 'Orden no encontrada' })
    if (order.buyerId !== userId && order.sellerId !== userId) {
      return reply.status(403).send({ error: 'Sin permisos' })
    }

    if (!order.trackingNumber || !order.trackingCarrier) {
      return reply.send({ status: 'pending', message: 'El vendedor aún no cargó el tracking' })
    }

    const status = await getTrackingStatus(order.trackingCarrier as TrackingCarrier, order.trackingNumber)
    return reply.send(status)
  })
}

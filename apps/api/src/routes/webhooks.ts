import { FastifyInstance } from 'fastify'
import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { orders, orderEvents, disputes } from '@shopix/db'
import { notifyUser } from '../services/notification.service'

// Eventos que puede emitir el contrato
type BlockchainEvent =
  | { type: 'OrdenCreada'; orderId: string; comprador: string; vendedor: string; monto: string; timeoutEn: string; txHash: string }
  | { type: 'RecepcionConfirmada'; orderId: string; txHash: string }
  | { type: 'AutoReleaseEjecutado'; orderId: string; txHash: string }
  | { type: 'DisputaEnviadaAKleros'; orderId: string; klerosId: string; txHash: string }
  | { type: 'FondosLiberados'; orderId: string; destinatario: string; monto: string; txHash: string }
  | { type: 'Reembolsado'; orderId: string; comprador: string; monto: string; txHash: string }

export async function webhookRoutes(app: FastifyInstance) {
  // POST /webhooks/blockchain — recibir eventos del contrato (The Graph / indexer propio)
  app.post('/blockchain', async (request, reply) => {
    // En producción validar una firma/secreto del webhook
    const event = request.body as BlockchainEvent

    try {
      await handleBlockchainEvent(event)
      return reply.send({ ok: true })
    } catch (err) {
      app.log.error({ err, event }, 'Error procesando evento blockchain')
      return reply.status(500).send({ error: 'Error interno' })
    }
  })
}

async function handleBlockchainEvent(event: BlockchainEvent) {
  switch (event.type) {
    case 'OrdenCreada': {
      // Marcar la orden como activa en la DB
      await db.update(orders)
        .set({ status: 'active', txHashCreate: event.txHash, updatedAt: new Date() })
        .where(eq(orders.contractOrderId, event.orderId))

      const order = await db.query.orders.findFirst({
        where: eq(orders.contractOrderId, event.orderId),
      })
      if (order) {
        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: 'payment_confirmed',
          actorAddress: event.comprador,
          metadata: { txHash: event.txHash, monto: event.monto },
          txHash: event.txHash,
        })
        notifyUser(order.sellerId, 'nueva_orden', { orderId: order.id, monto: event.monto })
      }
      break
    }

    case 'RecepcionConfirmada': {
      const order = await db.query.orders.findFirst({
        where: eq(orders.contractOrderId, event.orderId),
      })
      if (order) {
        await db.update(orders)
          .set({ status: 'completed', txHashComplete: event.txHash, updatedAt: new Date() })
          .where(eq(orders.id, order.id))
        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: 'completed',
          actorAddress: '',
          txHash: event.txHash,
          metadata: {},
        })
        notifyUser(order.sellerId, 'fondos_liberados', { orderId: order.id })
      }
      break
    }

    case 'AutoReleaseEjecutado': {
      const order = await db.query.orders.findFirst({
        where: eq(orders.contractOrderId, event.orderId),
      })
      if (order) {
        await db.update(orders)
          .set({ status: 'completed', txHashComplete: event.txHash, updatedAt: new Date() })
          .where(eq(orders.id, order.id))
        notifyUser(order.sellerId, 'auto_release', { orderId: order.id })
      }
      break
    }

    case 'DisputaEnviadaAKleros': {
      const order = await db.query.orders.findFirst({
        where: eq(orders.contractOrderId, event.orderId),
      })
      if (order) {
        await db.update(orders)
          .set({ status: 'disputed', klerosCaseId: parseInt(event.klerosId), updatedAt: new Date() })
          .where(eq(orders.id, order.id))

        await db.update(disputes)
          .set({ klerosDisputeId: parseInt(event.klerosId), status: 'evidence', updatedAt: new Date() })
          .where(eq(disputes.orderId, order.id))

        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: 'dispute_opened',
          actorAddress: '',
          txHash: event.txHash,
          metadata: { klerosId: event.klerosId },
        })
        notifyUser(order.sellerId, 'disputa_abierta', { orderId: order.id, klerosId: event.klerosId })
      }
      break
    }

    case 'Reembolsado': {
      const order = await db.query.orders.findFirst({
        where: eq(orders.contractOrderId, event.orderId),
      })
      if (order) {
        await db.update(orders)
          .set({ status: 'refunded', updatedAt: new Date() })
          .where(eq(orders.id, order.id))

        await db.update(disputes)
          .set({ ruling: 1, status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() })
          .where(eq(disputes.orderId, order.id))

        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: 'refunded',
          actorAddress: '',
          txHash: event.txHash,
          metadata: { monto: event.monto },
        })
        notifyUser(order.buyerId, 'reembolso', { orderId: order.id, monto: event.monto })
      }
      break
    }

    case 'FondosLiberados': {
      const order = await db.query.orders.findFirst({
        where: eq(orders.contractOrderId, event.orderId),
      })
      if (order && order.status === 'disputed') {
        await db.update(disputes)
          .set({ ruling: 2, status: 'resolved', resolvedAt: new Date(), updatedAt: new Date() })
          .where(eq(disputes.orderId, order.id))
        notifyUser(order.sellerId, 'disputa_resuelta_vendedor', { orderId: order.id })
      }
      break
    }
  }
}

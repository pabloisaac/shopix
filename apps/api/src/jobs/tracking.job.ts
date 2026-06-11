import { Queue, Worker } from 'bullmq'
import { eq, and, isNotNull } from 'drizzle-orm'
import { db } from '../lib/db'
import { orders, orderEvents } from '@shopix/db'
import { getTrackingStatus } from '../services/tracking.service'
import { notifyUser } from '../services/notification.service'
import { redis } from '../lib/redis'
import type { TrackingCarrier } from '@shopix/shared'

const QUEUE_NAME = 'tracking'

export const trackingQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

export const trackingWorker = new Worker(
  QUEUE_NAME,
  async () => {
    // Órdenes activas con número de tracking
    const activeOrders = await db.query.orders.findMany({
      where: (o, { and, eq, isNotNull }) =>
        and(eq(o.status, 'active'), isNotNull(o.trackingNumber)),
      with: { buyer: true },
    })

    for (const order of activeOrders) {
      if (!order.trackingNumber || !order.trackingCarrier) continue

      try {
        const status = await getTrackingStatus(
          order.trackingCarrier as TrackingCarrier,
          order.trackingNumber
        )

        // Si el paquete fue entregado, notificar al comprador
        if (status.status === 'delivered') {
          await db.insert(orderEvents).values({
            orderId: order.id,
            eventType: 'delivered',
            actorAddress: 'system',
            metadata: { carrier: status.carrier, trackingNumber: status.trackingNumber },
          })

          notifyUser(order.buyerId, 'paquete_entregado', {
            orderId: order.id,
            trackingNumber: order.trackingNumber,
          })

          console.log(`[tracking] Orden ${order.id}: paquete entregado`)
        }

        // Si lleva >48hs sin movimiento, notificar al comprador
        if (
          status.lastUpdate &&
          status.status === 'in_transit' &&
          Date.now() - status.lastUpdate.getTime() > 48 * 60 * 60 * 1000
        ) {
          notifyUser(order.buyerId, 'sin_movimiento_48h', {
            orderId: order.id,
            carrier: order.trackingCarrier,
          })
        }
      } catch (err) {
        console.error(`[tracking] Error en orden ${order.id}:`, err)
      }
    }
  },
  { connection: redis }
)

// Cron: correr cada 30 minutos
export async function scheduleTracking() {
  await trackingQueue.add(
    'poll-tracking',
    {},
    {
      repeat: { pattern: '*/30 * * * *' },
    }
  )
  console.log('[tracking] Job programado cada 30 minutos')
}

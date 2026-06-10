import { Queue, Worker } from 'bullmq'
import { lt, eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { orders, orderEvents } from '@cripex/db'
import { executeAutoRelease } from '../services/blockchain.service'
import { redis } from '../lib/redis'

const QUEUE_NAME = 'autorelease'

export const autoreleaseQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    removeOnComplete: 100,
    removeOnFail: 200,
  },
})

export const autoreleaseWorker = new Worker(
  QUEUE_NAME,
  async () => {
    const now = new Date()

    // Buscar órdenes activas con timeout vencido
    const expiredOrders = await db.query.orders.findMany({
      where: (o, { and, lte, eq }) =>
        and(eq(o.status, 'active'), lte(o.timeoutAt, now)),
    })

    if (expiredOrders.length === 0) return

    console.log(`[autorelease] ${expiredOrders.length} órdenes con timeout vencido`)

    for (const order of expiredOrders) {
      try {
        const txHash = await executeAutoRelease(order.contractOrderId as `0x${string}`)

        await db.update(orders)
          .set({ status: 'completed', txHashComplete: txHash, updatedAt: new Date() })
          .where(eq(orders.id, order.id))

        await db.insert(orderEvents).values({
          orderId: order.id,
          eventType: 'completed',
          actorAddress: 'system',
          metadata: { reason: 'autorelease_timeout', txHash },
          txHash,
        })

        console.log(`[autorelease] Orden ${order.id} completada via autoRelease. tx: ${txHash}`)
      } catch (err) {
        console.error(`[autorelease] Error en orden ${order.id}:`, err)
      }
    }
  },
  { connection: redis }
)

// Cron: correr cada hora
export async function scheduleAutorelease() {
  await autoreleaseQueue.add(
    'check-expired',
    {},
    {
      repeat: { pattern: '0 * * * *' }, // cada hora
    }
  )
  console.log('[autorelease] Job programado cada hora')
}

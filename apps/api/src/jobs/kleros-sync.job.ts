import { Queue, Worker } from 'bullmq'
import { eq } from 'drizzle-orm'
import { db } from '../lib/db'
import { disputes, orders } from '@cripex/db'
import { publicClient } from '../lib/viem'
import { redis } from '../lib/redis'
import { parseAbi } from 'viem'

const QUEUE_NAME = 'kleros-sync'

const KLEROS_ABI = parseAbi([
  'function disputeStatus(uint256 _disputeId) view returns (uint8)',
  'function currentRuling(uint256 _disputeId) view returns (uint256)',
])

const KLEROS_ADDRESS = (process.env.NEXT_PUBLIC_KLEROS_ARBITRATOR_POLYGON || '0x0') as `0x${string}`

const DISPUTE_STATUS_MAP: Record<number, string> = {
  0: 'pending',    // Waiting
  1: 'appeal',     // Appealable
  2: 'resolved',   // Solved
}

export const klerosSyncQueue = new Queue(QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: { removeOnComplete: 100, removeOnFail: 200 },
})

export const klerosSyncWorker = new Worker(
  QUEUE_NAME,
  async () => {
    const openDisputes = await db.query.disputes.findMany({
      where: (d, { notInArray }) =>
        notInArray(d.status, ['resolved']),
    })

    const pendingWithKleros = openDisputes.filter(d => d.klerosDisputeId != null)
    if (pendingWithKleros.length === 0) return

    for (const dispute of pendingWithKleros) {
      try {
        const [statusRaw, rulingRaw] = await Promise.all([
          publicClient.readContract({
            address: KLEROS_ADDRESS,
            abi: KLEROS_ABI,
            functionName: 'disputeStatus',
            args: [BigInt(dispute.klerosDisputeId!)],
          }),
          publicClient.readContract({
            address: KLEROS_ADDRESS,
            abi: KLEROS_ABI,
            functionName: 'currentRuling',
            args: [BigInt(dispute.klerosDisputeId!)],
          }),
        ])

        const newStatus = DISPUTE_STATUS_MAP[Number(statusRaw)] || dispute.status
        const ruling = Number(rulingRaw) || null

        if (newStatus !== dispute.status || (ruling && ruling !== dispute.ruling)) {
          await db.update(disputes)
            .set({
              status: newStatus as typeof dispute.status,
              ruling: ruling ?? dispute.ruling,
              updatedAt: new Date(),
              resolvedAt: newStatus === 'resolved' ? new Date() : dispute.resolvedAt,
            })
            .where(eq(disputes.id, dispute.id))

          console.log(`[kleros-sync] Disputa ${dispute.klerosDisputeId}: ${dispute.status} → ${newStatus}`)
        }
      } catch (err) {
        console.error(`[kleros-sync] Error en disputa ${dispute.klerosDisputeId}:`, err)
      }
    }
  },
  { connection: redis }
)

// Cron: sincronizar cada 15 minutos
export async function scheduleKlerosSync() {
  await klerosSyncQueue.add(
    'sync-disputes',
    {},
    { repeat: { pattern: '*/15 * * * *' } }
  )
  console.log('[kleros-sync] Job programado cada 15 minutos')
}

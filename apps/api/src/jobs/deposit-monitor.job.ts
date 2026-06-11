/**
 * Job: Monitor de depósitos pendientes
 *
 * Cada 30 segundos verifica si las órdenes en estado 'awaiting_payment'
 * recibieron el USDT en su dirección de depósito única.
 * Si detecta el pago, llama depositarEnEscrow() y actualiza la orden a 'active'.
 */

import { db } from '../lib/db'
import { orders, orderEvents } from '@shopix/db'
import { eq, and } from 'drizzle-orm'
import { verificarPagoRecibido, depositarEnEscrow } from '../services/deposit.service'
import { parseUnits } from 'viem'

export function scheduleDepositMonitor() {
  const INTERVAL_MS = 30_000 // 30 segundos

  async function tick() {
    try {
      // Buscar órdenes esperando pago con dirección de depósito asignada
      const pendientes = await db.query.orders.findMany({
        where: and(
          eq(orders.status, 'awaiting_payment' as any),
        ),
      })

      for (const order of pendientes) {
        if (!order.depositAddress || !order.depositEncryptedKey) continue

        const montoEsperado = parseUnits(order.amountUsdt, 6)

        const { recibido, balance } = await verificarPagoRecibido(
          order.depositAddress as `0x${string}`,
          montoEsperado,
        )

        if (!recibido) continue

        console.log(`[deposit-monitor] Pago detectado para orden ${order.id}: ${balance} USDT`)

        try {
          const { txHash } = await depositarEnEscrow({
            orderId:        order.id,
            encryptedKey:   order.depositEncryptedKey,
            depositAddress: order.depositAddress as `0x${string}`,
            payoutAddress:  order.sellerPayoutAddress as `0x${string}`,
            refundAddress:  order.buyerRefundAddress  as `0x${string}`,
            montoUsdt:      order.amountUsdt,
          })

          // Actualizar orden a activa
          await db.update(orders)
            .set({
              status:          'active',
              contractOrderId: order.id,
              updatedAt:       new Date(),
            })
            .where(eq(orders.id, order.id))

          await db.insert(orderEvents).values({
            orderId:      order.id,
            eventType:    'payment_confirmed',
            actorAddress: order.depositAddress,
            metadata:     { txHash, balance: balance.toString() },
          })

          console.log(`[deposit-monitor] Orden ${order.id} activada. TX: ${txHash}`)
        } catch (err: any) {
          console.error(`[deposit-monitor] Error procesando orden ${order.id}:`, err.message)
        }
      }
    } catch (err: any) {
      console.error('[deposit-monitor] Error en tick:', err.message)
    }
  }

  // Primera ejecución inmediata, luego cada INTERVAL_MS
  tick()
  setInterval(tick, INTERVAL_MS)
  console.log('[deposit-monitor] Iniciado — revisando cada 30s')
}

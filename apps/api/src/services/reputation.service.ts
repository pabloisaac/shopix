import { eq, sql } from 'drizzle-orm'
import { db } from '../lib/db'
import { users } from '@cripex/db'

export type RiskLevel = 'clean' | 'warning' | 'risky' | 'banned'

function calcRiskLevel(disputesLost: number, isBanned: boolean): RiskLevel {
  if (isBanned) return 'banned'
  if (disputesLost >= 3) return 'banned'
  if (disputesLost >= 2) return 'risky'
  if (disputesLost >= 1) return 'warning'
  return 'clean'
}

/**
 * Llamar cuando un usuario pierde una disputa (como vendedor o comprador fraudulento).
 */
export async function recordDisputeLost(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return

  const newLost = (user.disputesLost ?? 0) + 1
  const newRisk = calcRiskLevel(newLost, user.isBanned ?? false)
  const newBanned = newRisk === 'banned'

  await db.update(users).set({
    disputesLost: newLost,
    riskLevel: newRisk,
    isBanned: newBanned,
    banReason: newBanned && !user.isBanned
      ? `Baneado automáticamente por ${newLost} disputas perdidas`
      : user.banReason,
    reputationScore: Math.max(0, (user.reputationScore ?? 0) - 20),
    updatedAt: new Date(),
  }).where(eq(users.id, userId))

  return newRisk
}

/**
 * Llamar cuando un usuario gana una disputa.
 */
export async function recordDisputeWon(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return

  await db.update(users).set({
    disputesWon: (user.disputesWon ?? 0) + 1,
    reputationScore: (user.reputationScore ?? 0) + 5,
    updatedAt: new Date(),
  }).where(eq(users.id, userId))
}

/**
 * Banear manualmente a un usuario (admin).
 */
export async function banUser(userId: string, reason: string) {
  await db.update(users).set({
    isBanned: true,
    riskLevel: 'banned',
    banReason: reason,
    updatedAt: new Date(),
  }).where(eq(users.id, userId))
}

/**
 * Desbanear un usuario (admin).
 */
export async function unbanUser(userId: string) {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) return

  const risk = calcRiskLevel(user.disputesLost ?? 0, false)
  await db.update(users).set({
    isBanned: false,
    riskLevel: risk,
    banReason: null,
    updatedAt: new Date(),
  }).where(eq(users.id, userId))
}

/**
 * Verificar si un usuario puede operar (comprar/vender).
 */
export async function assertCanOperate(userId: string): Promise<void> {
  const user = await db.query.users.findFirst({ where: eq(users.id, userId) })
  if (!user) throw new Error('Usuario no encontrado')
  if (user.isBanned) {
    throw Object.assign(new Error('Tu cuenta está suspendida y no podés operar en Cripex'), { code: 'USER_BANNED' })
  }
}

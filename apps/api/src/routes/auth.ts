import { FastifyInstance } from 'fastify'
import { eq, or } from 'drizzle-orm'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { db } from '../lib/db'
import { users } from '@shopix/db'

export async function authRoutes(app: FastifyInstance) {

  // ── POST /auth/register ─────────────────────────────────────────────
  app.post('/register', async (request, reply) => {
    const schema = z.object({
      email:    z.string().email(),
      password: z.string().min(8, 'Mínimo 8 caracteres'),
      username: z.string().min(3).max(32).optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const { email, password, username } = parsed.data
    const emailLower = email.toLowerCase()

    // Verificar que no exista
    const existing = await db.query.users.findFirst({
      where: or(
        eq(users.email, emailLower),
        ...(username ? [eq(users.username, username)] : []),
      ),
    })

    if (existing) {
      if (existing.email === emailLower) {
        return reply.status(409).send({ error: 'Este email ya está registrado' })
      }
      return reply.status(409).send({ error: 'Ese nombre de usuario ya está en uso' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const [user] = await db.insert(users).values({
      email: emailLower,
      passwordHash,
      username: username ?? null,
      walletAddress: null,
    }).returning()

    const token = app.jwt.sign({ userId: user.id, email: user.email })

    return reply.status(201).send({
      token,
      user: { id: user.id, email: user.email, username: user.username },
    })
  })

  // ── POST /auth/login ────────────────────────────────────────────────
  app.post('/login', async (request, reply) => {
    const schema = z.object({
      email:    z.string().email(),
      password: z.string(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos' })
    }

    const { email, password } = parsed.data

    const user = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    })

    if (!user || !user.passwordHash) {
      return reply.status(401).send({ error: 'Email o contraseña incorrectos' })
    }

    const valid = await bcrypt.compare(password, user.passwordHash)
    if (!valid) {
      return reply.status(401).send({ error: 'Email o contraseña incorrectos' })
    }

    if (user.isBanned) {
      return reply.status(403).send({ error: 'Cuenta suspendida', reason: user.banReason })
    }

    const token = app.jwt.sign({ userId: user.id, email: user.email })

    return reply.send({
      token,
      user: { id: user.id, email: user.email, username: user.username, payoutAddress: user.payoutAddress },
    })
  })

  // ── GET /auth/me ────────────────────────────────────────────────────
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user as any

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) return reply.status(404).send({ error: 'Usuario no encontrado' })

    return reply.send({
      id: user.id,
      email: user.email,
      username: user.username,
      payoutAddress: user.payoutAddress,
      refundAddress: user.refundAddress,
      walletAddress: user.walletAddress,
      reputationScore: user.reputationScore,
      totalSales: user.totalSales,
    })
  })

  // ── POST /auth/logout ───────────────────────────────────────────────
  app.post('/logout', {
    preHandler: [app.authenticate],
  }, async (_request, reply) => {
    return reply.send({ ok: true })
  })
}

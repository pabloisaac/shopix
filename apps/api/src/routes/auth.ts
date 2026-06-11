import { FastifyInstance } from 'fastify'
import { SiweMessage } from 'siwe'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../lib/db'
import { redis } from '../lib/redis'
import { users } from '@shopix/db'
import { randomBytes } from 'crypto'

const NONCE_TTL = 300 // 5 minutos

export async function authRoutes(app: FastifyInstance) {
  // GET /auth/nonce — genera nonce temporal para SIWE
  app.get('/nonce', async (request, reply) => {
    const nonce = randomBytes(16).toString('hex')
    const ip = request.ip

    await redis.set(`siwe:nonce:${nonce}`, ip, 'EX', NONCE_TTL)

    return reply.send({ nonce })
  })

  // POST /auth/verify — verifica la firma SIWE y emite JWT
  app.post('/verify', async (request, reply) => {
    const schema = z.object({
      message: z.string(),
      signature: z.string(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Cuerpo inválido', details: parsed.error.issues })
    }

    const { message, signature } = parsed.data

    app.log.info({ message: message.slice(0, 200) }, 'SIWE message recibido')
    let siweMessage: SiweMessage
    try {
      const parsed = (() => { try { return JSON.parse(message) } catch { return message } })()
      siweMessage = new SiweMessage(parsed)
    } catch (e: any) {
      app.log.error({ err: e.message }, 'Error parseando SIWE')
      return reply.status(400).send({ error: 'Mensaje SIWE inválido', detail: e.message })
    }

    // Verificar que el nonce existe en Redis (previene replay attacks)
    const storedIp = await redis.get(`siwe:nonce:${siweMessage.nonce}`)
    if (!storedIp) {
      return reply.status(400).send({ error: 'Nonce inválido o expirado' })
    }

    try {
      const result = await siweMessage.verify({ signature })
      if (!result.success) {
        return reply.status(401).send({ error: 'Firma inválida' })
      }
    } catch {
      return reply.status(401).send({ error: 'Verificación de firma fallida' })
    }

    // Consumir el nonce (un solo uso)
    await redis.del(`siwe:nonce:${siweMessage.nonce}`)

    const walletAddress = siweMessage.address.toLowerCase()

    // Upsert del usuario
    let user = await db.query.users.findFirst({
      where: eq(users.walletAddress, walletAddress),
    })

    if (!user) {
      const [newUser] = await db.insert(users).values({ walletAddress }).returning()
      user = newUser
    }

    const token = app.jwt.sign({
      userId: user.id,
      walletAddress: user.walletAddress,
    })

    return reply.send({ token, user: { id: user.id, walletAddress: user.walletAddress, username: user.username } })
  })

  // GET /auth/me — datos del usuario autenticado
  app.get('/me', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    const { userId } = request.user

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    })

    if (!user) return reply.status(404).send({ error: 'Usuario no encontrado' })

    return reply.send({ user })
  })

  // POST /auth/logout — invalida el token (client-side en JWT, pero podemos blacklistear)
  app.post('/logout', {
    preHandler: [app.authenticate],
  }, async (request, reply) => {
    // Con JWT stateless, el logout real ocurre en el cliente borrando el token.
    // Opcionalmente, añadir el jti a una blacklist en Redis.
    return reply.send({ ok: true })
  })
}

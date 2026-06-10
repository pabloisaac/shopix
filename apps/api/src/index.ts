import { config } from 'dotenv'
import { resolve } from 'path'
// Carga el .env de la raíz del monorepo
config({ path: resolve(process.cwd(), '../../.env') })
config({ path: resolve(process.cwd(), '.env') })
import Fastify from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import rateLimit from '@fastify/rate-limit'
import multipart from '@fastify/multipart'
import websocket from '@fastify/websocket'
import fp from 'fastify-plugin'

import { authRoutes } from './routes/auth'
import { productRoutes } from './routes/products'
import { orderRoutes } from './routes/orders'
import { disputeRoutes } from './routes/disputes'
import { userRoutes } from './routes/users'
import { webhookRoutes } from './routes/webhooks'
import { devRoutes } from './routes/dev'
import { scheduleAutorelease } from './jobs/autorelease.job'
import { scheduleTracking } from './jobs/tracking.job'
import { scheduleKlerosSync } from './jobs/kleros-sync.job'
import { registerWsClient, removeWsClient } from './services/notification.service'
import { redis } from './lib/redis'

const app = Fastify({
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV !== 'production'
      ? { target: require.resolve('pino-pretty') }
      : undefined,
  },
})

// Extender tipos de Fastify para el decorador authenticate
declare module 'fastify' {
  interface FastifyInstance {
    authenticate: (request: any, reply: any) => Promise<void>
  }
}

async function main() {
  // ─── Core plugins (sin encapsulación) ────────────────────────────

  await app.register(cors, {
    origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
    credentials: true,
  })

  await app.register(jwt, {
    secret: process.env.JWT_SECRET || 'dev-secret-change-me',
    sign: { expiresIn: process.env.JWT_EXPIRY || '7d' },
  })

  await app.register(rateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis,
  })

  await app.register(multipart, {
    limits: { fileSize: 10 * 1024 * 1024 },
  })

  await app.register(websocket)

  // Registrar authenticate como plugin global con fastify-plugin
  // (fp evita el scope encapsulado, el decorador es visible en todos los plugins hijos)
  await app.register(fp(async (fastify) => {
    fastify.decorate('authenticate', async function (request: any, reply: any) {
      try {
        await request.jwtVerify()
      } catch {
        return reply.status(401).send({ error: 'No autenticado' })
      }
    })
  }))

  // ─── WebSocket ────────────────────────────────────────────────────

  app.get('/ws', { websocket: true }, (socket, request) => {
    const token = (request.query as any).token
    if (!token) {
      socket.close(1008, 'Token requerido')
      return
    }
    try {
      const payload = app.jwt.verify(token) as { userId: string }
      registerWsClient(payload.userId, socket as unknown as WebSocket)
      socket.on('close', () => removeWsClient(payload.userId, socket as unknown as WebSocket))
      socket.send(JSON.stringify({ event: 'connected', data: { userId: payload.userId } }))
    } catch {
      socket.close(1008, 'Token inválido')
    }
  })

  // ─── Rutas ────────────────────────────────────────────────────────

  await app.register(authRoutes, { prefix: '/auth' })
  await app.register(productRoutes, { prefix: '/products' })
  await app.register(orderRoutes, { prefix: '/orders' })
  await app.register(disputeRoutes, { prefix: '/disputes' })
  await app.register(userRoutes, { prefix: '/users' })
  await app.register(webhookRoutes, { prefix: '/webhooks' })
  await app.register(devRoutes, { prefix: '/dev' })

  app.get('/health', async () => ({ ok: true, timestamp: new Date().toISOString() }))

  // ─── Jobs ─────────────────────────────────────────────────────────

  await Promise.all([
    scheduleAutorelease(),
    scheduleTracking(),
    scheduleKlerosSync(),
  ])

  // ─── Start ────────────────────────────────────────────────────────

  const port = parseInt(process.env.PORT || '3002')
  await app.listen({ port, host: '0.0.0.0' })
  console.log(`API corriendo en http://localhost:${port}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})

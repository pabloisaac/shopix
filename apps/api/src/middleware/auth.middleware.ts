import { FastifyRequest, FastifyReply } from 'fastify'

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    reply.status(401).send({ error: 'No autenticado' })
  }
}

// Extender los tipos de Fastify para incluir el payload del JWT
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: {
      userId: string
      walletAddress: string
    }
    user: {
      userId: string
      walletAddress: string
    }
  }
}

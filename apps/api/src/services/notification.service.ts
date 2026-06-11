import type { FastifyInstance } from 'fastify'

// Mapa de clientes WebSocket por userId
const wsClients = new Map<string, Set<WebSocket>>()

export function registerWsClient(userId: string, ws: WebSocket) {
  if (!wsClients.has(userId)) {
    wsClients.set(userId, new Set())
  }
  wsClients.get(userId)!.add(ws)
}

export function removeWsClient(userId: string, ws: WebSocket) {
  wsClients.get(userId)?.delete(ws)
}

export function notifyUser(userId: string, event: string, data: unknown) {
  const clients = wsClients.get(userId)
  if (!clients) return

  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() })
  for (const client of clients) {
    try {
      // @ts-ignore — WebSocket send
      client.send(message)
    } catch {
      // Cliente desconectado
      clients.delete(client)
    }
  }
}

export async function sendEmail(params: {
  to: string
  subject: string
  html: string
}) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    console.log('[Email mock]', params.subject, '→', params.to)
    return
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Shopix <noreply@shopix.ar>',
      to: params.to,
      subject: params.subject,
      html: params.html,
    }),
  })

  if (!response.ok) {
    const error = await response.text()
    console.error('Email error:', error)
  }
}

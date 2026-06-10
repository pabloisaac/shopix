import type { TrackingCarrier } from '@cripex/shared'

export interface TrackingStatus {
  carrier: TrackingCarrier
  trackingNumber: string
  status: 'pending' | 'in_transit' | 'out_for_delivery' | 'delivered' | 'failed' | 'unknown'
  lastEvent?: string
  lastUpdate?: Date
  estimatedDelivery?: Date
}

export async function getTrackingStatus(
  carrier: TrackingCarrier,
  trackingNumber: string
): Promise<TrackingStatus> {
  switch (carrier) {
    case 'andreani':
      return getAndreaniStatus(trackingNumber)
    case 'oca':
      return getOcaStatus(trackingNumber)
    case 'correo_argentino':
      return getCorreoArgentinoStatus(trackingNumber)
    case 'pickup':
      return {
        carrier: 'pickup',
        trackingNumber,
        status: 'pending',
        lastEvent: 'Retiro en persona pactado',
      }
  }
}

async function getAndreaniStatus(trackingNumber: string): Promise<TrackingStatus> {
  const apiKey = process.env.ANDREANI_API_KEY
  const username = process.env.ANDREANI_USERNAME

  if (!apiKey || !username) {
    return mockTrackingStatus('andreani', trackingNumber)
  }

  try {
    const credentials = Buffer.from(`${username}:${apiKey}`).toString('base64')
    const response = await fetch(
      `https://apis.andreani.com/v1/ordenes/${trackingNumber}`,
      {
        headers: {
          Authorization: `Basic ${credentials}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!response.ok) {
      return { carrier: 'andreani', trackingNumber, status: 'unknown' }
    }

    const data = await response.json() as AndreaniResponse
    return mapAndreaniStatus(trackingNumber, data)
  } catch {
    return { carrier: 'andreani', trackingNumber, status: 'unknown' }
  }
}

async function getOcaStatus(trackingNumber: string): Promise<TrackingStatus> {
  // OCA no tiene API pública oficial; usar endpoint no documentado
  if (!process.env.OCA_USERNAME) {
    return mockTrackingStatus('oca', trackingNumber)
  }

  try {
    const response = await fetch(
      `https://www.oca.com.ar/OCAweb/ConsultaGuia?nroguia=${trackingNumber}&idpais=1`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )

    if (!response.ok) {
      return { carrier: 'oca', trackingNumber, status: 'unknown' }
    }

    // Parsear HTML de respuesta (OCA devuelve HTML)
    const html = await response.text()
    return parseOcaHtml(trackingNumber, html)
  } catch {
    return { carrier: 'oca', trackingNumber, status: 'unknown' }
  }
}

async function getCorreoArgentinoStatus(trackingNumber: string): Promise<TrackingStatus> {
  try {
    const response = await fetch(
      `https://www.correoargentino.com.ar/formularios/e-pak?pieza=${trackingNumber}`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    )

    if (!response.ok) {
      return { carrier: 'correo_argentino', trackingNumber, status: 'unknown' }
    }

    const html = await response.text()
    return parseCorreoArgentinoHtml(trackingNumber, html)
  } catch {
    return { carrier: 'correo_argentino', trackingNumber, status: 'unknown' }
  }
}

// ─── Mappers ────────────────────────────────────────────────────────

interface AndreaniResponse {
  estado?: string
  estadoDescripcion?: string
  fechaEstimadaEntrega?: string
}

function mapAndreaniStatus(trackingNumber: string, data: AndreaniResponse): TrackingStatus {
  const statusMap: Record<string, TrackingStatus['status']> = {
    'EN_TRANSITO': 'in_transit',
    'EN_REPARTO': 'out_for_delivery',
    'ENTREGADO': 'delivered',
    'RECHAZADO': 'failed',
    'DEVUELTO': 'failed',
  }

  const rawStatus = data.estado?.toUpperCase() || ''
  const status = statusMap[rawStatus] || 'in_transit'

  return {
    carrier: 'andreani',
    trackingNumber,
    status,
    lastEvent: data.estadoDescripcion,
    estimatedDelivery: data.fechaEstimadaEntrega
      ? new Date(data.fechaEstimadaEntrega)
      : undefined,
  }
}

function parseOcaHtml(trackingNumber: string, html: string): TrackingStatus {
  if (html.includes('ENTREGADO') || html.includes('Entregado')) {
    return { carrier: 'oca', trackingNumber, status: 'delivered', lastEvent: 'Entregado' }
  }
  if (html.includes('EN TRÁNSITO') || html.includes('en tránsito')) {
    return { carrier: 'oca', trackingNumber, status: 'in_transit', lastEvent: 'En tránsito' }
  }
  return { carrier: 'oca', trackingNumber, status: 'unknown' }
}

function parseCorreoArgentinoHtml(trackingNumber: string, html: string): TrackingStatus {
  if (html.includes('ENTREGADO')) {
    return { carrier: 'correo_argentino', trackingNumber, status: 'delivered' }
  }
  if (html.includes('EN TRÁNSITO') || html.includes('CLASIFICADO')) {
    return { carrier: 'correo_argentino', trackingNumber, status: 'in_transit' }
  }
  return { carrier: 'correo_argentino', trackingNumber, status: 'unknown' }
}

// Mock para desarrollo local sin credenciales
function mockTrackingStatus(carrier: TrackingCarrier, trackingNumber: string): TrackingStatus {
  return {
    carrier,
    trackingNumber,
    status: 'in_transit',
    lastEvent: '[MOCK] En tránsito hacia destino',
    lastUpdate: new Date(),
  }
}

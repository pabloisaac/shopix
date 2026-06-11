'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Badge, StatusDot } from '@/components/ui/Badge'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { useConfirmReceipt } from '@/hooks/useEscrowContract'
import type { OrderStatus } from '@shopix/shared'

const EVENT_LABELS: Record<string, string> = {
  created: 'Orden creada',
  payment_confirmed: 'Pago confirmado — fondos en escrow',
  shipped: 'Producto enviado',
  delivered: 'Entregado',
  completed: 'Recepción confirmada — fondos liberados',
  dispute_opened: 'Disputa abierta',
  evidence_uploaded: 'Evidencia subida',
  ruling_issued: 'Fallo de Kleros emitido',
  return_required: 'Devolución del producto requerida',
  return_tracking_uploaded: 'Tracking de devolución cargado',
  return_received: 'Devolución confirmada por el vendedor',
  return_deadline_missed: 'Plazo de devolución vencido',
  refunded: 'Reembolso procesado',
  shipping_deadline_warning: '⚠ Enviado cerca del límite de tiempo',
  auto_cancelled: 'Cancelación automática',
}

const CARRIER_LABELS: Record<string, string> = {
  andreani: 'Andreani',
  oca: 'OCA',
  correo_argentino: 'Correo Argentino',
  pickup: 'Retiro en persona',
}

// Buyer messages / Seller messages organized by role
const BUYER_MESSAGES = [
  { type: 'buyer_asking_shipping_date', label: '¿Cuándo enviás el producto?' },
  { type: 'buyer_asking_status', label: '¿Hay novedades sobre mi pedido?' },
  { type: 'buyer_asking_delay', label: 'Pasaron varios días, ¿está todo bien?' },
  { type: 'buyer_received_damaged', label: 'El producto llegó con daños' },
]

const SELLER_MESSAGES = [
  { type: 'seller_shipped', label: 'El producto ya fue enviado' },
  { type: 'seller_shipping_delayed', label: 'Hubo una demora, envío pronto' },
  { type: 'seller_problem_stock', label: 'Tuve un inconveniente con el stock' },
  { type: 'seller_pickup_ready', label: 'El producto está listo para retiro' },
]

function ReturnCountdown({ deadlineAt, onExpired }: { deadlineAt: string; onExpired: () => void }) {
  const deadline = new Date(deadlineAt).getTime()
  const [remaining, setRemaining] = useState(deadline - Date.now())

  useEffect(() => {
    const tick = setInterval(() => {
      const r = deadline - Date.now()
      setRemaining(r)
      if (r <= 0) { clearInterval(tick); onExpired() }
    }, 1000)
    return () => clearInterval(tick)
  }, [deadline, onExpired])

  if (remaining <= 0) return <span className="text-red-400 text-sm font-medium">Plazo de devolución expirado</span>

  const totalSeconds = Math.floor(remaining / 1000)
  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const isUrgent = remaining < 24 * 60 * 60 * 1000

  return (
    <div className={`flex items-center gap-2 text-sm ${isUrgent ? 'text-red-400' : 'text-orange-400'}`}>
      <span>{isUrgent ? '⚠' : '📦'}</span>
      <span>
        Tiempo para devolver: <span className={`font-mono font-bold ${isUrgent ? 'animate-pulse' : ''}`}>
          {days > 0 ? `${days}d ` : ''}{hours}h {mins}m
        </span>
      </span>
    </div>
  )
}

function ShippingCountdown({ deadlineAt, onExpired }: { deadlineAt: string; onExpired: () => void }) {
  const deadline = new Date(deadlineAt).getTime()
  const [remaining, setRemaining] = useState(deadline - Date.now())

  useEffect(() => {
    const tick = setInterval(() => {
      const r = deadline - Date.now()
      setRemaining(r)
      if (r <= 0) { clearInterval(tick); onExpired() }
    }, 1000)
    return () => clearInterval(tick)
  }, [deadline, onExpired])

  if (remaining <= 0) return <span className="text-red-400 text-sm font-medium">Plazo de envío expirado</span>

  const totalSeconds = Math.floor(remaining / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const mins = Math.floor((totalSeconds % 3600) / 60)
  const secs = totalSeconds % 60
  const isUrgent = remaining < 6 * 60 * 60 * 1000 // < 6h

  return (
    <div className={`flex items-center gap-2 text-sm ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
      <span>{isUrgent ? '⚠' : '⏱'}</span>
      <span>
        Plazo de envío: <span className={`font-mono font-bold ${isUrgent ? 'animate-pulse' : ''}`}>
          {hours}h {mins}m {secs}s
        </span>
      </span>
      {isUrgent && (
        <span className="text-xs text-red-300">(enviá pronto o se auto-cancela)</span>
      )}
    </div>
  )
}

export default function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const router = useRouter()
  const { address } = useAccount()
  const { token } = useAuthStore()
  const { confirmReceipt, isPending: isConfirming } = useConfirmReceipt()

  const [order, setOrder] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [trackingForm, setTrackingForm] = useState({ number: '', carrier: 'andreani' })
  const [savingTracking, setSavingTracking] = useState(false)
  const [trackingWarning, setTrackingWarning] = useState<string | null>(null)
  const [returnForm, setReturnForm] = useState({ number: '', carrier: 'andreani' })
  const [savingReturn, setSavingReturn] = useState(false)
  const [confirmingReturn, setConfirmingReturn] = useState(false)
  const [sendingMsg, setSendingMsg] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isBuyer = order?.buyer?.walletAddress?.toLowerCase() === address?.toLowerCase()
  const isSeller = order?.seller?.walletAddress?.toLowerCase() === address?.toLowerCase()
  const availableMessages = isBuyer ? BUYER_MESSAGES : isSeller ? SELLER_MESSAGES : []

  const fetchOrder = useCallback(async () => {
    if (!token) return
    try {
      const data = await api.get<any>(`/orders/${orderId}`, token)
      setOrder(data)
    } catch {
      setError('Orden no encontrada')
    } finally {
      setLoading(false)
    }
  }, [orderId, token])

  const fetchMessages = useCallback(async () => {
    if (!token) return
    try {
      const data = await api.get<any[]>(`/orders/${orderId}/messages`, token)
      setMessages(data)
    } catch {}
  }, [orderId, token])

  useEffect(() => {
    fetchOrder()
    fetchMessages()
  }, [fetchOrder, fetchMessages])

  async function handleConfirmReceipt() {
    if (!order) return
    setError(null)
    try {
      const txHash = await confirmReceipt(order.contractOrderId)
      if (txHash) {
        await api.post(`/orders/${orderId}/confirm`, { txHash }, token!)
        fetchOrder()
      }
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleReturnDeadlineMissed() {
    try {
      await api.post(`/orders/${orderId}/return-deadline-missed`, {}, token!)
      fetchOrder()
    } catch {}
  }

  async function handleSaveReturnTracking() {
    if (!returnForm.number) return
    setSavingReturn(true)
    setError(null)
    try {
      await api.post(`/orders/${orderId}/return-tracking`, {
        trackingNumber: returnForm.number,
        carrier: returnForm.carrier,
      }, token!)
      fetchOrder()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSavingReturn(false)
    }
  }

  async function handleConfirmReturn() {
    setConfirmingReturn(true)
    setError(null)
    try {
      await api.post(`/orders/${orderId}/confirm-return`, {}, token!)
      fetchOrder()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setConfirmingReturn(false)
    }
  }

  async function handleSaveTracking() {
    if (!trackingForm.number) return
    setSavingTracking(true)
    setTrackingWarning(null)
    setError(null)
    try {
      const res = await api.post<{ ok: boolean; warning?: string }>(
        `/orders/${orderId}/tracking`,
        { trackingNumber: trackingForm.number, carrier: trackingForm.carrier },
        token!
      )
      if (res.warning) setTrackingWarning(res.warning)
      fetchOrder()
      fetchMessages()
    } catch (e: any) {
      setError(e.message || e.error || 'Error al guardar tracking')
    } finally {
      setSavingTracking(false)
    }
  }

  async function handleSendMessage(type: string) {
    setSendingMsg(true)
    try {
      await api.post(`/orders/${orderId}/messages`, { messageType: type }, token!)
      fetchMessages()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSendingMsg(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        {[1, 2, 3].map(i => <div key={i} className="h-24 rounded-xl bg-bg-elevated animate-pulse" />)}
      </div>
    )
  }

  if (error && !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="text-red-400 mb-4">{error}</p>
        <Link href="/mis-ordenes" className="btn-secondary">← Volver</Link>
      </div>
    )
  }

  if (!order) return null

  const isActive = order.status === 'active'
  const canChat = isActive || order.status === 'disputed'

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.back()} className="text-shopix-faint hover:text-shopix-text transition-colors">
          ← Volver
        </button>
        <h1 className="text-2xl font-display font-bold text-shopix-text">Detalle de orden</h1>
      </div>

      {/* Estado */}
      <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <StatusDot status={order.status as OrderStatus} />
              <Badge status={order.status as OrderStatus} />
              <span className="text-xs text-shopix-faint font-mono">{order.id}</span>
            </div>
            <h2 className="text-lg font-display font-semibold text-shopix-text">
              {order.product?.title}
            </h2>
            <p className="text-xs text-shopix-faint mt-1">
              {isBuyer
                ? `Vendedor: ${order.seller?.username || order.seller?.walletAddress?.slice(0, 10)}…`
                : `Comprador: ${order.buyer?.username || order.buyer?.walletAddress?.slice(0, 10)}…`}
            </p>
          </div>
          <PriceDisplay amountUsdt={order.amountUsdt} size="lg" showArs />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-xs text-shopix-muted">
          <div>
            <span className="text-shopix-faint">Creada</span>
            <p className="text-shopix-text font-medium">{new Date(order.createdAt).toLocaleString('es-AR')}</p>
          </div>
          <div>
            <span className="text-shopix-faint">Timeout escrow</span>
            <p className="text-shopix-text font-medium">{new Date(order.timeoutAt).toLocaleString('es-AR')}</p>
          </div>
        </div>

        {/* Shipping deadline countdown — solo si activa y es el vendedor */}
        {isActive && order.shippingDeadlineAt && isSeller && !order.trackingNumber && (
          <div className="mt-4 bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-3">
            <ShippingCountdown
              deadlineAt={order.shippingDeadlineAt}
              onExpired={fetchOrder}
            />
          </div>
        )}
        {/* Deadline como info para el comprador */}
        {isActive && order.shippingDeadlineAt && isBuyer && !order.trackingNumber && (
          <div className="mt-4 bg-bg-secondary rounded-xl p-3">
            <p className="text-xs text-shopix-muted">
              El vendedor tiene hasta el{' '}
              <span className="text-shopix-text font-medium">
                {new Date(order.shippingDeadlineAt).toLocaleString('es-AR')}
              </span>{' '}
              para enviar el producto.
            </p>
          </div>
        )}
      </div>

      {/* Acciones */}
      {order.status === 'disputed' && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-6 space-y-3">
          <h3 className="font-display font-semibold text-orange-800">⚠ Orden en disputa</h3>
          <p className="text-sm text-orange-700">
            {isBuyer ? 'Abriste una disputa. Podés subir evidencia y seguir el estado del proceso.' : 'El comprador abrió una disputa. Podés ver el estado y subir tu evidencia.'}
          </p>
          <Link href={`/disputa/${order.id}`} className="inline-block btn-primary text-center">
            → Ver disputa en Kleros
          </Link>
        </div>
      )}

      {isActive && (
        <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6 space-y-4">
          <h3 className="font-display font-semibold text-shopix-text">Acciones</h3>

          {isBuyer && (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={handleConfirmReceipt}
                disabled={isConfirming}
                className="btn-primary flex-1"
              >
                {isConfirming ? '⟳ Confirmando…' : '✓ Confirmar recepción del producto'}
              </button>
              <Link href={`/disputa/${order.id}`} className="btn-danger flex-1 text-center">
                ⚠ Abrir disputa con Kleros
              </Link>
            </div>
          )}

          {isSeller && !order.trackingNumber && (
            <div className="space-y-3">
              <p className="text-sm text-shopix-muted">
                Cargá el número de seguimiento. El comprador puede confirmar recepción una vez que lo reciba.
              </p>
              <div className="flex gap-2 flex-wrap">
                <select
                  value={trackingForm.carrier}
                  onChange={e => setTrackingForm(p => ({ ...p, carrier: e.target.value }))}
                  className="input w-44"
                >
                  {Object.entries(CARRIER_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
                <input
                  className="input flex-1 min-w-40"
                  placeholder="Número de tracking"
                  value={trackingForm.number}
                  onChange={e => setTrackingForm(p => ({ ...p, number: e.target.value }))}
                />
                <button onClick={handleSaveTracking} disabled={savingTracking || !trackingForm.number} className="btn-primary">
                  {savingTracking ? '⟳' : 'Guardar'}
                </button>
              </div>
              {trackingWarning && (
                <div className="bg-red-400/10 border border-red-400/30 rounded-xl p-3 text-sm text-red-300">
                  ⚠ {trackingWarning}
                </div>
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* ── Panel de devolución ── */}
      {(order.status === 'return_required' || order.status === 'return_in_transit') && (
        <div className="bg-orange-500/5 border border-orange-500/20 rounded-2xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-display font-semibold text-orange-300">Devolución del producto requerida</h3>
              <p className="text-xs text-orange-200/60 mt-0.5">Kleros falló a favor del comprador — el producto debe ser devuelto al vendedor</p>
            </div>
          </div>

          {/* Contexto según rol */}
          {isBuyer && order.status === 'return_required' && (
            <div className="space-y-3">
              <div className="bg-orange-500/10 rounded-xl p-3 text-sm text-orange-200">
                <p className="font-semibold mb-1">Tu reembolso fue procesado ✓</p>
                <p className="text-xs">Ahora debés devolver el producto al vendedor. Tenés un plazo de 5 días desde el fallo. Si no lo devolvés a tiempo, tu reputación será afectada.</p>
              </div>

              {order.returnDeadlineAt && (
                <ReturnCountdown deadlineAt={order.returnDeadlineAt} onExpired={handleReturnDeadlineMissed} />
              )}

              <div className="space-y-2">
                <p className="text-sm text-orange-200">Cargá el número de seguimiento de tu envío de devolución:</p>
                <div className="flex gap-2 flex-wrap">
                  <select
                    value={returnForm.carrier}
                    onChange={e => setReturnForm(p => ({ ...p, carrier: e.target.value }))}
                    className="input w-44"
                  >
                    {Object.entries(CARRIER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                  <input
                    className="input flex-1 min-w-40"
                    placeholder="Número de tracking de devolución"
                    value={returnForm.number}
                    onChange={e => setReturnForm(p => ({ ...p, number: e.target.value }))}
                  />
                  <button
                    onClick={handleSaveReturnTracking}
                    disabled={savingReturn || !returnForm.number}
                    className="btn-primary disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    {savingReturn ? '⟳' : 'Cargar'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {isBuyer && order.status === 'return_in_transit' && (
            <div className="bg-blue-500/10 rounded-xl p-3 text-sm text-blue-300">
              <p className="font-semibold">✓ Tracking de devolución cargado</p>
              <p className="text-xs mt-1 font-mono">{order.returnTrackingNumber} · {CARRIER_LABELS[order.returnCarrier] || order.returnCarrier}</p>
              <p className="text-xs text-blue-200/60 mt-1">Esperando que el vendedor confirme la recepción.</p>
            </div>
          )}

          {isSeller && order.status === 'return_required' && (
            <div className="bg-orange-500/10 rounded-xl p-3 text-sm text-orange-200">
              <p>El comprador ganó la disputa. Tiene 5 días para enviarte el producto de vuelta. Te notificaremos cuando cargue el tracking.</p>
              {order.returnDeadlineAt && (
                <p className="text-xs mt-2 text-orange-300/70">
                  Plazo: {new Date(order.returnDeadlineAt).toLocaleString('es-AR')}
                </p>
              )}
            </div>
          )}

          {isSeller && order.status === 'return_in_transit' && (
            <div className="space-y-3">
              <div className="bg-blue-500/10 rounded-xl p-3 text-sm text-blue-300">
                <p className="font-semibold">📦 El comprador envió el producto de vuelta</p>
                <p className="text-xs mt-1 font-mono">{order.returnTrackingNumber} · {CARRIER_LABELS[order.returnCarrier] || order.returnCarrier}</p>
              </div>
              <div className="bg-orange-500/10 rounded-xl p-3 text-sm text-orange-200">
                <p className="font-semibold mb-1">⚠ Importante antes de confirmar</p>
                <p className="text-xs">Verificá que el producto devuelto sea el original y en el estado correcto. Si recibís algo diferente (ej: caja vacía, otro objeto), <strong>no confirmes</strong> y abrí una nueva disputa.</p>
              </div>
              <button
                onClick={handleConfirmReturn}
                disabled={confirmingReturn}
                className="btn-primary w-full disabled:opacity-40"
              >
                {confirmingReturn ? '⟳ Confirmando…' : '✓ Confirmar recepción de la devolución'}
              </button>
            </div>
          )}

          {error && <p className="text-sm text-red-400">{error}</p>}
        </div>
      )}

      {/* Estado: devolución no realizada */}
      {order.status === 'refunded_no_return' && (
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-6">
          <h3 className="font-display font-semibold text-red-400 mb-2">🚫 Devolución no realizada</h3>
          <p className="text-sm text-shopix-muted">
            El comprador no devolvió el producto en el plazo establecido. Su reputación fue afectada.
            {isSeller && ' Podés abrir una nueva disputa si considerás que corresponde.'}
          </p>
        </div>
      )}

      {/* Tracking */}
      {order.trackingNumber && (
        <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6">
          <h3 className="font-display font-semibold text-shopix-text mb-3">Envío</h3>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-shopix-muted">{CARRIER_LABELS[order.trackingCarrier] || order.trackingCarrier}</p>
              <p className="font-mono text-shopix-text font-medium text-lg">{order.trackingNumber}</p>
            </div>
            <span className="badge badge-active text-xs">En camino</span>
          </div>
        </div>
      )}

      {/* Dirección de envío */}
      {order.shippingAddress && (
        <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6">
          <h3 className="font-display font-semibold text-shopix-text mb-3">Dirección de entrega</h3>
          <div className="text-sm text-shopix-muted space-y-1">
            <p className="text-shopix-text font-medium">{order.shippingAddress.name}</p>
            <p>{order.shippingAddress.street}</p>
            <p>{order.shippingAddress.city}, {order.shippingAddress.province} {order.shippingAddress.zip}</p>
            {order.shippingAddress.phone && <p>Tel: {order.shippingAddress.phone}</p>}
          </div>
        </div>
      )}

      {/* Chat estructurado */}
      {canChat && (
        <div className="bg-bg-elevated border border-bg-border rounded-2xl overflow-hidden">
          <div className="p-4 border-b border-bg-border">
            <h3 className="font-display font-semibold text-shopix-text">Comunicación con {isBuyer ? 'el vendedor' : 'el comprador'}</h3>
            <p className="text-xs text-shopix-faint mt-0.5">Solo mensajes predefinidos. Nunca compartas datos personales.</p>
          </div>

          {/* Hilo de mensajes */}
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {messages.length === 0 ? (
              <p className="text-xs text-shopix-faint text-center py-4">Sin mensajes aún</p>
            ) : messages.map((msg) => {
              const isOwn = msg.sender?.id === order[isBuyer ? 'buyerId' : 'sellerId']
              return (
                <div key={msg.id} className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                    isOwn
                      ? 'bg-accent/20 text-shopix-text border border-accent/30'
                      : 'bg-bg-secondary text-shopix-muted'
                  }`}>
                    <p>{msg.label}</p>
                    <p className="text-xs opacity-50 mt-0.5">
                      {new Date(msg.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Botones de mensajes disponibles */}
          <div className="p-4 border-t border-bg-border">
            <p className="text-xs text-shopix-faint mb-2">Enviá un mensaje:</p>
            <div className="flex flex-wrap gap-2">
              {availableMessages.map(m => (
                <button
                  key={m.type}
                  onClick={() => handleSendMessage(m.type)}
                  disabled={sendingMsg}
                  className="text-xs px-3 py-1.5 rounded-lg border border-bg-border hover:border-accent/40 hover:text-accent text-shopix-muted transition-colors"
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Timeline de eventos */}
      {order.events?.length > 0 && (
        <div className="bg-bg-elevated border border-bg-border rounded-2xl p-6">
          <h3 className="font-display font-semibold text-shopix-text mb-4">Historial</h3>
          <div className="relative space-y-1">
            {[...order.events].reverse().map((event: any, i: number, arr: any[]) => (
              <div key={event.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <div className="w-2.5 h-2.5 rounded-full bg-accent mt-1.5 flex-shrink-0" />
                  {i < arr.length - 1 && <div className="w-px flex-1 bg-bg-border mt-1 mb-1" />}
                </div>
                <div className="pb-3">
                  <p className="text-sm font-medium text-shopix-text">
                    {EVENT_LABELS[event.eventType] || event.eventType}
                  </p>
                  <p className="text-xs text-shopix-faint">
                    {new Date(event.createdAt).toLocaleString('es-AR')}
                  </p>
                  {event.txHash && (
                    <p className="text-xs font-mono text-shopix-faint mt-0.5">
                      tx: {event.txHash.slice(0, 20)}…
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

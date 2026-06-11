'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAccount } from 'wagmi'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { Badge, StatusDot } from '@/components/ui/Badge'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { GlowCard } from '@/components/ui/GlowCard'
import type { OrderStatus } from '@shopix/shared'

type Tab = 'buying' | 'selling'

function PendingCountdown({ createdAt, orderId, onExpired }: {
  createdAt: string
  orderId: string
  onExpired: () => void
}) {
  const expiresAt = new Date(createdAt).getTime() + 10 * 60 * 1000
  const [remaining, setRemaining] = useState(expiresAt - Date.now())
  const { token } = useAuthStore()

  useEffect(() => {
    const tick = setInterval(() => {
      const r = expiresAt - Date.now()
      setRemaining(r)
      if (r <= 0) {
        clearInterval(tick)
        // Auto-cancel via API
        api.post(`/orders/${orderId}/cancel`, {}, token!).catch(() => {}).finally(onExpired)
      }
    }, 1000)
    return () => clearInterval(tick)
  }, [expiresAt, orderId, token, onExpired])

  if (remaining <= 0) return <span className="text-xs text-red-400">Expirada</span>

  const mins = Math.floor(remaining / 60000)
  const secs = Math.floor((remaining % 60000) / 1000)
  const isUrgent = remaining < 2 * 60 * 1000

  return (
    <span className={`text-xs font-mono ${isUrgent ? 'text-red-400 animate-pulse' : 'text-yellow-400'}`}>
      {mins}:{secs.toString().padStart(2, '0')} para pagar
    </span>
  )
}

function ShippingDeadlineChip({ deadlineAt }: { deadlineAt: string }) {
  const deadline = new Date(deadlineAt).getTime()
  const [remaining, setRemaining] = useState(deadline - Date.now())

  useEffect(() => {
    const tick = setInterval(() => setRemaining(deadline - Date.now()), 10000)
    return () => clearInterval(tick)
  }, [deadline])

  if (remaining <= 0) return <span className="text-xs text-red-400">Plazo expirado</span>

  const hours = Math.floor(remaining / (1000 * 60 * 60))
  const mins = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60))
  const isUrgent = remaining < 6 * 60 * 60 * 1000

  return (
    <span className={`text-xs font-mono ${isUrgent ? 'text-red-400' : 'text-yellow-400'}`}>
      {isUrgent ? '⚠ ' : '⏱ '}Enviar en {hours}h {mins}m
    </span>
  )
}

export default function MisOrdenesPage() {
  const { isConnected } = useAccount()
  const { token } = useAuthStore()
  const [tab, setTab] = useState<Tab>('buying')
  const [orders, setOrders] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  function fetchOrders() {
    if (!token) return
    setLoading(true)
    api.get<any[]>(`/orders/my/${tab === 'buying' ? 'buying' : 'selling'}`, token)
      .then(setOrders)
      .catch(() => setOrders([]))
      .finally(() => setLoading(false))
  }

  useEffect(() => { fetchOrders() }, [tab, token])

  if (!isConnected || !token) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center">
        <p className="text-shopix-muted mb-4">Conectá tu wallet para ver tus órdenes</p>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-display font-bold text-shopix-text mb-6">Mis Órdenes</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-bg-elevated border border-bg-border rounded-xl p-1 mb-6 w-fit">
        {([
          { key: 'buying', label: 'Comprando' },
          { key: 'selling', label: 'Vendiendo' },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              tab === t.key
                ? 'bg-accent text-bg-primary'
                : 'text-shopix-muted hover:text-shopix-text'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-bg-elevated animate-pulse" />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <div className="text-center py-16 text-shopix-faint">
          <p>No tenés {tab === 'buying' ? 'compras' : 'ventas'} aún</p>
          {tab === 'buying' && (
            <Link href="/marketplace" className="btn-primary mt-4 inline-flex">
              Ir al marketplace
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order) => (
            <Link key={order.id} href={`/mis-ordenes/${order.id}`} className="block group">
              <GlowCard className="p-5 cursor-pointer group-hover:border-accent/30 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <StatusDot status={order.status as OrderStatus} />
                      <Badge status={order.status as OrderStatus} />
                      <span className="text-xs text-shopix-faint font-mono">
                        {order.id.slice(0, 8)}…
                      </span>
                    </div>
                    <p className="font-medium text-shopix-text truncate">
                      {order.product?.title || 'Producto'}
                    </p>
                    {order.trackingNumber && (
                      <p className="text-xs text-shopix-muted mt-1">
                        Tracking: <span className="font-mono">{order.trackingNumber}</span>
                        {' '}({order.trackingCarrier})
                      </p>
                    )}
                    <p className="text-xs text-shopix-faint mt-1">
                      {new Date(order.createdAt).toLocaleDateString('es-AR')}
                    </p>
                    {order.status === 'pending_payment' && tab === 'buying' && (
                      <div className="mt-1.5">
                        <PendingCountdown
                          createdAt={order.createdAt}
                          orderId={order.id}
                          onExpired={fetchOrders}
                        />
                      </div>
                    )}
                    {order.status === 'active' && tab === 'selling' && order.shippingDeadlineAt && !order.trackingNumber && (
                      <ShippingDeadlineChip deadlineAt={order.shippingDeadlineAt} />
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    <PriceDisplay amountUsdt={order.amountUsdt} size="md" showArs={false} />
                    <span className="text-xs text-shopix-faint group-hover:text-accent transition-colors">
                      Ver detalle →
                    </span>
                  </div>
                </div>
              </GlowCard>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

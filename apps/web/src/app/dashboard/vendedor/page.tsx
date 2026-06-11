'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { GlowCard } from '@/components/ui/GlowCard'
import { Badge } from '@/components/ui/Badge'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import type { OrderStatus } from '@shopix/shared'

export default function DashboardVendedorPage() {
  const { token, user } = useAuthStore()

  const [orders, setOrders]           = useState<any[]>([])
  const [loading, setLoading]         = useState(true)
  const [payoutAddress, setPayoutAddress] = useState('')
  const [payoutSaving, setPayoutSaving]   = useState(false)
  const [payoutSaved, setPayoutSaved]     = useState(false)
  const [payoutError, setPayoutError]     = useState<string | null>(null)

  useEffect(() => {
    if (!token) return
    api.get<any>('/users/me', token)
      .then(u => { if (u.payoutAddress) setPayoutAddress(u.payoutAddress) })
      .catch(() => {})
  }, [token])

  async function savePayoutAddress() {
    if (!token) return
    setPayoutSaving(true)
    setPayoutError(null)
    try {
      await api.patch('/users/me', { payoutAddress }, token)
      setPayoutSaved(true)
      setTimeout(() => setPayoutSaved(false), 3000)
    } catch (err: any) {
      setPayoutError(err.message || 'Error al guardar')
    } finally {
      setPayoutSaving(false)
    }
  }

  useEffect(() => {
    if (!token) return
    api.get<any[]>('/orders/my/selling', token)
      .then(setOrders)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token])

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-text-faint">
        Iniciá sesión para ver tu dashboard de ventas.
      </div>
    )
  }

  const totalEarned = orders
    .filter(o => o.status === 'completed')
    .reduce((sum, o) => sum + parseFloat(o.amountUsdt) * 0.985, 0)

  const pendingDispatch = orders.filter(o => o.status === 'active' && !o.trackingNumber)
  const activeCount = orders.filter(o => o.status === 'active').length
  const completedCount = orders.filter(o => o.status === 'completed').length

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-display font-bold text-shopix-text">Dashboard vendedor</h1>
        <Link href="/vender" className="btn-primary text-sm py-2 px-4">
          + Publicar
        </Link>
      </div>

      {/* Dirección de cobro */}
      <GlowCard className="p-5 space-y-3">
        <div>
          <h2 className="font-display font-semibold text-shopix-text">💳 Dirección de cobro</h2>
          <p className="text-xs text-shopix-muted mt-0.5">
            Adonde recibís el USDT cuando se complete una venta. Puede ser tu dirección de Nexo, BingX, MetaMask, etc.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1 font-mono text-xs"
            placeholder="0x... (Nexo, BingX, cualquier wallet ERC-20)"
            value={payoutAddress}
            onChange={e => setPayoutAddress(e.target.value)}
          />
          <button
            onClick={savePayoutAddress}
            disabled={payoutSaving || !payoutAddress.match(/^0x[0-9a-fA-F]{40}$/)}
            className="btn-primary px-4 shrink-0"
          >
            {payoutSaving ? '…' : payoutSaved ? '✓ Guardado' : 'Guardar'}
          </button>
        </div>
        {!payoutAddress && (
          <p className="text-xs text-yellow-600 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
            ⚠ Sin dirección de cobro tus ventas no podrán procesarse.
          </p>
        )}
        {payoutError && <p className="text-xs text-red-500">{payoutError}</p>}
      </GlowCard>

      {/* Métricas */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          
          { label: 'Ganado total', value: `${totalEarned.toFixed(2)} USDT`, accent: false },
          { label: 'Órdenes activas', value: String(activeCount), accent: false },
          { label: 'Completadas', value: String(completedCount), accent: false },
        ].map((metric) => (
          <GlowCard key={metric.label} className="p-4 text-center">
            <p className={`text-xl font-display font-bold ${metric.accent ? 'text-accent' : 'text-shopix-text'}`}>
              {metric.value}
            </p>
            <p className="text-xs text-shopix-faint mt-1">{metric.label}</p>
          </GlowCard>
        ))}
      </div>

      {/* Pendientes de despacho */}
      {pendingDispatch.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-shopix-text mb-3">
            ⚡ Pendientes de despacho ({pendingDispatch.length})
          </h2>
          <div className="space-y-2">
            {pendingDispatch.map((order) => (
              <GlowCard key={order.id} className="p-4 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-shopix-text text-sm">{order.product?.title}</p>
                  <p className="text-xs text-shopix-faint">
                    Comprador: {order.buyer?.username || order.buyer?.walletAddress?.slice(0, 10) + '…'}
                  </p>
                  <p className="text-xs text-orange-400 mt-0.5">
                    Timeout: {new Date(order.timeoutAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <PriceDisplay amountUsdt={order.amountUsdt} size="sm" showArs={false} />
                  <Link
                    href={`/mis-ordenes/${order.id}/tracking`}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    Cargar tracking
                  </Link>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      )}

      {/* Historial de órdenes */}
      <div>
        <h2 className="font-display font-semibold text-shopix-text mb-3">Historial de ventas</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl bg-bg-elevated animate-pulse" />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <div className="text-center py-12 text-shopix-faint">
            <p>Aún no tenés ventas</p>
          </div>
        ) : (
          <div className="space-y-2">
            {orders.map((order) => (
              <GlowCard key={order.id} className="p-4 flex items-center gap-4">
                <Badge status={order.status as OrderStatus} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-shopix-text truncate">
                    {order.product?.title}
                  </p>
                  <p className="text-xs text-shopix-faint">
                    {new Date(order.createdAt).toLocaleDateString('es-AR')}
                  </p>
                </div>
                <PriceDisplay amountUsdt={order.amountUsdt} size="sm" showArs={false} />
              </GlowCard>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

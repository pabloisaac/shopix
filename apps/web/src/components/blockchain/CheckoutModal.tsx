'use client'

import { useState, useEffect } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { getProfile } from '@/store/profileStore'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import Link from 'next/link'

interface CheckoutModalProps {
  product: {
    id: string
    title: string
    priceUsdt: string
    seller: { walletAddress: string; username?: string | null }
  }
  onClose: () => void
  onSuccess: (orderId: string) => void
}

type Step = 'shipping' | 'payment' | 'waiting' | 'done'

const EMPTY_ADDR = { name: '', street: '', city: '', province: '', zip: '', phone: '' }

export function CheckoutModal({ product, onClose, onSuccess }: CheckoutModalProps) {
  const { token } = useAuthStore()

  const [step, setStep]                   = useState<Step>('shipping')
  const [error, setError]                 = useState<string | null>(null)
  const [loading, setLoading]             = useState(false)

  // Datos del comprador — pre-llenados desde perfil guardado
  const [refundAddress, setRefundAddress] = useState('')
  const [buyerEmail, setBuyerEmail]       = useState('')
  const [newAddress, setNewAddress]       = useState({ ...EMPTY_ADDR })
  const [profileLoaded, setProfileLoaded] = useState(false)

  // Pre-llenar desde perfil guardado en localStorage
  useEffect(() => {
    const p = getProfile()
    if (p.refundAddress) setRefundAddress(p.refundAddress)
    if (p.email) setBuyerEmail(p.email)
    if (p.name || p.street) {
      setNewAddress({
        name: p.name || '',
        street: p.street || '',
        city: p.city || '',
        province: p.province || '',
        zip: p.zip || '',
        phone: p.phone || '',
      })
    }
    setProfileLoaded(true)
  }, [])

  // Datos de pago generados
  const [orderId, setOrderId]             = useState<string | null>(null)
  const [depositAddress, setDepositAddress] = useState<string | null>(null)
  const [amountUsdt, setAmountUsdt]       = useState<string>(product.priceUsdt)
  const [pollCount, setPollCount]         = useState(0)

  // Polling: verificar si llegó el pago
  useEffect(() => {
    if (step !== 'waiting' || !orderId) return
    const interval = setInterval(async () => {
      try {
        const res = await api.get<{ status: string }>(`/orders/${orderId}/status`)
        if (res.status === 'active') {
          clearInterval(interval)
          setStep('done')
          onSuccess(orderId)
        }
        setPollCount(c => c + 1)
      } catch {}
    }, 10_000) // cada 10 segundos
    return () => clearInterval(interval)
  }, [step, orderId])

  function canProceedShipping() {
    if (!newAddress.name || !newAddress.street || !newAddress.city || !newAddress.province || !newAddress.zip) return false
    if (!refundAddress.match(/^0x[0-9a-fA-F]{40}$/)) return false
    if (buyerEmail && !buyerEmail.includes('@')) return false
    return true
  }

  async function handleCreateOrder() {
    setLoading(true)
    setError(null)
    try {
      const res = await api.post<{
        orderId: string
        depositAddress: string
        amountUsdt: string
      }>('/orders/checkout', {
        productId:     product.id,
        refundAddress,
        buyerEmail:    buyerEmail || undefined,
        shippingAddress: newAddress,
      }, token || undefined)

      setOrderId(res.orderId)
      setDepositAddress(res.depositAddress)
      setAmountUsdt(res.amountUsdt)
      setStep('payment')
    } catch (err: any) {
      setError(err.message || 'Error al crear la orden')
    } finally {
      setLoading(false)
    }
  }

  const qrUrl = depositAddress
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(depositAddress)}`
    : null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-bg-elevated border border-bg-border rounded-2xl overflow-hidden animate-slide-up max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bg-border sticky top-0 bg-bg-elevated z-10">
          <h2 className="font-display font-semibold text-lg">Completar compra</h2>
          <button onClick={onClose} className="text-shopix-faint hover:text-shopix-text transition-colors p-1">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4">

          {/* Resumen del producto */}
          <div className="bg-bg-secondary rounded-xl p-4">
            <p className="text-xs text-shopix-muted mb-1">Comprando</p>
            <p className="font-display font-semibold text-shopix-text">{product.title}</p>
            <div className="mt-1.5">
              <PriceDisplay amountUsdt={amountUsdt} size="lg" />
            </div>
          </div>

          {/* ── PASO 1: Dirección + datos del comprador ── */}
          {step === 'shipping' && (
            <div className="space-y-4">

              {/* Banner si el perfil no está configurado */}
              {profileLoaded && !newAddress.name && (
                <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 flex items-start gap-2 text-sm">
                  <span>💡</span>
                  <p className="text-text-muted text-xs">
                    Guardá tus datos en{' '}
                    <Link href="/mis-direcciones" className="text-accent underline" onClick={onClose}>
                      Mi Perfil
                    </Link>{' '}
                    para no tener que ingresarlos de nuevo.
                  </p>
                </div>
              )}

              {/* Dirección de envío */}
              <div>
                <p className="text-sm font-medium text-text-primary mb-2">Dirección de envío</p>
                <div className="space-y-2">
                  {(['name', 'street', 'city', 'province', 'zip', 'phone'] as const).map(f => (
                    <input key={f} className="input" value={newAddress[f]}
                      onChange={e => setNewAddress(p => ({ ...p, [f]: e.target.value }))}
                      placeholder={{ name: 'Nombre completo *', street: 'Calle y número *', city: 'Ciudad *', province: 'Provincia *', zip: 'Código postal *', phone: 'Teléfono (opcional)' }[f]}
                    />
                  ))}
                </div>
              </div>

              {/* Dirección de reembolso */}
              <div>
                <label className="text-sm font-medium text-text-primary block mb-1.5">
                  Dirección USDT para reembolsos <span className="text-red-400">*</span>
                </label>
                <input
                  className="input font-mono text-xs"
                  placeholder="0x... (Nexo, BingX, MetaMask, cualquier wallet)"
                  value={refundAddress}
                  onChange={e => setRefundAddress(e.target.value)}
                />
                <p className="text-xs text-text-faint mt-1">
                  Solo se usa si hay un reembolso. Puede ser tu Nexo, BingX u otra wallet.
                </p>
              </div>

              {/* Email (opcional) */}
              <div>
                <label className="text-sm font-medium text-text-primary block mb-1.5">
                  Email para notificaciones <span className="text-text-faint text-xs">(opcional)</span>
                </label>
                <input
                  className="input"
                  type="email"
                  placeholder="tu@email.com"
                  value={buyerEmail}
                  onChange={e => setBuyerEmail(e.target.value)}
                />
              </div>

              {error && (
                <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3 text-sm text-red-400">{error}</div>
              )}

              <button
                onClick={handleCreateOrder}
                disabled={loading || !canProceedShipping()}
                className="btn-primary w-full"
              >
                {loading ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⟳</span> Generando pago…</span> : 'Continuar →'}
              </button>
            </div>
          )}

          {/* ── PASO 2: QR de pago ── */}
          {step === 'payment' && depositAddress && (
            <div className="space-y-4">
              <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-center space-y-3">
                <p className="text-sm font-semibold text-text-primary">Transferí exactamente este monto</p>

                <div className="bg-bg-elevated rounded-xl p-3 inline-block">
                  <p className="text-3xl font-display font-bold text-accent">{amountUsdt} <span className="text-base">USDT</span></p>
                  <p className="text-xs text-shopix-faint mt-0.5">Red: Sepolia (ERC-20)</p>
                </div>

                <p className="text-xs text-shopix-muted">a esta dirección:</p>

                {/* Dirección copiable */}
                <button
                  onClick={() => navigator.clipboard.writeText(depositAddress)}
                  className="w-full bg-bg-secondary hover:bg-bg-border rounded-xl p-3 transition-colors group"
                >
                  <p className="font-mono text-xs break-all text-shopix-text group-hover:text-accent transition-colors">{depositAddress}</p>
                  <p className="text-xs text-shopix-faint mt-1 group-hover:text-accent transition-colors">📋 Tap para copiar</p>
                </button>

                {/* QR */}
                {qrUrl && (
                  <div className="flex justify-center">
                    <div className="bg-white p-2 rounded-xl inline-block">
                      <img src={qrUrl} alt="QR dirección de pago" width={160} height={160} />
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3 space-y-1.5">
                <p className="text-xs font-semibold text-yellow-800">⚠ Importante</p>
                <ul className="text-xs text-yellow-700 space-y-1 list-disc list-inside">
                  <li>Enviá <strong>exactamente {amountUsdt} USDT</strong></li>
                  <li>Solo en red <strong>Sepolia</strong> (para pruebas)</li>
                  <li>Esta dirección es válida solo para esta compra</li>
                  <li>Una vez detectado el pago, la orden se activa automáticamente</li>
                </ul>
              </div>

              <button
                onClick={() => setStep('waiting')}
                className="btn-primary w-full"
              >
                Ya transferí, verificar pago →
              </button>
            </div>
          )}

          {/* ── PASO 3: Esperando confirmación ── */}
          {step === 'waiting' && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-accent/10 flex items-center justify-center">
                <span className="text-2xl animate-spin inline-block">⟳</span>
              </div>
              <div>
                <p className="font-display font-semibold text-text-primary">Verificando tu pago…</p>
                <p className="text-sm text-shopix-muted mt-1">
                  Revisando cada 10 segundos ({pollCount} verificaciones)
                </p>
              </div>

              {depositAddress && (
                <div className="bg-bg-secondary rounded-xl p-3">
                  <p className="text-xs text-shopix-muted mb-1">Dirección de depósito</p>
                  <p className="font-mono text-xs break-all text-shopix-text">{depositAddress}</p>
                </div>
              )}

              <p className="text-xs text-shopix-faint">
                ¿Ya transferiste? Puede tomar 1-3 minutos en confirmarse en la red.
              </p>

              <button onClick={() => setStep('payment')} className="text-sm text-accent hover:underline">
                ← Volver a los datos de pago
              </button>
            </div>
          )}

          {/* ── PASO 4: Pago confirmado ── */}
          {step === 'done' && orderId && (
            <div className="space-y-4 text-center py-4">
              <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center text-3xl">
                ✅
              </div>
              <div>
                <p className="font-display font-semibold text-lg text-text-primary">¡Pago confirmado!</p>
                <p className="text-sm text-shopix-muted mt-1">
                  Los fondos están en escrow. El vendedor fue notificado.
                </p>
              </div>
              <Link href={`/mis-ordenes/${orderId}`} className="btn-primary inline-block">
                Ver mi orden →
              </Link>
            </div>
          )}

          <p className="text-xs text-shopix-faint text-center">
            Los fondos quedan en escrow hasta que confirmés la recepción o expire el timeout.
          </p>
        </div>
      </div>
    </div>
  )
}

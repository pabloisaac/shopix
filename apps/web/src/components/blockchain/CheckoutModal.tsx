'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useCreateOrder } from '@/hooks/useEscrowContract'
import { useUSDTBalance } from '@/hooks/useUSDTBalance'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { TxStatus } from '@/components/blockchain/TxStatus'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import Link from 'next/link'

interface CheckoutModalProps {
  product: {
    id: string
    title: string
    priceUsdt: string
    seller: { walletAddress: string }
  }
  onClose: () => void
  onSuccess: (orderId: string) => void
}

interface UserAddress {
  id: string
  label: string
  name: string
  street: string
  city: string
  province: string
  zip: string
  phone?: string | null
  isDefault: boolean
}

type Step = 'confirm' | 'shipping' | 'tx' | 'done'
type ShippingMode = 'saved' | 'new'

const EMPTY_ADDRESS = { name: '', street: '', city: '', province: '', zip: '', phone: '' }

export function CheckoutModal({ product, onClose, onSuccess }: CheckoutModalProps) {
  const { address } = useAccount()
  const { token } = useAuthStore()
  const { balance } = useUSDTBalance()
  const { createOrder, isPending } = useCreateOrder()

  const [step, setStep] = useState<Step>('confirm')
  const [txHash, setTxHash] = useState<`0x${string}` | undefined>()
  const [error, setError] = useState<string | null>(null)

  // Direcciones guardadas
  const [savedAddresses, setSavedAddresses] = useState<UserAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null)
  const [shippingMode, setShippingMode] = useState<ShippingMode>('saved')
  const [newAddress, setNewAddress] = useState({ ...EMPTY_ADDRESS })

  const hasEnoughUsdt = parseFloat(balance) >= parseFloat(product.priceUsdt)

  // Cargar direcciones al llegar al paso shipping
  useEffect(() => {
    if (step === 'shipping' && token) {
      setLoadingAddresses(true)
      api.get<UserAddress[]>('/users/me/addresses', token)
        .then(data => {
          setSavedAddresses(data)
          if (data.length > 0) {
            const def = data.find(a => a.isDefault) || data[0]
            setSelectedAddressId(def.id)
            setShippingMode('saved')
          } else {
            setShippingMode('new')
          }
        })
        .catch(() => setShippingMode('new'))
        .finally(() => setLoadingAddresses(false))
    }
  }, [step, token])

  function getShippingAddress() {
    if (shippingMode === 'saved' && selectedAddressId) {
      const addr = savedAddresses.find(a => a.id === selectedAddressId)
      if (addr) return { name: addr.name, street: addr.street, city: addr.city, province: addr.province, zip: addr.zip, phone: addr.phone || '' }
    }
    return newAddress
  }

  const canProceed = () => {
    if (shippingMode === 'saved') return !!selectedAddressId
    return !!newAddress.name && !!newAddress.street && !!newAddress.city && !!newAddress.province && !!newAddress.zip
  }

  async function handleBuy() {
    if (!address || !token) return
    setError(null)

    const shipping = getShippingAddress()

    try {
      const { contractParams, order } = await api.post<{
        contractParams: {
          orderId: `0x${string}`
          vendedor: `0x${string}`
          monto: string
          timeoutDias: number
        }
        order: { id: string }
      }>('/orders', {
        productId: product.id,
        shippingAddress: shipping,
        timeoutDays: 7,
      }, token)

      const { createTx } = await createOrder({
        orderId: contractParams.orderId,
        vendedor: contractParams.vendedor,
        amountUsdt: product.priceUsdt,
        timeoutDias: contractParams.timeoutDias,
        metaEvidenceHash: `0x${'0'.repeat(64)}`,
      })

      setTxHash(createTx)
      setStep('tx')

      await api.post(`/orders/${order.id}/activate`, { txHash: createTx }, token)

      onSuccess(order.id)
    } catch (err: any) {
      setError(err.message || 'Error al crear la orden')
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-md bg-bg-elevated border border-bg-border rounded-2xl overflow-hidden animate-slide-up max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-bg-border sticky top-0 bg-bg-elevated z-10">
          <h2 className="font-display font-semibold text-lg">Completar compra</h2>
          <button onClick={onClose} className="text-shopix-faint hover:text-shopix-text transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* Producto */}
          <div className="bg-bg-secondary rounded-xl p-4">
            <p className="text-sm text-shopix-muted mb-1">Comprando</p>
            <p className="font-display font-semibold text-shopix-text">{product.title}</p>
            <div className="mt-2">
              <PriceDisplay amountUsdt={product.priceUsdt} size="lg" />
            </div>
          </div>

          {/* Steps */}
          {step === 'confirm' && (
            <>
              {!hasEnoughUsdt && (
                <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3 text-sm text-red-400">
                  Saldo insuficiente. Tenés {Number(balance).toFixed(2)} USDT y necesitás {product.priceUsdt} USDT.
                </div>
              )}
              <div className="bg-bg-secondary rounded-xl p-4 text-sm text-shopix-muted space-y-2">
                <div className="flex justify-between">
                  <span>Tu saldo USDT</span>
                  <span className="font-mono text-shopix-text">{Number(balance).toFixed(2)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span>Fee de plataforma (1.5%)</span>
                  <span className="font-mono text-shopix-text">
                    {(parseFloat(product.priceUsdt) * 0.015).toFixed(2)} USDT
                  </span>
                </div>
              </div>
              <button
                onClick={() => setStep('shipping')}
                disabled={!hasEnoughUsdt || !address}
                className="btn-primary w-full"
              >
                Continuar →
              </button>
            </>
          )}

          {step === 'shipping' && (
            <>
              <p className="text-sm font-medium text-text-primary">Dirección de envío</p>

              {loadingAddresses ? (
                <div className="space-y-2">
                  {[1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-bg-secondary animate-pulse" />)}
                </div>
              ) : (
                <>
                  {/* Direcciones guardadas */}
                  {savedAddresses.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-shopix-muted uppercase tracking-wide">Guardadas</p>
                        <Link
                          href="/mis-direcciones"
                          target="_blank"
                          className="text-xs text-accent hover:underline"
                        >
                          Gestionar →
                        </Link>
                      </div>
                      {savedAddresses.map(addr => (
                        <button
                          key={addr.id}
                          type="button"
                          onClick={() => { setSelectedAddressId(addr.id); setShippingMode('saved') }}
                          className={`w-full text-left p-3 rounded-xl border transition-colors ${
                            shippingMode === 'saved' && selectedAddressId === addr.id
                              ? 'border-accent bg-accent/5'
                              : 'border-border hover:border-accent/40 bg-bg-secondary'
                          }`}
                        >
                          <div className="flex items-start gap-2">
                            <span className={`mt-0.5 w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                              shippingMode === 'saved' && selectedAddressId === addr.id
                                ? 'border-accent'
                                : 'border-shopix-muted'
                            }`}>
                              {shippingMode === 'saved' && selectedAddressId === addr.id && (
                                <span className="w-2 h-2 rounded-full bg-accent block" />
                              )}
                            </span>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="text-sm font-medium text-text-primary">{addr.label}</span>
                                {addr.isDefault && (
                                  <span className="text-xs text-accent">(predeterminada)</span>
                                )}
                              </div>
                              <p className="text-xs text-shopix-muted">{addr.name} — {addr.street}</p>
                              <p className="text-xs text-shopix-muted">{addr.city}, {addr.province} CP {addr.zip}</p>
                            </div>
                          </div>
                        </button>
                      ))}

                      {/* Toggle nueva dirección */}
                      <button
                        type="button"
                        onClick={() => setShippingMode(shippingMode === 'new' ? 'saved' : 'new')}
                        className={`w-full text-left p-3 rounded-xl border transition-colors ${
                          shippingMode === 'new'
                            ? 'border-accent bg-accent/5'
                            : 'border-dashed border-border hover:border-accent/40'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                            shippingMode === 'new' ? 'border-accent' : 'border-shopix-muted'
                          }`}>
                            {shippingMode === 'new' && <span className="w-2 h-2 rounded-full bg-accent block" />}
                          </span>
                          <span className="text-sm text-shopix-muted">Ingresar nueva dirección</span>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* Formulario nueva dirección */}
                  {(shippingMode === 'new' || savedAddresses.length === 0) && (
                    <div className="space-y-3">
                      {savedAddresses.length === 0 && (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-shopix-muted">No tenés direcciones guardadas.</p>
                          <Link href="/mis-direcciones" target="_blank" className="text-xs text-accent hover:underline">
                            Agregar →
                          </Link>
                        </div>
                      )}
                      {(['name', 'street', 'city', 'province', 'zip', 'phone'] as const).map((field) => (
                        <input
                          key={field}
                          className="input"
                          placeholder={{
                            name: 'Nombre completo *',
                            street: 'Calle y número *',
                            city: 'Ciudad *',
                            province: 'Provincia *',
                            zip: 'Código postal *',
                            phone: 'Teléfono (opcional)',
                          }[field]}
                          value={newAddress[field]}
                          onChange={(e) => setNewAddress(prev => ({ ...prev, [field]: e.target.value }))}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}

              <button
                onClick={handleBuy}
                disabled={isPending || !canProceed() || loadingAddresses}
                className="btn-primary w-full"
              >
                {isPending ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⟳</span>
                    Procesando…
                  </span>
                ) : (
                  'Aprobar USDT y confirmar compra'
                )}
              </button>
            </>
          )}

          {step === 'tx' && txHash && (
            <TxStatus hash={txHash} />
          )}

          {error && (
            <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <p className="text-xs text-shopix-faint text-center">
            Los fondos quedan en escrow hasta que confirmes la recepción del producto o expire el timeout.
          </p>
        </div>
      </div>
    </div>
  )
}

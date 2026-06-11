'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { api } from '@/lib/api'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { Badge } from '@/components/ui/Badge'
import { AddressTag } from '@/components/ui/AddressTag'
import { CheckoutModal } from '@/components/blockchain/CheckoutModal'
import { RiskBadge, RiskWarningBanner } from '@/components/ui/RiskBadge'
import { useAuthStore } from '@/store/authStore'

const IPFS_GATEWAY = 'https://gateway.pinata.cloud'

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuthStore()
  const [product, setProduct] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [selectedImage, setSelectedImage] = useState(0)
  const [showCheckout, setShowCheckout] = useState(false)

  useEffect(() => {
    api.get<any>(`/products/${id}`)
      .then(setProduct)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 animate-pulse">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="aspect-square rounded-2xl bg-bg-elevated" />
          <div className="space-y-4">
            <div className="h-8 bg-bg-elevated rounded w-3/4" />
            <div className="h-12 bg-bg-elevated rounded w-1/3" />
          </div>
        </div>
      </div>
    )
  }

  if (!product) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-16 text-center text-shopix-faint">
        Producto no encontrado
      </div>
    )
  }

  const images = product.imagesIpfs?.length
    ? product.imagesIpfs.map((cid: string) => `${IPFS_GATEWAY}/ipfs/${cid}`)
    : ['/placeholder-product.svg']

  const isOwnProduct = product.sellerId === token // simplificación

  return (
    <>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid md:grid-cols-2 gap-8 lg:gap-12">
          {/* Galería */}
          <div>
            <div className="aspect-square rounded-2xl overflow-hidden bg-bg-elevated border border-bg-border mb-3">
              <img
                src={images[selectedImage]}
                alt={product.title}
                className="w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).src = '/placeholder-product.svg' }}
              />
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {images.map((img: string, i: number) => (
                  <button
                    key={i}
                    onClick={() => setSelectedImage(i)}
                    className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                      i === selectedImage ? 'border-accent' : 'border-bg-border'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge status={product.condition} />
                <Badge status={product.category as any} className="badge bg-bg-elevated text-shopix-muted border border-bg-border capitalize" />
              </div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-shopix-text leading-tight">
                {product.title}
              </h1>
            </div>

            <PriceDisplay amountUsdt={product.priceUsdt} size="xl" showArs />

            {/* Vendedor */}
            {product.seller && (
              <div className="space-y-2">
                <div className="bg-bg-elevated rounded-xl p-4 border border-bg-border">
                  <p className="text-xs text-shopix-faint mb-2">Vendedor</p>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-shopix-text">
                          {product.seller.username || 'Anónimo'}
                        </p>
                        {(product.seller as any).riskLevel && (product.seller as any).riskLevel !== 'clean' && (
                          <RiskBadge level={(product.seller as any).riskLevel} />
                        )}
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <span className="text-yellow-400 text-xs">★</span>
                        <span className="text-xs text-shopix-muted">
                          {product.seller.reputationScore} pts · {product.seller.totalSales} ventas
                        </span>
                      </div>
                    </div>
                    <AddressTag address={product.seller.walletAddress} />
                  </div>
                </div>
                {(product.seller as any).riskLevel && (product.seller as any).riskLevel !== 'clean' && (
                  <RiskWarningBanner
                    level={(product.seller as any).riskLevel}
                    banReason={(product.seller as any).banReason}
                  />
                )}
              </div>
            )}

            {/* Descripción */}
            <div>
              <h2 className="font-display font-semibold text-sm text-shopix-muted mb-2">Descripción</h2>
              <p className="text-shopix-text text-sm leading-relaxed whitespace-pre-line">
                {product.description}
              </p>
            </div>

            {/* Stock */}
            <div className="flex items-center gap-2 text-sm">
              <span className={`w-2 h-2 rounded-full ${product.stock > 0 ? 'bg-accent' : 'bg-red-400'}`} />
              <span className="text-shopix-muted">
                {product.stock > 0 ? `${product.stock} en stock` : 'Sin stock'}
              </span>
            </div>

            {/* CTA */}
            {!isOwnProduct && product.stock > 0 && (
              <div className="space-y-3">
                {(product.seller as any)?.riskLevel === 'banned' ? (
                  <div className="text-center py-3 text-sm text-red-400 bg-red-500/5 border border-red-500/20 rounded-xl">
                    🚫 No es posible comprar — vendedor suspendido
                  </div>
                ) : (
                  <button
                    onClick={() => setShowCheckout(true)}
                    className="btn-primary w-full text-base py-4"
                  >
                    Comprar con USDT
                  </button>
                )}
              </div>
            )}

            {/* Info escrow */}
            <div className="bg-accent/5 border border-accent/15 rounded-xl p-4 text-sm">
              <p className="text-accent font-medium mb-1">🔒 Compra protegida por escrow</p>
              <p className="text-shopix-muted text-xs leading-relaxed">
                Tus USDT quedan en un smart contract hasta que confirmés la recepción.
                Si hay un problema, Kleros resuelve la disputa.
              </p>
            </div>
          </div>
        </div>
      </div>

      {showCheckout && product.seller && (
        <CheckoutModal
          product={{ ...product, seller: product.seller }}
          onClose={() => setShowCheckout(false)}
          onSuccess={(orderId) => {
            setShowCheckout(false)
            window.location.href = `/mis-ordenes/${orderId}`
          }}
        />
      )}
    </>
  )
}

'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/Badge'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import { RiskBadge } from '@/components/ui/RiskBadge'

interface ProductCardProps {
  product: {
    id: string
    title: string
    priceUsdt: string
    condition: 'new' | 'used' | 'refurbished'
    category: string
    imagesIpfs: string[]
    viewsCount: number
    seller?: {
      username: string | null
      walletAddress: string
      reputationScore: number
      riskLevel?: string
    }
  }
}

const IPFS_GATEWAY = process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud'

export function ProductCard({ product }: ProductCardProps) {
  const imageUrl = product.imagesIpfs?.[0]
    ? `${IPFS_GATEWAY}/ipfs/${product.imagesIpfs[0]}`
    : '/placeholder-product.svg'

  const sellerName = product.seller?.username ||
    `${product.seller?.walletAddress.slice(0, 6)}…${product.seller?.walletAddress.slice(-4)}`

  return (
    <Link href={`/producto/${product.id}`} className="group block">
      <div className="bg-white rounded-2xl border border-bg-border shadow-card hover:shadow-card-hover hover:-translate-y-0.5 transition-all duration-200 overflow-hidden flex flex-col h-full">
        {/* Imagen */}
        <div className="relative aspect-square bg-gray-50 overflow-hidden">
          <img
            src={imageUrl}
            alt={product.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            onError={(e) => {
              (e.target as HTMLImageElement).src = '/placeholder-product.svg'
            }}
          />
          {/* Condition badge */}
          <div className="absolute top-2 left-2">
            <Badge status={product.condition} />
          </div>
          {/* Views */}
          <div className="absolute bottom-2 right-2 bg-black/40 text-white text-xs px-2 py-0.5 rounded-full backdrop-blur-sm">
            👁 {product.viewsCount}
          </div>
        </div>

        {/* Info */}
        <div className="flex flex-col flex-1 p-4 gap-2">
          <h3 className="font-semibold text-text-primary line-clamp-2 text-sm leading-snug">
            {product.title}
          </h3>

          <div className="mt-auto pt-2 border-t border-bg-border flex items-end justify-between gap-2">
            <PriceDisplay amountUsdt={product.priceUsdt} size="lg" showArs />
            <div className="flex flex-col items-end gap-0.5 shrink-0">
              {product.seller && (
                <span className="text-xs text-text-muted truncate max-w-24">
                  {sellerName}
                </span>
              )}
              {product.seller?.riskLevel && product.seller.riskLevel !== 'clean' && (
                <RiskBadge level={product.seller.riskLevel as any} />
              )}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}

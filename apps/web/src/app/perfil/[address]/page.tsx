import { AddressTag } from '@/components/ui/AddressTag'
import { GlowCard } from '@/components/ui/GlowCard'
import { ProductCard } from '@/components/product/ProductCard'

interface PageProps {
  params: { address: string }
}

async function getUser(address: string) {
  try {
    const res = await fetch(
      `${process.env.API_URL || 'http://localhost:3001'}/users/${address}`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

export default async function PerfilPage({ params }: PageProps) {
  const user = await getUser(params.address)

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-cripex-faint">
        Usuario no encontrado
      </div>
    )
  }

  const avgRating = user.reviewsReceived?.length
    ? user.reviewsReceived.reduce((sum: number, r: any) => sum + r.rating, 0) / user.reviewsReceived.length
    : null

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
      {/* Header */}
      <GlowCard className="p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-accent flex items-center justify-center text-bg-primary text-2xl font-bold font-display">
            {(user.username || user.walletAddress)[0].toUpperCase()}
          </div>
          <div>
            <h1 className="text-xl font-display font-bold text-cripex-text">
              {user.username || 'Anónimo'}
            </h1>
            <AddressTag address={user.walletAddress} className="mt-1" />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-6">
          {[
            { label: 'Ventas', value: user.totalSales },
            { label: 'Compras', value: user.totalPurchases },
            { label: 'Rating', value: avgRating ? `★ ${avgRating.toFixed(1)}` : '—' },
          ].map((stat) => (
            <div key={stat.label} className="text-center bg-bg-secondary rounded-xl p-3">
              <p className="text-lg font-display font-bold text-accent">{stat.value}</p>
              <p className="text-xs text-cripex-faint mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      </GlowCard>

      {/* Productos activos */}
      {user.products?.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-cripex-text mb-4">
            Productos ({user.products.length})
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {user.products.map((product: any) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      )}

      {/* Reseñas */}
      {user.reviewsReceived?.length > 0 && (
        <div>
          <h2 className="font-display font-semibold text-cripex-text mb-4">
            Reseñas ({user.reviewsReceived.length})
          </h2>
          <div className="space-y-3">
            {user.reviewsReceived.map((review: any) => (
              <GlowCard key={review.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex text-yellow-400 text-sm">
                    {'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-cripex-text">{review.comment || 'Sin comentario'}</p>
                    <p className="text-xs text-cripex-faint mt-1">
                      Por {review.reviewer?.username || review.reviewer?.walletAddress?.slice(0, 10) + '…'} ·{' '}
                      {new Date(review.createdAt).toLocaleDateString('es-AR')}
                    </p>
                  </div>
                </div>
              </GlowCard>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

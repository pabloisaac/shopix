import Link from 'next/link'
import { ProductCard } from '@/components/product/ProductCard'
import { ShopixLogo } from '@/components/ui/ShopixLogo'

async function getFeaturedProducts() {
  try {
    const res = await fetch(
      `${process.env.API_URL || 'http://localhost:3002'}/products?limit=8&orderBy=views`,
      { next: { revalidate: 60 } }
    )
    if (!res.ok) return []
    const data = await res.json()
    return data.data || []
  } catch { return [] }
}

export default async function HomePage() {
  const featuredProducts = await getFeaturedProducts()

  return (
    <div>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-hero-gradient border-b border-bg-border">
        {/* Orbes de fondo con los colores del logo */}
        <div className="absolute top-[-80px] left-[-80px] w-72 h-72 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="absolute top-[-40px] right-[-60px] w-64 h-64 rounded-full bg-secondary/10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-[-60px] left-1/2 -translate-x-1/2 w-96 h-40 rounded-full bg-accent/6 blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 relative z-10">
          <div className="max-w-3xl mx-auto text-center">

            {/* Logo hero */}
            <div className="flex justify-center mb-5">
              <ShopixLogo size={68} showText showTagline />
            </div>

            {/* Pill */}
            <div className="brand-pill mb-7 mx-auto w-fit">
              <span className="w-2 h-2 rounded-full bg-accent animate-pulse-slow" />
              Marketplace P2P · Escrow blockchain · Kleros
            </div>

            {/* Headline */}
            <h1 className="text-4xl md:text-5xl font-display font-bold text-text-primary leading-tight mb-5">
              Comprá y vendé con{' '}
              <span className="text-brand-gradient">USDT</span>
              {' '}sin intermediarios
            </h1>

            <p className="text-lg text-text-muted max-w-xl mx-auto mb-8 leading-relaxed">
              Los fondos quedan en un smart contract público hasta que confirmás la recepción.
              Sin custodia. Sin banco. Con arbitraje descentralizado.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/marketplace" className="btn-primary text-base px-7 py-3">
                Explorar productos →
              </Link>
              <Link href="/vender" className="btn-secondary text-base px-7 py-3">
                Publicar gratis
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="mt-14 grid grid-cols-3 gap-4 max-w-md mx-auto">
            {[
              { label: 'Productos activos', value: '1.2K+', color: 'text-accent' },
              { label: 'Volumen USDT',       value: '$240K', color: 'text-brand-gradient' },
              { label: 'Operaciones',         value: '3.4K+', color: 'text-secondary' },
            ].map((stat) => (
              <div key={stat.label}
                className="text-center bg-white/80 backdrop-blur-sm rounded-2xl p-4 border border-bg-border shadow-card">
                <p className={`text-2xl font-display font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-text-muted mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Categorías ────────────────────────────────────────── */}
      <section className="bg-white border-b border-bg-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {[
              { label: 'Todo',        icon: '🛍️', href: '/marketplace' },
              { label: 'Electrónica', icon: '📱', href: '/marketplace?category=electronics' },
              { label: 'Ropa',        icon: '👕', href: '/marketplace?category=clothing' },
              { label: 'Hogar',       icon: '🏠', href: '/marketplace?category=home' },
              { label: 'Servicios',   icon: '🛠️', href: '/marketplace?category=services' },
              { label: 'Otros',       icon: '📦', href: '/marketplace?category=other' },
            ].map((cat) => (
              <Link
                key={cat.label}
                href={cat.href}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-bg-border bg-bg-primary
                           hover:border-accent hover:bg-accent-light hover:text-accent
                           text-sm font-medium text-text-secondary whitespace-nowrap shrink-0 transition-all"
              >
                <span>{cat.icon}</span>{cat.label}
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ── Productos ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-bold text-text-primary">Productos destacados</h2>
          <Link href="/marketplace"
            className="text-sm font-semibold text-accent hover:text-accent-dim transition-colors">
            Ver todos →
          </Link>
        </div>

        {featuredProducts.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {featuredProducts.map((p: any) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="text-center py-16 bg-white rounded-2xl border border-bg-border">
            <p className="text-4xl mb-3">🛍️</p>
            <p className="text-text-muted font-medium mb-1">Aún no hay productos</p>
            <p className="text-sm text-text-faint mb-5">¡Sé el primero en vender en Shopix!</p>
            <Link href="/vender" className="btn-primary">Publicar ahora →</Link>
          </div>
        )}
      </section>

      {/* ── Cómo funciona ─────────────────────────────────────── */}
      <section className="bg-white border-t border-b border-bg-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
          <div className="text-center mb-10">
            <h2 className="text-xl font-display font-bold text-text-primary mb-2">¿Cómo funciona?</h2>
            <p className="text-text-muted text-sm">Simple, seguro, sin intermediarios.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                icon: '📦',
                step: '01',
                title: 'Comprá sin registrarte',
                desc: 'Sin wallet ni cuenta. Transferí USDT desde Nexo, BingX o cualquier exchange directamente.',
                iconBg: 'bg-accent-light',
                iconColor: 'text-accent-dim',
                stepColor: 'text-accent',
              },
              {
                icon: '🔐',
                step: '02',
                title: 'Fondos en escrow',
                desc: 'Los USDT quedan bloqueados en un smart contract público. Nadie los toca hasta que confirmás la recepción.',
                iconBg: 'bg-secondary-light',
                iconColor: 'text-secondary',
                stepColor: 'text-secondary',
              },
              {
                icon: '✅',
                step: '03',
                title: 'Confirmás y cobrás',
                desc: 'Al confirmar, los fondos van directo a tu Nexo o BingX. ¿Problema? Kleros arbitra con jurados anónimos.',
                iconBg: 'bg-accent-light',
                iconColor: 'text-accent-dim',
                stepColor: 'text-accent',
              },
            ].map((item) => (
              <div key={item.step}
                className="flex gap-4 p-5 rounded-2xl border border-bg-border hover:shadow-card-hover transition-all group">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${item.iconBg} ${item.iconColor} group-hover:scale-110 transition-transform`}>
                  {item.icon}
                </div>
                <div>
                  <span className={`text-xs font-mono font-bold ${item.stepColor}`}>{item.step}</span>
                  <h3 className="font-semibold text-text-primary mt-0.5 mb-1">{item.title}</h3>
                  <p className="text-sm text-text-muted leading-relaxed">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ─────────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="relative overflow-hidden rounded-3xl p-8 md:p-12 bg-brand-gradient text-white">
          {/* Orbes internos */}
          <div className="absolute top-[-40px] right-[-40px] w-48 h-48 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute bottom-[-30px] left-[-30px] w-40 h-40 rounded-full bg-white/10 blur-2xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="max-w-xl">
              <h2 className="text-2xl font-display font-bold mb-3">
                Tus USDT, siempre bajo tu control
              </h2>
              <p className="text-white/80 text-sm leading-relaxed">
                Shopix nunca toca tus fondos. Cada transacción usa un contrato auditado en Polygon.
                Si surge una disputa, <strong className="text-white">Kleros</strong> — arbitraje
                descentralizado — decide de forma transparente.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 shrink-0">
              <a href="https://kleros.io" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-white/15 hover:bg-white/25 border border-white/30 text-white font-semibold text-sm transition-all whitespace-nowrap">
                Conocer Kleros →
              </a>
              <Link href="/marketplace"
                className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl bg-white text-accent font-semibold text-sm hover:bg-white/90 transition-all shadow-sm whitespace-nowrap">
                Empezar a comprar →
              </Link>
            </div>
          </div>
        </div>
      </section>

    </div>
  )
}

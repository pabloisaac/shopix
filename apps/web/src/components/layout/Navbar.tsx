'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { clsx } from 'clsx'
import { WalletButton } from '@/components/blockchain/WalletButton'
import { useAuthStore } from '@/store/authStore'
import { ShopixLogo } from '@/components/ui/ShopixLogo'

const NAV_LINKS = [
  { href: '/marketplace',     label: 'Marketplace' },
  { href: '/vender',          label: 'Vender' },
  { href: '/mis-ordenes',     label: 'Mis Órdenes' },
  { href: '/mis-direcciones', label: 'Mis Direcciones' },
]

export function Navbar() {
  const pathname = usePathname()
  const { user } = useAuthStore()
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'

  return (
    <header className="shopix-nav sticky top-0 z-50 bg-white relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* Logo */}
          <Link href="/" className="hover:opacity-85 transition-opacity">
            <ShopixLogo size={33} showText />
          </Link>

          {/* Nav */}
          <nav className="hidden md:flex items-center gap-0.5">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  pathname === link.href
                    ? 'text-accent bg-accent-light font-semibold'
                    : 'text-text-muted hover:text-text-primary hover:bg-gray-100'
                )}
              >
                {link.label}
              </Link>
            ))}
            {user && (
              <Link
                href="/dashboard/vendedor"
                className={clsx(
                  'px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                  pathname === '/dashboard/vendedor'
                    ? 'text-secondary bg-secondary-light font-semibold'
                    : 'text-text-muted hover:text-text-primary hover:bg-gray-100'
                )}
              >
                Dashboard
              </Link>
            )}
            {isDev && (
              <Link
                href="/dev"
                className={clsx(
                  'ml-2 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all',
                  pathname === '/dev'
                    ? 'bg-yellow-50 text-yellow-700 border-yellow-300'
                    : 'text-yellow-600 border-yellow-200 hover:bg-yellow-50'
                )}
              >
                🧪 Dev
              </Link>
            )}
          </nav>

          {/* Wallet */}
          <WalletButton />
        </div>
      </div>

      {/* Línea gradiente teal→índigo debajo del navbar */}
      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-brand-gradient opacity-50" />
    </header>
  )
}

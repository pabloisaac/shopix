import type { Metadata } from 'next'
import './globals.css'
import { Providers } from './providers'
import { Navbar } from '@/components/layout/Navbar'

export const metadata: Metadata = {
  title: 'Cripex — Marketplace P2P con USDT',
  description: 'Comprá y vendé con USDT. Escrow en smart contract, arbitraje descentralizado por Kleros.',
  openGraph: {
    title: 'Cripex — Marketplace P2P con USDT',
    description: 'Comprá y vendé con USDT. Sin bancos. Sin intermediarios.',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className="dark">
      <body>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <footer className="border-t border-bg-border mt-20">
            <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-shopix-faint">
              <span>© 2025 Cripex · Marketplace P2P con USDT</span>
              <div className="flex items-center gap-4">
                <a href="#" className="hover:text-shopix-muted transition-colors">Términos</a>
                <a href="#" className="hover:text-shopix-muted transition-colors">Privacidad</a>
                <a href="https://kleros.io" target="_blank" rel="noopener noreferrer" className="hover:text-shopix-muted transition-colors">
                  Árbitro: Kleros
                </a>
              </div>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  )
}

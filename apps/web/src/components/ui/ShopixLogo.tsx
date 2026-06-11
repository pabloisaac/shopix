import { clsx } from 'clsx'

interface ShopixLogoProps {
  size?: number
  showText?: boolean
  showTagline?: boolean
  className?: string
  variant?: 'color' | 'white' | 'mono'
}

/**
 * Shopix Logo — "The Exchange Diamond"
 *
 * Concepto: 4 nodos dispuestos en diamante (comprador, vendedor, escrow, plataforma)
 * unidos por líneas de gradiente formando una red P2P de confianza.
 * Las 2 diagonales que se cruzan en el centro simbolizan el intercambio bidireccional.
 * Inspirado en la estética crypto/Web3 (Kleros, Uniswap, ENS).
 */
export function ShopixLogo({
  size = 36,
  showText = true,
  showTagline = false,
  className,
  variant = 'color',
}: ShopixLogoProps) {
  const isWhite = variant === 'white'
  const isMono  = variant === 'mono'

  const textColor    = isWhite ? 'text-white' : 'text-[#0F172A]'
  const taglineColor = isWhite ? 'text-white/55' : 'text-[#64748B]'

  // Colores base según variante
  const c1 = isMono ? '#475569' : '#00C896'   // teal
  const c2 = isMono ? '#1E293B' : '#6366F1'   // indigo
  const c3 = isMono ? '#64748B' : '#00D4A8'   // teal claro
  const c4 = isMono ? '#334155' : '#818CF8'   // indigo claro
  const nodeFill = isWhite ? 'rgba(255,255,255,0.9)' : undefined
  const lineStroke = isWhite ? 'rgba(255,255,255,0.55)' : undefined

  return (
    <div className={clsx('inline-flex flex-col', className)}>
      <div className="flex items-center gap-2.5">

        {/* ── Ícono: diamante de 4 nodos ──────────────────── */}
        <svg
          width={size}
          height={size}
          viewBox="0 0 200 200"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradientes para cada línea del diamante */}
            <linearGradient id="gTop"    x1="100" y1="22"  x2="178" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={c2} />
              <stop offset="100%" stopColor={c1} />
            </linearGradient>
            <linearGradient id="gRight"  x1="178" y1="100" x2="100" y2="178" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={c1} />
              <stop offset="100%" stopColor={c3} />
            </linearGradient>
            <linearGradient id="gBottom" x1="100" y1="178" x2="22"  y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={c3} />
              <stop offset="100%" stopColor={c4} />
            </linearGradient>
            <linearGradient id="gLeft"   x1="22"  y1="100" x2="100" y2="22"  gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={c4} />
              <stop offset="100%" stopColor={c2} />
            </linearGradient>
            {/* Diagonal: comprador (izq) → vendedor (der) */}
            <linearGradient id="gDiagH"  x1="22"  y1="100" x2="178" y2="100" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={c4} stopOpacity="0.6" />
              <stop offset="100%" stopColor={c1} stopOpacity="0.6" />
            </linearGradient>
            {/* Diagonal: escrow (top) → plataforma (bottom) */}
            <linearGradient id="gDiagV"  x1="100" y1="22"  x2="100" y2="178" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={c2} stopOpacity="0.45" />
              <stop offset="100%" stopColor={c3} stopOpacity="0.45" />
            </linearGradient>

            {/* Glow para nodos */}
            <filter id="fGlow" x="-80%" y="-80%" width="360%" height="360%">
              <feGaussianBlur stdDeviation="4" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            {/* Glow suave para el centro */}
            <filter id="fCenter" x="-150%" y="-150%" width="400%" height="400%">
              <feGaussianBlur stdDeviation="6" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* ── Diagonales internas (X = intercambio) ─────── */}
          <line
            x1="22" y1="100" x2="178" y2="100"
            stroke={lineStroke ?? 'url(#gDiagH)'}
            strokeWidth="2"
            strokeDasharray="5 6"
          />
          <line
            x1="100" y1="22" x2="100" y2="178"
            stroke={lineStroke ?? 'url(#gDiagV)'}
            strokeWidth="2"
            strokeDasharray="5 6"
          />

          {/* ── 4 lados del diamante ─────────────────────── */}
          {/* Top → Right */}
          <line x1="100" y1="22"  x2="178" y2="100"
            stroke={lineStroke ?? 'url(#gTop)'}    strokeWidth="3.5" strokeLinecap="round" />
          {/* Right → Bottom */}
          <line x1="178" y1="100" x2="100" y2="178"
            stroke={lineStroke ?? 'url(#gRight)'}  strokeWidth="3.5" strokeLinecap="round" />
          {/* Bottom → Left */}
          <line x1="100" y1="178" x2="22"  y2="100"
            stroke={lineStroke ?? 'url(#gBottom)'} strokeWidth="3.5" strokeLinecap="round" />
          {/* Left → Top */}
          <line x1="22"  y1="100" x2="100" y2="22"
            stroke={lineStroke ?? 'url(#gLeft)'}   strokeWidth="3.5" strokeLinecap="round" />

          {/* ── Nodo central (el escrow / punto de confianza) */}
          <g filter="url(#fCenter)">
            <circle cx="100" cy="100" r="10"
              fill={isWhite ? 'rgba(255,255,255,0.12)' : `rgba(99,102,241,0.15)`} />
            <circle cx="100" cy="100" r="6"
              fill={isWhite ? 'rgba(255,255,255,0.5)' : `rgba(99,102,241,0.4)`} />
            <circle cx="100" cy="100" r="3.5"
              fill={nodeFill ?? c2} />
          </g>

          {/* ── Nodo TOP — Escrow/Arbitraje (indigo) ─────── */}
          <g filter="url(#fGlow)">
            <circle cx="100" cy="22" r="12"
              fill={isWhite ? 'rgba(255,255,255,0.1)' : 'rgba(99,102,241,0.18)'} />
            <circle cx="100" cy="22" r="7.5"
              fill={nodeFill ?? c2} />
            <circle cx="100" cy="22" r="3.5"
              fill="white" opacity={isWhite ? 0.9 : 0.95} />
          </g>

          {/* ── Nodo RIGHT — Vendedor (teal) ─────────────── */}
          <g filter="url(#fGlow)">
            <circle cx="178" cy="100" r="12"
              fill={isWhite ? 'rgba(255,255,255,0.1)' : 'rgba(0,200,150,0.18)'} />
            <circle cx="178" cy="100" r="7.5"
              fill={nodeFill ?? c1} />
            <circle cx="178" cy="100" r="3.5"
              fill="white" opacity={isWhite ? 0.9 : 0.95} />
          </g>

          {/* ── Nodo BOTTOM — Confirmación/Plataforma ──────── */}
          <g filter="url(#fGlow)">
            <circle cx="100" cy="178" r="12"
              fill={isWhite ? 'rgba(255,255,255,0.1)' : 'rgba(0,212,168,0.18)'} />
            <circle cx="100" cy="178" r="7.5"
              fill={nodeFill ?? c3} />
            <circle cx="100" cy="178" r="3.5"
              fill="white" opacity={isWhite ? 0.9 : 0.95} />
          </g>

          {/* ── Nodo LEFT — Comprador (indigo claro) ────────── */}
          <g filter="url(#fGlow)">
            <circle cx="22" cy="100" r="12"
              fill={isWhite ? 'rgba(255,255,255,0.1)' : 'rgba(129,140,248,0.18)'} />
            <circle cx="22" cy="100" r="7.5"
              fill={nodeFill ?? c4} />
            <circle cx="22" cy="100" r="3.5"
              fill="white" opacity={isWhite ? 0.9 : 0.95} />
          </g>

        </svg>

        {/* ── Wordmark ──────────────────────────────────── */}
        {showText && (
          <span
            className={clsx('font-display font-bold tracking-tight leading-none', textColor)}
            style={{ fontSize: size * 0.62 }}
          >
            Shop<span style={{ color: isMono ? 'inherit' : (isWhite ? 'rgba(255,255,255,0.65)' : c2) }}>ix</span>
          </span>
        )}
      </div>

      {/* ── Slogan ──────────────────────────────────────── */}
      {showTagline && (
        <p
          className={clsx('font-medium mt-1.5 tracking-wide', taglineColor)}
          style={{ fontSize: size * 0.27 }}
        >
          Comprá seguro, cobrá seguro.
        </p>
      )}
    </div>
  )
}

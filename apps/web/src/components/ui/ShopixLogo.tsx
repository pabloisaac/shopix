import { clsx } from 'clsx'

interface ShopixLogoProps {
  size?: number
  showText?: boolean
  showTagline?: boolean
  className?: string
  variant?: 'color' | 'white' | 'mono'
}

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

  // Relación de aspecto del icono: 200 × 215
  const h = size * (215 / 200)

  return (
    <div className={clsx('inline-flex flex-col', className)}>
      <div className="flex items-center gap-2.5">

        {/* ── Ícono ─────────────────────────────────────── */}
        <svg
          width={size}
          height={h}
          viewBox="0 0 200 215"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            {/* Gradiente principal: teal → índigo */}
            <linearGradient id="gMain" x1="0" y1="0" x2="200" y2="215" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={isMono ? '#334155' : '#00C896'} />
              <stop offset="100%" stopColor={isMono ? '#0F172A' : '#6366F1'} />
            </linearGradient>

            {/* Gradiente asa: opuesto para contraste */}
            <linearGradient id="gHandle" x1="72" y1="82" x2="128" y2="20" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor={isMono ? '#475569' : '#00D4A8'} />
              <stop offset="100%" stopColor={isMono ? '#1E293B' : '#818CF8'} />
            </linearGradient>

            {/* Sombra suave para el body */}
            <filter id="fShadow" x="-8%" y="-4%" width="116%" height="116%">
              <feDropShadow dx="0" dy="4" stdDeviation="6"
                flood-color={isMono ? '#000' : '#6366F1'} flood-opacity="0.18" />
            </filter>

            {/* Glow para los nodos del asa */}
            <filter id="fGlow" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur stdDeviation="3.5" result="blur"/>
              <feMerge>
                <feMergeNode in="blur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>

            {/* Clip del body de la bolsa */}
            <clipPath id="bagClip">
              <path d="M38 88 Q38 80 46 80 L154 80 Q162 80 162 88 L174 190 Q175 200 165 200 L35 200 Q25 200 26 190 Z" />
            </clipPath>
          </defs>

          {/* ── Asa de la bolsa ──────────────────────────── */}
          {/* Arco principal del asa */}
          <path
            d="M72 82 C72 32 128 32 128 82"
            stroke={isWhite ? 'rgba(255,255,255,0.7)' : 'url(#gHandle)'}
            strokeWidth="10"
            strokeLinecap="round"
            fill="none"
          />

          {/* Nodo izquierdo del asa (comprador) */}
          <g filter="url(#fGlow)">
            <circle cx="72" cy="82" r="11"
              fill={isWhite ? 'rgba(255,255,255,0.18)' : 'rgba(0,200,150,0.22)'} />
            <circle cx="72" cy="82" r="7"
              fill={isWhite ? 'white' : '#00C896'} />
            <circle cx="72" cy="82" r="3"
              fill={isWhite ? 'rgba(0,200,150,0.9)' : 'white'} />
          </g>

          {/* Nodo derecho del asa (vendedor) */}
          <g filter="url(#fGlow)">
            <circle cx="128" cy="82" r="11"
              fill={isWhite ? 'rgba(255,255,255,0.18)' : 'rgba(99,102,241,0.22)'} />
            <circle cx="128" cy="82" r="7"
              fill={isWhite ? 'white' : '#6366F1'} />
            <circle cx="128" cy="82" r="3"
              fill={isWhite ? 'rgba(99,102,241,0.9)' : 'white'} />
          </g>

          {/* Línea punteada entre nodos (conexión P2P) */}
          <line
            x1="79" y1="82" x2="121" y2="82"
            stroke={isWhite ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.5)'}
            strokeWidth="1.5"
            strokeDasharray="3 4"
          />

          {/* ── Cuerpo de la bolsa ───────────────────────── */}
          <path
            d="M38 88 Q38 80 46 80 L154 80 Q162 80 162 88 L174 190 Q175 200 165 200 L35 200 Q25 200 26 190 Z"
            fill={isWhite ? 'rgba(255,255,255,0.15)' : 'url(#gMain)'}
            stroke={isWhite ? 'rgba(255,255,255,0.35)' : 'none'}
            strokeWidth={isWhite ? 1.5 : 0}
            filter="url(#fShadow)"
          />

          {/* ── Detalle interior: flechas ↑↓ (compra/venta) ── */}
          <g clipPath="url(#bagClip)" opacity="0.22">
            <rect x="38" y="80" width="124" height="122" fill="white" opacity="0.06" rx="4"/>
          </g>

          {/* Flecha arriba (comprar) */}
          <path
            d="M88 132 L100 116 L112 132"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.9"
          />
          <line x1="100" y1="116" x2="100" y2="148"
            stroke="white" strokeWidth="5" strokeLinecap="round" opacity="0.9"/>

          {/* Separador horizontal sutil */}
          <line x1="60" y1="162" x2="140" y2="162"
            stroke="white" strokeWidth="1" opacity="0.2"/>

          {/* Flecha abajo (vender) */}
          <path
            d="M88 168 L100 184 L112 168"
            stroke="white"
            strokeWidth="5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
            opacity="0.55"
          />

        </svg>

        {/* ── Wordmark ──────────────────────────────────── */}
        {showText && (
          <div className="flex flex-col leading-none">
            <span
              className={clsx('font-display font-bold tracking-tight', textColor)}
              style={{ fontSize: size * 0.62 }}
            >
              Shop<span style={{ color: isMono ? 'inherit' : (isWhite ? 'rgba(255,255,255,0.7)' : '#6366F1') }}>ix</span>
            </span>
          </div>
        )}
      </div>

      {/* ── Slogan ────────────────────────────────────────── */}
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

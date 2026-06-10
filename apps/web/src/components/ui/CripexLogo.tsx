import { clsx } from 'clsx'

interface CripexLogoProps {
  size?: number
  showText?: boolean
  showTagline?: boolean
  className?: string
  variant?: 'color' | 'white' | 'dark'
}

export function CripexLogo({
  size = 36,
  showText = true,
  showTagline = false,
  className,
  variant = 'color',
}: CripexLogoProps) {
  const textColor = variant === 'white' ? 'text-white' : 'text-text-primary'
  const taglineColor = variant === 'white' ? 'text-white/60' : 'text-text-muted'

  // Nodos que forman la C — 9 puntos en curva abierta
  const nodes = [
    { x: 148, y: 58,  r: 7   },  // 0 - top right (open end)
    { x: 108, y: 30,  r: 9   },  // 1 - top center
    { x: 66,  y: 42,  r: 7   },  // 2 - top left
    { x: 38,  y: 72,  r: 6   },  // 3 - left upper
    { x: 28,  y: 110, r: 11  },  // 4 - left middle (nodo principal)
    { x: 38,  y: 148, r: 6   },  // 5 - left lower
    { x: 66,  y: 178, r: 7   },  // 6 - bottom left
    { x: 108, y: 190, r: 9   },  // 7 - bottom center
    { x: 148, y: 162, r: 7   },  // 8 - bottom right (open end)
  ]

  // Conexiones entre nodos adyacentes
  const edges = [
    [0,1],[1,2],[2,3],[3,4],[4,5],[5,6],[6,7],[7,8]
  ]

  // Conexiones cruzadas secundarias para efecto red
  const secondaryEdges = [
    [0,2],[1,3],[2,4],[3,5],[4,6],[5,7],[6,8]
  ]

  // Gradiente de colores por posición (top=teal, medio=verde, bottom=índigo)
  const nodeColors = [
    '#00C896', // 0
    '#00D4A0', // 1
    '#00C896', // 2
    '#2DC4A0', // 3
    '#6366F1', // 4  — nodo central, color diferente
    '#4F9EE8', // 5
    '#6366F1', // 6
    '#7C6BF0', // 7
    '#8B5CF6', // 8
  ]

  const whiteOpacity = variant === 'white' ? 0.9 : 1

  return (
    <div className={clsx('flex flex-col', className)}>
      <div className="flex items-center gap-2.5">
        <svg
          width={size}
          height={size}
          viewBox="0 0 176 220"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <linearGradient id="lg-main" x1="148" y1="58" x2="148" y2="162" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#00C896" />
              <stop offset="50%"  stopColor="#6366F1" />
              <stop offset="100%" stopColor="#8B5CF6" />
            </linearGradient>
            <linearGradient id="lg-sec" x1="0" y1="0" x2="176" y2="220" gradientUnits="userSpaceOnUse">
              <stop offset="0%"   stopColor="#00C896" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#6366F1" stopOpacity="0.15" />
            </linearGradient>
            {/* Glows por nodo */}
            <filter id="glow-node" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="3" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
            <filter id="glow-center" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="5" result="blur"/>
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* ── Aristas secundarias (más tenues, fondo de red) ── */}
          {secondaryEdges.map(([a, b], i) => (
            <line
              key={`s${i}`}
              x1={nodes[a].x} y1={nodes[a].y}
              x2={nodes[b].x} y2={nodes[b].y}
              stroke={variant === 'white' ? 'rgba(255,255,255,0.10)' : 'url(#lg-main)'}
              strokeWidth="1"
              strokeOpacity="0.25"
              strokeDasharray="2 4"
            />
          ))}

          {/* ── Aristas principales ── */}
          {edges.map(([a, b], i) => (
            <line
              key={`e${i}`}
              x1={nodes[a].x} y1={nodes[a].y}
              x2={nodes[b].x} y2={nodes[b].y}
              stroke={variant === 'white' ? 'rgba(255,255,255,0.45)' : 'url(#lg-main)'}
              strokeWidth={variant === 'white' ? 1.5 : 2}
              strokeOpacity="0.7"
              strokeLinecap="round"
            />
          ))}

          {/* ── Nodos ── */}
          {nodes.map((n, i) => {
            const isCenter = i === 4
            const isOpen = i === 0 || i === 8  // extremos abiertos de la C
            const color = variant === 'white' ? 'white' : nodeColors[i]
            const filter = isCenter ? 'url(#glow-center)' : 'url(#glow-node)'

            return (
              <g key={`n${i}`} filter={filter}>
                {/* Halo exterior */}
                <circle
                  cx={n.x} cy={n.y}
                  r={n.r + (isCenter ? 5 : isOpen ? 4 : 3)}
                  fill={color}
                  opacity={variant === 'white' ? 0.12 : 0.18}
                />
                {/* Nodo principal */}
                <circle
                  cx={n.x} cy={n.y}
                  r={n.r}
                  fill={color}
                  opacity={whiteOpacity}
                />
                {/* Punto interior blanco (tipo "ojo") en nodos grandes */}
                {(isCenter || i === 1 || i === 7) && (
                  <circle
                    cx={n.x} cy={n.y}
                    r={n.r * 0.38}
                    fill={isCenter ? (variant === 'white' ? 'rgba(255,255,255,0.8)' : '#1e1b4b') : 'white'}
                    opacity="0.85"
                  />
                )}
              </g>
            )
          })}

          {/* ── Indicador "conexión abierta" en los extremos de la C ── */}
          {/* Línea punteada que sugiere la conexión P2P pendiente */}
          <line
            x1={nodes[0].x} y1={nodes[0].y}
            x2={nodes[8].x} y2={nodes[8].y}
            stroke={variant === 'white' ? 'rgba(255,255,255,0.20)' : 'url(#lg-main)'}
            strokeWidth="1.5"
            strokeDasharray="4 5"
            strokeOpacity="0.4"
          />
        </svg>

        {showText && (
          <span
            className={clsx('font-display font-bold leading-none tracking-tight', textColor)}
            style={{ fontSize: size * 0.60 }}
          >
            Cripex
          </span>
        )}
      </div>

      {showTagline && (
        <p
          className={clsx('font-medium mt-1.5', taglineColor)}
          style={{ fontSize: size * 0.27, letterSpacing: '0.01em' }}
        >
          Comprá seguro, cobrá seguro.
        </p>
      )}
    </div>
  )
}

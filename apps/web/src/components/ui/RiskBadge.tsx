import { clsx } from 'clsx'

type RiskLevel = 'clean' | 'warning' | 'risky' | 'banned'

const CONFIG: Record<RiskLevel, { label: string; icon: string; className: string; tooltip: string }> = {
  clean: {
    label: 'Verificado',
    icon: '✓',
    className: 'bg-accent/10 text-accent border-accent/20',
    tooltip: 'Usuario sin historial de disputas',
  },
  warning: {
    label: 'Precaución',
    icon: '⚠',
    className: 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20',
    tooltip: '1 disputa perdida — operá con precaución',
  },
  risky: {
    label: 'Riesgoso',
    icon: '⛔',
    className: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    tooltip: '2+ disputas perdidas — perfil de alto riesgo',
  },
  banned: {
    label: 'Suspendido',
    icon: '🚫',
    className: 'bg-red-500/10 text-red-400 border-red-500/30',
    tooltip: 'Cuenta suspendida — no puede operar en Cripex',
  },
}

interface RiskBadgeProps {
  level: RiskLevel
  showClean?: boolean
  size?: 'sm' | 'md'
}

export function RiskBadge({ level, showClean = false, size = 'sm' }: RiskBadgeProps) {
  if (level === 'clean' && !showClean) return null

  const cfg = CONFIG[level]
  return (
    <span
      title={cfg.tooltip}
      className={clsx(
        'inline-flex items-center gap-1 rounded-full border font-medium',
        size === 'sm' ? 'text-xs px-2 py-0.5' : 'text-sm px-3 py-1',
        cfg.className
      )}
    >
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  )
}

export function RiskWarningBanner({ level, banReason }: { level: RiskLevel; banReason?: string }) {
  if (level === 'clean') return null

  const messages: Record<Exclude<RiskLevel, 'clean'>, string> = {
    warning: 'Este usuario tiene 1 disputa perdida. Operá con precaución y asegurate de tener evidencia antes de confirmar la recepción.',
    risky: 'Este usuario tiene 2 o más disputas perdidas. Es un perfil de alto riesgo. Te recomendamos no operar con él.',
    banned: `Esta cuenta está suspendida y no puede operar en Cripex.${banReason ? ` Motivo: ${banReason}` : ''}`,
  }

  const colors: Record<Exclude<RiskLevel, 'clean'>, string> = {
    warning: 'bg-yellow-400/5 border-yellow-400/20 text-yellow-300',
    risky: 'bg-orange-500/5 border-orange-500/20 text-orange-300',
    banned: 'bg-red-500/5 border-red-500/20 text-red-300',
  }

  return (
    <div className={clsx('rounded-xl border p-3 text-sm', colors[level as Exclude<RiskLevel, 'clean'>])}>
      <span className="font-semibold mr-1">
        {level === 'warning' ? '⚠' : level === 'risky' ? '⛔' : '🚫'}
      </span>
      {messages[level as Exclude<RiskLevel, 'clean'>]}
    </div>
  )
}

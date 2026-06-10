import { clsx } from 'clsx'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending_payment:    { label: 'Pago pendiente',        className: 'badge bg-yellow-50 text-yellow-700 border border-yellow-200' },
  active:             { label: 'Activo',                 className: 'badge bg-accent-light text-accent-dim border border-accent/25' },
  completed:          { label: 'Completado',             className: 'badge bg-secondary-light text-secondary border border-secondary/25' },
  disputed:           { label: 'En disputa',             className: 'badge bg-orange-50 text-orange-700 border border-orange-200' },
  return_required:    { label: 'Devolución requerida',   className: 'badge bg-amber-50 text-amber-700 border border-amber-200' },
  return_in_transit:  { label: 'Devolución en camino',   className: 'badge bg-sky-50 text-sky-700 border border-sky-200' },
  refunded:           { label: 'Reembolsado',            className: 'badge bg-secondary-light text-secondary border border-secondary/25' },
  refunded_no_return: { label: 'Reemb. sin devolución',  className: 'badge bg-red-50 text-red-700 border border-red-200' },
  // Condiciones producto
  new:                { label: 'Nuevo',                  className: 'badge bg-accent-light text-accent-dim border border-accent/25' },
  used:               { label: 'Usado',                  className: 'badge bg-gray-100 text-gray-600 border border-gray-200' },
  refurbished:        { label: 'Reacondicionado',        className: 'badge bg-secondary-light text-secondary border border-secondary/25' },
}

export function Badge({ status, className }: { status: string; className?: string }) {
  const cfg = STATUS_CONFIG[status] || { label: status, className: 'badge bg-gray-100 text-gray-600 border border-gray-200' }
  return <span className={clsx(cfg.className, className)}>{cfg.label}</span>
}

const DOT_COLORS: Record<string, string> = {
  pending_payment:    'bg-yellow-400',
  active:             'bg-accent',
  completed:          'bg-secondary',
  disputed:           'bg-orange-500',
  return_required:    'bg-amber-500',
  return_in_transit:  'bg-sky-500',
  refunded:           'bg-secondary',
  refunded_no_return: 'bg-red-500',
}

export function StatusDot({ status }: { status: string }) {
  return <span className={clsx('inline-block w-2 h-2 rounded-full', DOT_COLORS[status] || 'bg-gray-400')} />
}

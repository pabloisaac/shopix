import { clsx } from 'clsx'

interface TrackingEvent {
  label: string
  description?: string
  date?: string | Date
  completed: boolean
  active?: boolean
}

interface TrackingTimelineProps {
  events: TrackingEvent[]
}

export function TrackingTimeline({ events }: TrackingTimelineProps) {
  return (
    <div className="relative">
      {events.map((event, i) => (
        <div key={i} className="flex gap-4 pb-6 last:pb-0">
          {/* Línea vertical */}
          <div className="flex flex-col items-center">
            <div
              className={clsx(
                'w-3 h-3 rounded-full border-2 flex-shrink-0 mt-1',
                event.completed
                  ? 'bg-accent border-accent'
                  : event.active
                  ? 'bg-transparent border-accent animate-pulse'
                  : 'bg-transparent border-bg-border'
              )}
            />
            {i < events.length - 1 && (
              <div
                className={clsx(
                  'w-px flex-1 mt-2',
                  event.completed ? 'bg-accent/40' : 'bg-bg-border'
                )}
              />
            )}
          </div>

          {/* Contenido */}
          <div className={clsx('pb-0', event.completed || event.active ? 'opacity-100' : 'opacity-40')}>
            <p
              className={clsx(
                'text-sm font-medium font-display',
                event.completed || event.active ? 'text-shopix-text' : 'text-shopix-faint'
              )}
            >
              {event.label}
            </p>
            {event.description && (
              <p className="text-xs text-shopix-muted mt-0.5">{event.description}</p>
            )}
            {event.date && (
              <p className="text-xs text-shopix-faint mt-0.5">
                {new Date(event.date).toLocaleDateString('es-AR', {
                  day: '2-digit',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

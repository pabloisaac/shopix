'use client'

import { clsx } from 'clsx'
import type { DisputeStatus } from '@shopix/shared'

const KLEROS_PHASES: { key: DisputeStatus; label: string; description: string }[] = [
  {
    key: 'pending',
    label: 'Disputa iniciada',
    description: 'La disputa fue enviada a Kleros y está esperando ser asignada.',
  },
  {
    key: 'evidence',
    label: 'Período de evidencia',
    description: 'Ambas partes pueden subir evidencias y documentos.',
  },
  {
    key: 'commit',
    label: 'Período de voto secreto',
    description: 'Los jurados registran su voto de forma cifrada.',
  },
  {
    key: 'vote',
    label: 'Revelación de votos',
    description: 'Los votos se revelan y se contabilizan.',
  },
  {
    key: 'appeal',
    label: 'Período de apelación',
    description: 'Cualquiera de las partes puede apelar el fallo.',
  },
  {
    key: 'resolved',
    label: 'Resuelto',
    description: 'Kleros emitió el fallo final y los fondos fueron liberados.',
  },
]

const STATUS_ORDER = KLEROS_PHASES.map(p => p.key)

interface DisputeTimelineProps {
  status: DisputeStatus
  klerosDisputeId?: number | null
  ruling?: number | null
}

export function DisputeTimeline({ status, klerosDisputeId, ruling }: DisputeTimelineProps) {
  const currentIndex = STATUS_ORDER.indexOf(status)

  return (
    <div className="space-y-4">
      {klerosDisputeId && (
        <div className="flex items-center gap-2 text-sm">
          <span className="text-shopix-muted">Caso Kleros #</span>
          <a
            href={`https://court.kleros.io/cases/${klerosDisputeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-secondary hover:text-secondary-dim underline transition-colors"
          >
            {klerosDisputeId}
          </a>
          <span className="text-shopix-faint">↗</span>
        </div>
      )}

      <div className="relative">
        {KLEROS_PHASES.map((phase, i) => {
          const isDone = i < currentIndex
          const isActive = i === currentIndex
          const isFuture = i > currentIndex

          return (
            <div key={phase.key} className="flex gap-4 pb-6 last:pb-0">
              <div className="flex flex-col items-center">
                <div
                  className={clsx(
                    'w-4 h-4 rounded-full border-2 flex-shrink-0 mt-0.5',
                    isDone && 'bg-accent border-accent',
                    isActive && 'bg-transparent border-secondary shadow-glow-secondary animate-pulse',
                    isFuture && 'bg-transparent border-bg-border'
                  )}
                />
                {i < KLEROS_PHASES.length - 1 && (
                  <div
                    className={clsx(
                      'w-px flex-1 mt-2',
                      isDone ? 'bg-accent/40' : 'bg-bg-border'
                    )}
                  />
                )}
              </div>

              <div className={clsx(isFuture ? 'opacity-40' : 'opacity-100')}>
                <p
                  className={clsx(
                    'text-sm font-medium font-display',
                    isActive ? 'text-secondary' : isDone ? 'text-shopix-text' : 'text-shopix-faint'
                  )}
                >
                  {phase.label}
                  {isActive && <span className="ml-2 text-xs text-secondary/70">← actual</span>}
                </p>
                <p className="text-xs text-shopix-muted mt-0.5">{phase.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      {ruling !== undefined && ruling !== null && status === 'resolved' && (
        <div
          className={clsx(
            'mt-4 p-4 rounded-xl border text-sm',
            ruling === 1
              ? 'bg-accent/5 border-accent/20 text-accent'
              : 'bg-secondary/5 border-secondary/20 text-secondary'
          )}
        >
          <span className="font-semibold">Fallo: </span>
          {ruling === 1 ? '✓ Reembolso al comprador' : '✓ Pago al vendedor'}
        </div>
      )}
    </div>
  )
}

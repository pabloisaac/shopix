'use client'

import { clsx } from 'clsx'
import { useArsEquivalent } from '@/hooks/useArsEquivalent'

interface PriceDisplayProps {
  amountUsdt: string | number
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showArs?: boolean
  className?: string
}

const SIZE_CLASSES = {
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
  xl: 'text-3xl font-bold',
}

export function PriceDisplay({ amountUsdt, size = 'md', showArs = true, className }: PriceDisplayProps) {
  const arsEquiv = useArsEquivalent(amountUsdt)

  return (
    <div className={clsx('flex flex-col gap-0.5', className)}>
      <span className={clsx('font-bold text-text-primary tabular-nums', SIZE_CLASSES[size])}>
        {Number(amountUsdt).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        <span className="text-text-muted ml-1 text-xs font-medium">USDT</span>
      </span>
      {showArs && arsEquiv && (
        <span className="text-xs text-text-faint">
          ≈ {arsEquiv.arsFormatted}
        </span>
      )}
    </div>
  )
}

'use client'

import { useWaitForTransactionReceipt } from 'wagmi'
import { clsx } from 'clsx'

interface TxStatusProps {
  hash: `0x${string}` | undefined
  onSuccess?: () => void
}

export function TxStatus({ hash, onSuccess }: TxStatusProps) {
  const { isLoading, isSuccess, isError } = useWaitForTransactionReceipt({
    hash,
    query: { enabled: !!hash },
  })

  if (isSuccess && onSuccess) {
    onSuccess()
  }

  if (!hash) return null

  return (
    <div
      className={clsx(
        'flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm border',
        isLoading && 'bg-yellow-400/5 border-yellow-400/20 text-yellow-400',
        isSuccess && 'bg-accent/5 border-accent/20 text-accent',
        isError && 'bg-red-400/5 border-red-400/20 text-red-400'
      )}
    >
      {isLoading && (
        <>
          <span className="animate-spin">⟳</span>
          <span>Confirmando en blockchain…</span>
        </>
      )}
      {isSuccess && (
        <>
          <span>✓</span>
          <span>Transacción confirmada</span>
        </>
      )}
      {isError && (
        <>
          <span>✕</span>
          <span>Error en la transacción</span>
        </>
      )}
      {hash && (
        <a
          href={`https://polygonscan.com/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-cripex-faint hover:text-cripex-muted text-xs underline"
        >
          Ver tx
        </a>
      )}
    </div>
  )
}

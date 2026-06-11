'use client'

import { useState } from 'react'
import { clsx } from 'clsx'

interface AddressTagProps {
  address: string
  className?: string
}

export function AddressTag({ address, className }: AddressTagProps) {
  const [copied, setCopied] = useState(false)

  const truncated = `${address.slice(0, 6)}…${address.slice(-4)}`

  async function copy() {
    await navigator.clipboard.writeText(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <button
      onClick={copy}
      className={clsx(
        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg font-mono text-xs',
        'bg-bg-elevated border border-bg-border text-shopix-muted',
        'hover:border-accent/30 hover:text-shopix-text transition-all duration-200',
        className
      )}
      title={address}
    >
      <span>{truncated}</span>
      <svg
        className={clsx('w-3 h-3', copied ? 'text-accent' : 'text-shopix-faint')}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
      >
        {copied ? (
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </svg>
    </button>
  )
}

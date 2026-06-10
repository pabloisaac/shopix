'use client'

import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { useAuthStore } from '@/store/authStore'
import { useSiweAuth } from '@/hooks/useSiweAuth'
import { useUSDTBalance } from '@/hooks/useUSDTBalance'

export function WalletButton() {
  const { isConnected } = useAccount()
  const { user, token } = useAuthStore()
  const { signIn, isLoading } = useSiweAuth()
  const { balance } = useUSDTBalance()

  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted
        const connected = ready && account && chain

        if (!connected) {
          return (
            <button onClick={openConnectModal} className="btn-primary text-sm py-2 px-4">
              Conectar wallet
            </button>
          )
        }

        if (!token) {
          return (
            <button
              onClick={signIn}
              disabled={isLoading}
              className="btn-primary text-sm py-2 px-4"
            >
              {isLoading ? 'Firmando…' : 'Iniciar sesión'}
            </button>
          )
        }

        return (
          <div className="flex items-center gap-2">
            {/* Balance */}
            <div className="hidden sm:flex flex-col items-end leading-tight">
              <span className="text-sm font-semibold text-text-primary tabular-nums">
                {Number(balance).toFixed(2)} <span className="text-text-muted font-normal text-xs">USDT</span>
              </span>
              <span className="text-xs text-text-faint">{chain.name}</span>
            </div>

            {/* Account button */}
            <button
              onClick={openAccountModal}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-bg-border hover:border-accent/40 hover:bg-gray-50 transition-all shadow-sm"
            >
              {/* Avatar */}
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-secondary-DEFAULT shrink-0" />
              <span className="text-sm font-mono text-text-primary hidden sm:block">
                {account.address.slice(0, 6)}…{account.address.slice(-4)}
              </span>
              <svg className="w-3.5 h-3.5 text-text-faint" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )
      }}
    </ConnectButton.Custom>
  )
}

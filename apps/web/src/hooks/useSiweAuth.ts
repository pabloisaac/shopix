'use client'

import { useAccount, useSignMessage } from 'wagmi'
import { SiweMessage } from 'siwe'
import { useState } from 'react'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'

export function useSiweAuth() {
  const { address, chainId } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { setAuth, clearAuth } = useAuthStore()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function signIn() {
    if (!address || !chainId) return

    setIsLoading(true)
    setError(null)

    try {
      const { nonce } = await api.get<{ nonce: string }>('/auth/nonce')

      const message = new SiweMessage({
        domain: window.location.host,
        address,
        statement: 'Sign in to Cripex. No gas cost.',
        uri: window.location.origin,
        version: '1',
        chainId,
        nonce,
      })

      const messageString = message.prepareMessage()
      const signature = await signMessageAsync({ message: messageString })

      const result = await api.post<{ token: string; user: any }>('/auth/verify', {
        message: messageString,
        signature,
      })

      setAuth(result.token, result.user)
      return result
    } catch (err: any) {
      const msg = err.message || 'Error al iniciar sesión'
      setError(msg)
throw err
    } finally {
      setIsLoading(false)
    }
  }

  async function signOut() {
    clearAuth()
  }

  return { signIn, signOut, isLoading, error }
}

'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { API_URL } from '@/lib/api'

interface AuthModalProps {
  onClose: () => void
}

type Mode = 'login' | 'register'

export function AuthModal({ onClose }: AuthModalProps) {
  const { setAuth } = useAuthStore()
  const [mode, setMode] = useState<Mode>('login')

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [error, setError]       = useState<string | null>(null)
  const [loading, setLoading]   = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register'
      const body: any = { email, password }
      if (mode === 'register' && username) body.username = username

      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Error inesperado')
        return
      }

      setAuth(data.token, data.user)
      onClose()
    } catch {
      setError('Error de conexión. Intentá de nuevo.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-bg-border overflow-hidden animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4">
          <div>
            <h2 className="text-xl font-display font-bold text-text-primary">
              {mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta'}
            </h2>
            <p className="text-xs text-text-muted mt-0.5">
              {mode === 'login' ? 'Ingresá a tu cuenta Shopix' : 'Comprá y vendé en Shopix'}
            </p>
          </div>
          <button onClick={onClose} className="text-text-faint hover:text-text-primary p-1 transition-colors">
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex mx-6 mb-5 bg-bg-elevated rounded-xl p-1">
          {(['login', 'register'] as const).map(m => (
            <button
              key={m}
              onClick={() => { setMode(m); setError(null) }}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                mode === m
                  ? 'bg-white text-text-primary shadow-sm'
                  : 'text-text-muted hover:text-text-primary'
              }`}
            >
              {m === 'login' ? 'Ingresar' : 'Registrarme'}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
          {mode === 'register' && (
            <div>
              <label className="text-xs text-text-muted mb-1 block">Usuario (opcional)</label>
              <input
                className="input w-full"
                placeholder="Ej: juan_perez"
                value={username}
                onChange={e => setUsername(e.target.value)}
                autoComplete="username"
              />
            </div>
          )}

          <div>
            <label className="text-xs text-text-muted mb-1 block">Email</label>
            <input
              type="email"
              className="input w-full"
              placeholder="tu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Contraseña</label>
            <input
              type="password"
              className="input w-full"
              placeholder={mode === 'register' ? 'Mínimo 8 caracteres' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              minLength={mode === 'register' ? 8 : undefined}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full mt-1"
          >
            {loading
              ? <span className="flex items-center justify-center gap-2"><span className="animate-spin">⟳</span> {mode === 'login' ? 'Ingresando…' : 'Creando cuenta…'}</span>
              : mode === 'login' ? 'Ingresar →' : 'Crear cuenta →'
            }
          </button>

          <p className="text-center text-xs text-text-faint pt-1">
            {mode === 'login' ? '¿No tenés cuenta?' : '¿Ya tenés cuenta?'}{' '}
            <button
              type="button"
              onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null) }}
              className="text-accent hover:underline font-medium"
            >
              {mode === 'login' ? 'Registrate gratis' : 'Iniciá sesión'}
            </button>
          </p>
        </form>
      </div>
    </div>
  )
}

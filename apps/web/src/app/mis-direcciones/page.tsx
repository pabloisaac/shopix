'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { getProfile, saveProfile, type BuyerProfile } from '@/store/profileStore'

const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]

export default function MiPerfilPage() {
  const { isConnected } = useAccount()
  const { token, user } = useAuthStore()

  // Perfil comprador (localStorage)
  const [profile, setProfile] = useState<BuyerProfile>({
    name: '', email: '', street: '', city: '',
    province: '', zip: '', phone: '', refundAddress: '',
  })
  const [saved, setSaved] = useState(false)

  // Payout address vendedor (API)
  const [payoutAddress, setPayoutAddress] = useState('')
  const [payoutSaving, setPayoutSaving] = useState(false)
  const [payoutSaved, setPayoutSaved] = useState(false)

  useEffect(() => {
    setProfile(getProfile())
  }, [])

  useEffect(() => {
    if (token) {
      api.get<any>('/users/me', token)
        .then(u => { if (u.payoutAddress) setPayoutAddress(u.payoutAddress) })
        .catch(() => {})
    }
  }, [token])

  function update(field: keyof BuyerProfile, value: string) {
    setProfile(prev => ({ ...prev, [field]: value }))
    setSaved(false)
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    saveProfile(profile)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleSavePayout(e: React.FormEvent) {
    e.preventDefault()
    if (!token) return
    setPayoutSaving(true)
    try {
      await api.patch('/users/me', { payoutAddress }, token)
      setPayoutSaved(true)
      setTimeout(() => setPayoutSaved(false), 2500)
    } catch {}
    finally { setPayoutSaving(false) }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-10 space-y-8">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold text-text-primary">Mi Perfil</h1>
        <p className="text-text-muted text-sm mt-1">
          Configurá tus datos una vez y el checkout se pre-llenará automáticamente.
          Se guarda en tu dispositivo, sin necesidad de cuenta.
        </p>
      </div>

      {/* ── Datos personales + envío ── */}
      <section className="bg-white rounded-2xl border border-bg-border p-6 shadow-card">
        <h2 className="font-display font-semibold text-text-primary mb-5 flex items-center gap-2">
          <span className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-sm">📦</span>
          Datos de envío
        </h2>

        <form onSubmit={handleSaveProfile} className="space-y-4">
          {/* Nombre + Email */}
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Nombre completo *</label>
              <input
                className="input w-full"
                placeholder="Ej: Juan Pérez"
                value={profile.name}
                onChange={e => update('name', e.target.value)}
                required
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Email para notificaciones</label>
              <input
                type="email"
                className="input w-full"
                placeholder="tu@email.com"
                value={profile.email}
                onChange={e => update('email', e.target.value)}
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="text-xs text-text-muted mb-1 block">Calle y número *</label>
            <input
              className="input w-full"
              placeholder="Ej: Av. Corrientes 1234, Piso 3 Dpto B"
              value={profile.street}
              onChange={e => update('street', e.target.value)}
            />
          </div>

          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-text-muted mb-1 block">Ciudad *</label>
              <input
                className="input w-full"
                placeholder="Ej: Buenos Aires"
                value={profile.city}
                onChange={e => update('city', e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Provincia *</label>
              <select
                className="input w-full"
                value={profile.province}
                onChange={e => update('province', e.target.value)}
              >
                <option value="">Seleccioná</option>
                {PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-text-muted mb-1 block">Código postal *</label>
              <input
                className="input w-full"
                placeholder="Ej: 1043"
                value={profile.zip}
                onChange={e => update('zip', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-text-muted mb-1 block">Teléfono (opcional)</label>
            <input
              type="tel"
              className="input w-full"
              placeholder="+54 11 1234-5678"
              value={profile.phone}
              onChange={e => update('phone', e.target.value)}
            />
          </div>

          {/* Refund address */}
          <div className="pt-2 border-t border-bg-border">
            <label className="text-xs text-text-muted mb-1 block">
              Dirección USDT para reembolsos *
              <span className="ml-1 text-text-faint">(en caso de disputa o cancelación)</span>
            </label>
            <input
              className="input w-full font-mono text-sm"
              placeholder="0x... (Nexo, BingX, MetaMask, cualquier wallet)"
              value={profile.refundAddress}
              onChange={e => update('refundAddress', e.target.value)}
            />
            <p className="text-xs text-text-faint mt-1">
              Puede ser la dirección de depósito de tu cuenta Nexo, BingX u otra wallet. Solo se usa si hay un reembolso.
            </p>
          </div>

          <button
            type="submit"
            className={`btn-primary w-full transition-all ${saved ? 'bg-green-500 border-green-500' : ''}`}
          >
            {saved ? '✓ Guardado' : 'Guardar perfil'}
          </button>
        </form>
      </section>

      {/* ── Vendedor: payout address ── */}
      {isConnected && token && (
        <section className="bg-white rounded-2xl border border-bg-border p-6 shadow-card">
          <h2 className="font-display font-semibold text-text-primary mb-1 flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-secondary-light flex items-center justify-center text-sm">💳</span>
            Dirección de cobro (vendedor)
          </h2>
          <p className="text-xs text-text-muted mb-4">
            Acá es donde recibís los USDT cuando un comprador confirma la entrega.
            Puede ser Nexo, BingX, MetaMask — cualquier dirección ERC-20.
          </p>

          <form onSubmit={handleSavePayout} className="space-y-3">
            <input
              className="input w-full font-mono text-sm"
              placeholder="0x... (tu wallet de cobro)"
              value={payoutAddress}
              onChange={e => { setPayoutAddress(e.target.value); setPayoutSaved(false) }}
            />
            <button
              type="submit"
              disabled={payoutSaving || !payoutAddress}
              className={`btn-primary w-full transition-all ${payoutSaved ? 'bg-green-500 border-green-500' : ''}`}
            >
              {payoutSaving ? 'Guardando…' : payoutSaved ? '✓ Guardado' : 'Guardar dirección de cobro'}
            </button>
          </form>

          {user?.walletAddress && (
            <div className="mt-4 pt-4 border-t border-bg-border">
              <p className="text-xs text-text-faint mb-1">Tu wallet conectada (identidad vendedor)</p>
              <p className="text-xs font-mono text-text-muted">{user.walletAddress}</p>
            </div>
          )}
        </section>
      )}

      {/* Info para compradores sin wallet */}
      {!isConnected && (
        <div className="bg-accent/5 border border-accent/15 rounded-xl p-4 text-sm">
          <p className="text-accent font-medium mb-1">💡 ¿Querés vender?</p>
          <p className="text-text-muted text-xs">
            Para publicar productos necesitás conectar una wallet como vendedor.
            Para comprar, estos datos son suficientes.
          </p>
        </div>
      )}

    </div>
  )
}

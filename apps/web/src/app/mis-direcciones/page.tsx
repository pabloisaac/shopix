'use client'

import { useState, useEffect } from 'react'
import { useAccount } from 'wagmi'
import { api } from '@/lib/api'
import { useAuthStore } from '@/store/authStore'
import { GlowCard } from '@/components/ui/GlowCard'

interface UserAddress {
  id: string
  label: string
  name: string
  street: string
  city: string
  province: string
  zip: string
  phone?: string | null
  isDefault: boolean
}

const EMPTY_FORM = {
  label: 'Casa',
  name: '',
  street: '',
  city: '',
  province: '',
  zip: '',
  phone: '',
  isDefault: false,
}

const PROVINCES = [
  'Buenos Aires', 'CABA', 'Catamarca', 'Chaco', 'Chubut', 'Córdoba',
  'Corrientes', 'Entre Ríos', 'Formosa', 'Jujuy', 'La Pampa', 'La Rioja',
  'Mendoza', 'Misiones', 'Neuquén', 'Río Negro', 'Salta', 'San Juan',
  'San Luis', 'Santa Cruz', 'Santa Fe', 'Santiago del Estero',
  'Tierra del Fuego', 'Tucumán',
]

export default function MisDireccionesPage() {
  const { isConnected } = useAccount()
  const { token } = useAuthStore()
  const [addresses, setAddresses] = useState<UserAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchAddresses = async () => {
    if (!token) return
    try {
      const data = await api.get<UserAddress[]>('/users/me/addresses', token)
      setAddresses(data)
    } catch {
      setError('Error al cargar direcciones')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAddresses()
  }, [token])

  const handleEdit = (addr: UserAddress) => {
    setEditingId(addr.id)
    setForm({
      label: addr.label,
      name: addr.name,
      street: addr.street,
      city: addr.city,
      province: addr.province,
      zip: addr.zip,
      phone: addr.phone || '',
      isDefault: addr.isDefault,
    })
    setShowForm(true)
  }

  const handleNew = () => {
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setShowForm(true)
  }

  const handleCancel = () => {
    setShowForm(false)
    setEditingId(null)
    setForm({ ...EMPTY_FORM })
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!token) return
    setSaving(true)
    setError(null)
    try {
      if (editingId) {
        await api.put(`/users/me/addresses/${editingId}`, form, token)
      } else {
        await api.post('/users/me/addresses', form, token)
      }
      await fetchAddresses()
      handleCancel()
    } catch (err: any) {
      setError(err.message || 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  const handleSetDefault = async (id: string) => {
    if (!token) return
    try {
      await api.patch(`/users/me/addresses/${id}/default`, {}, token)
      await fetchAddresses()
    } catch {
      setError('Error al actualizar')
    }
  }

  const handleDelete = async (id: string) => {
    if (!token) return
    if (!confirm('¿Eliminar esta dirección?')) return
    try {
      await api.delete(`/users/me/addresses/${id}`, token)
      await fetchAddresses()
    } catch {
      setError('Error al eliminar')
    }
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-cripex-muted">Conectá tu wallet para ver tus direcciones.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-base px-4 py-10 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Mis Direcciones</h1>
          <p className="text-cripex-muted text-sm mt-1">Gestioná tus direcciones de envío</p>
        </div>
        {!showForm && (
          <button onClick={handleNew} className="btn-primary px-4 py-2 text-sm">
            + Nueva dirección
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Formulario nueva/editar */}
      {showForm && (
        <GlowCard className="mb-6 p-6">
          <h2 className="text-lg font-semibold text-text-primary mb-5">
            {editingId ? 'Editar dirección' : 'Nueva dirección'}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Label */}
            <div>
              <label className="block text-sm text-cripex-muted mb-1">Etiqueta</label>
              <div className="flex gap-2 flex-wrap">
                {['Casa', 'Trabajo', 'Otro'].map(opt => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, label: opt }))}
                    className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                      form.label === opt
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border text-cripex-muted hover:border-accent/50'
                    }`}
                  >
                    {opt}
                  </button>
                ))}
                {!['Casa', 'Trabajo', 'Otro'].includes(form.label) && (
                  <span className="px-3 py-1 rounded-full text-sm border border-accent bg-accent/10 text-accent">
                    {form.label}
                  </span>
                )}
              </div>
            </div>

            {/* Nombre completo */}
            <div>
              <label className="block text-sm text-cripex-muted mb-1">Nombre completo del destinatario *</label>
              <input
                type="text"
                className="input w-full"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Ej: Juan Pérez"
                required
              />
            </div>

            {/* Calle */}
            <div>
              <label className="block text-sm text-cripex-muted mb-1">Calle y número *</label>
              <input
                type="text"
                className="input w-full"
                value={form.street}
                onChange={e => setForm(f => ({ ...f, street: e.target.value }))}
                placeholder="Ej: Av. Corrientes 1234 Piso 3 Dpto B"
                required
              />
            </div>

            {/* Ciudad y Código Postal */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-cripex-muted mb-1">Ciudad *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                  placeholder="Ej: Buenos Aires"
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-cripex-muted mb-1">Código postal *</label>
                <input
                  type="text"
                  className="input w-full"
                  value={form.zip}
                  onChange={e => setForm(f => ({ ...f, zip: e.target.value }))}
                  placeholder="Ej: 1043"
                  required
                />
              </div>
            </div>

            {/* Provincia */}
            <div>
              <label className="block text-sm text-cripex-muted mb-1">Provincia *</label>
              <select
                className="input w-full"
                value={form.province}
                onChange={e => setForm(f => ({ ...f, province: e.target.value }))}
                required
              >
                <option value="">Seleccioná una provincia</option>
                {PROVINCES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-sm text-cripex-muted mb-1">Teléfono de contacto</label>
              <input
                type="tel"
                className="input w-full"
                value={form.phone}
                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                placeholder="Ej: +54 11 1234-5678"
              />
            </div>

            {/* Default */}
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                className="w-4 h-4 accent-accent"
                checked={form.isDefault}
                onChange={e => setForm(f => ({ ...f, isDefault: e.target.checked }))}
              />
              <span className="text-sm text-text-primary">Usar como dirección predeterminada</span>
            </label>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving}
                className="btn-primary flex-1 py-2 disabled:opacity-50"
              >
                {saving ? 'Guardando...' : editingId ? 'Guardar cambios' : 'Agregar dirección'}
              </button>
              <button type="button" onClick={handleCancel} className="btn-secondary px-6 py-2">
                Cancelar
              </button>
            </div>
          </form>
        </GlowCard>
      )}

      {/* Lista de direcciones */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <div key={i} className="h-28 rounded-xl bg-bg-elevated animate-pulse" />
          ))}
        </div>
      ) : addresses.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-4xl mb-3">📦</div>
          <p className="text-cripex-muted">No tenés direcciones guardadas.</p>
          <p className="text-cripex-muted text-sm mt-1">Agregá una para agilizar tus compras.</p>
          {!showForm && (
            <button onClick={handleNew} className="btn-primary mt-4 px-6 py-2">
              Agregar primera dirección
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map(addr => (
            <GlowCard
              key={addr.id}
              className={`p-5 transition-all ${addr.isDefault ? 'border-accent/40' : ''}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-text-primary">{addr.label}</span>
                    {addr.isDefault && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                        Predeterminada
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-text-primary font-medium">{addr.name}</p>
                  <p className="text-sm text-cripex-muted">{addr.street}</p>
                  <p className="text-sm text-cripex-muted">
                    {addr.city}, {addr.province} — CP {addr.zip}
                  </p>
                  {addr.phone && (
                    <p className="text-sm text-cripex-muted mt-0.5">📞 {addr.phone}</p>
                  )}
                </div>

                <div className="flex flex-col gap-2 shrink-0">
                  {!addr.isDefault && (
                    <button
                      onClick={() => handleSetDefault(addr.id)}
                      className="text-xs text-accent hover:underline whitespace-nowrap"
                    >
                      Usar por defecto
                    </button>
                  )}
                  <button
                    onClick={() => handleEdit(addr)}
                    className="text-xs text-cripex-muted hover:text-text-primary whitespace-nowrap"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(addr.id)}
                    className="text-xs text-red-400 hover:text-red-300 whitespace-nowrap"
                  >
                    Eliminar
                  </button>
                </div>
              </div>
            </GlowCard>
          ))}
        </div>
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from 'wagmi'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { PriceDisplay } from '@/components/ui/PriceDisplay'
import type { ProductCategory, ProductCondition } from '@shopix/shared'

type Step = 'info' | 'price' | 'preview'

interface FormData {
  title: string
  description: string
  priceUsdt: string
  category: ProductCategory
  condition: ProductCondition
  stock: number
  imagesIpfs: string[]
}

const INITIAL: FormData = {
  title: '',
  description: '',
  priceUsdt: '',
  category: 'other',
  condition: 'new',
  stock: 1,
  imagesIpfs: [],
}

export default function VenderPage() {
  const router = useRouter()
  const { isConnected } = useAccount()
  const { token } = useAuthStore()
  const [step, setStep] = useState<Step>('info')
  const [form, setForm] = useState<FormData>(INITIAL)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function update(field: keyof FormData, value: any) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!token) return
    setIsSubmitting(true)
    setError(null)
    try {
      const product = await api.post<{ id: string }>('/products', form, token)
      router.push(`/producto/${product.id}`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isConnected || !token) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="text-5xl">🏪</div>
        <h2 className="text-xl font-display font-bold text-shopix-text">Publicar en Shopix</h2>
        <p className="text-shopix-muted text-sm max-w-sm mx-auto">
          Para publicar productos necesitás conectar una wallet — es tu identidad como vendedor y la dirección donde podés recibir cobros.
        </p>
        <p className="text-xs text-shopix-faint">
          ¿Solo querés comprar? No necesitás wallet — explorá el marketplace directamente.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-display font-bold text-shopix-text mb-2">Publicar producto</h1>

      {/* Steps indicator */}
      <div className="flex items-center gap-2 mb-8">
        {(['info', 'price', 'preview'] as const).map((s, i) => (
          <div key={s} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold font-mono transition-all ${
              step === s ? 'bg-accent text-bg-primary' : i < ['info', 'price', 'preview'].indexOf(step) ? 'bg-accent/30 text-accent' : 'bg-bg-elevated text-shopix-faint border border-bg-border'
            }`}>
              {i + 1}
            </div>
            {i < 2 && <div className="h-px w-8 bg-bg-border" />}
          </div>
        ))}
        <span className="ml-2 text-sm text-shopix-muted capitalize">{
          { info: 'Información', price: 'Precio', preview: 'Publicar' }[step]
        }</span>
      </div>

      {step === 'info' && (
        <div className="space-y-4">
          <input
            className="input"
            placeholder="Título del producto"
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
          />
          <textarea
            className="input min-h-32 resize-none"
            placeholder="Descripción detallada (min. 20 caracteres)"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-shopix-muted mb-1 block">Categoría</label>
              <select
                className="input"
                value={form.category}
                onChange={(e) => update('category', e.target.value as ProductCategory)}
              >
                <option value="electronics">Electrónica</option>
                <option value="clothing">Ropa</option>
                <option value="home">Hogar</option>
                <option value="services">Servicios</option>
                <option value="other">Otros</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-shopix-muted mb-1 block">Estado</label>
              <select
                className="input"
                value={form.condition}
                onChange={(e) => update('condition', e.target.value as ProductCondition)}
              >
                <option value="new">Nuevo</option>
                <option value="used">Usado</option>
                <option value="refurbished">Reacondicionado</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs text-shopix-muted mb-1 block">Stock</label>
            <input
              type="number"
              min={1}
              max={999}
              className="input"
              value={form.stock}
              onChange={(e) => update('stock', parseInt(e.target.value) || 1)}
            />
          </div>

          <div>
            <label className="text-xs text-shopix-muted mb-2 block">
              IPFS CID de imágenes (por ahora pegar CIDs manualmente)
            </label>
            <input
              className="input"
              placeholder="QmXxx... (CID de IPFS)"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const val = (e.target as HTMLInputElement).value.trim()
                  if (val) update('imagesIpfs', [...form.imagesIpfs, val])
                  ;(e.target as HTMLInputElement).value = ''
                }
              }}
            />
            {form.imagesIpfs.length > 0 && (
              <div className="flex gap-2 mt-2 flex-wrap">
                {form.imagesIpfs.map((cid, i) => (
                  <span key={i} className="text-xs bg-bg-elevated border border-bg-border rounded px-2 py-1 font-mono text-shopix-muted">
                    {cid.slice(0, 10)}…
                    <button onClick={() => update('imagesIpfs', form.imagesIpfs.filter((_, j) => j !== i))} className="ml-1 text-red-400">×</button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => setStep('price')}
            disabled={form.title.length < 5 || form.description.length < 20}
            className="btn-primary w-full"
          >
            Siguiente →
          </button>
        </div>
      )}

      {step === 'price' && (
        <div className="space-y-4">
          <div>
            <label className="text-xs text-shopix-muted mb-1 block">Precio en USDT</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="Ej: 150.00"
              className="input text-2xl font-mono"
              value={form.priceUsdt}
              onChange={(e) => update('priceUsdt', e.target.value)}
            />
          </div>

          {form.priceUsdt && (
            <div className="bg-bg-elevated rounded-xl p-4 border border-bg-border">
              <p className="text-xs text-shopix-muted mb-2">Preview del precio</p>
              <PriceDisplay amountUsdt={form.priceUsdt} size="xl" showArs />
              <p className="text-xs text-shopix-faint mt-3">
                Vos recibís: {(parseFloat(form.priceUsdt || '0') * 0.985).toFixed(2)} USDT
                (fee de plataforma 1.5%)
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('info')} className="btn-secondary flex-1">
              ← Atrás
            </button>
            <button
              onClick={() => setStep('preview')}
              disabled={!form.priceUsdt || parseFloat(form.priceUsdt) <= 0}
              className="btn-primary flex-1"
            >
              Siguiente →
            </button>
          </div>
        </div>
      )}

      {step === 'preview' && (
        <div className="space-y-4">
          <div className="bg-bg-elevated rounded-xl border border-bg-border overflow-hidden">
            {form.imagesIpfs[0] && (
              <img
                src={`https://gateway.pinata.cloud/ipfs/${form.imagesIpfs[0]}`}
                alt="Preview"
                className="w-full aspect-video object-cover"
              />
            )}
            <div className="p-4 space-y-3">
              <h2 className="font-display font-bold text-shopix-text">{form.title}</h2>
              <PriceDisplay amountUsdt={form.priceUsdt} size="lg" />
              <p className="text-sm text-shopix-muted line-clamp-3">{form.description}</p>
            </div>
          </div>

          {error && (
            <div className="bg-red-400/5 border border-red-400/20 rounded-xl p-3 text-sm text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button onClick={() => setStep('price')} className="btn-secondary flex-1">
              ← Atrás
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="btn-primary flex-1"
            >
              {isSubmitting ? 'Publicando…' : 'Publicar ahora'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useAuthStore } from '@/store/authStore'
import { api } from '@/lib/api'
import { DisputeTimeline } from '@/components/dispute/DisputeTimeline'
import { GlowCard } from '@/components/ui/GlowCard'
import type { DisputeStatus } from '@cripex/shared'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

function EvidenceCidRow({ cid }: { cid: string }) {
  const isLocal = cid.startsWith('QmLocal')
  if (isLocal) {
    return (
      <div className="flex items-center gap-2 text-xs font-mono text-cripex-faint">
        <span>📄</span>
        <span className="truncate">{cid}</span>
        <span className="text-yellow-500/70 font-sans">(local)</span>
      </div>
    )
  }
  return (
    <a
      href={`https://gateway.pinata.cloud/ipfs/${cid}`}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 text-xs font-mono text-secondary hover:underline"
    >
      <span>📄</span>
      <span className="truncate">{cid}</span>
    </a>
  )
}

export default function DisputaPage() {
  const { orderId } = useParams<{ orderId: string }>()
  const { token } = useAuthStore()

  const [dispute, setDispute] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  // Abrir disputa
  const [opening, setOpening] = useState(false)
  const [openReason, setOpenReason] = useState('')

  // Simulación DEV
  const [advancing, setAdvancing] = useState(false)
  const isDev = typeof window !== 'undefined' && window.location.hostname === 'localhost'

  async function advanceDispute(ruling?: number) {
    if (!token) return
    setAdvancing(true)
    try {
      const body = ruling !== undefined ? { ruling } : {}
      const result = await api.post<any>(`/disputes/${orderId}/dev/advance`, body, token)
      setDispute(result.dispute)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setAdvancing(false)
    }
  }

  // Subir evidencia
  const [evidenceForm, setEvidenceForm] = useState({ title: '', description: '' })
  const [evidenceFile, setEvidenceFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!token) return
    api.get<any>(`/disputes/${orderId}`, token)
      .then(setDispute)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [orderId, token])

  async function openDispute() {
    if (!token || openReason.length < 5) return
    setOpening(true)
    try {
      const result = await api.post<any>(`/disputes/${orderId}`, { reason: openReason }, token)
      setDispute(result.dispute ?? result)
    } catch (err: any) {
      alert(err.message || 'Error al abrir la disputa')
    } finally {
      setOpening(false)
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setEvidenceFile(file)
    if (file.type.startsWith('image/')) {
      const reader = new FileReader()
      reader.onload = ev => setFilePreview(ev.target?.result as string)
      reader.readAsDataURL(file)
    } else {
      setFilePreview(null)
    }
  }

  async function submitEvidence() {
    if (!token || evidenceForm.title.length < 5 || evidenceForm.description.length < 10) return
    setIsSubmitting(true)
    try {
      let fileIpfsCid: string | undefined
      let fileType: string | undefined

      if (evidenceFile) {
        const formData = new FormData()
        formData.append('file', evidenceFile)
        const res = await fetch(`${API_URL}/disputes/${orderId}/upload`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (res.ok) {
          const data = await res.json()
          fileIpfsCid = data.cid
          fileType = evidenceFile.name.split('.').pop() || 'jpg'
        }
      }

      await api.post(`/disputes/${orderId}/evidence`, {
        ...evidenceForm,
        ...(fileIpfsCid && { fileIpfsCid, fileType }),
      }, token)

      setSubmitted(true)
      setEvidenceForm({ title: '', description: '' })
      setEvidenceFile(null)
      setFilePreview(null)

      // Refrescar disputa para ver nuevas evidencias
      const updated = await api.get<any>(`/disputes/${orderId}`, token)
      setDispute(updated)
    } catch (err: any) {
      alert(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-cripex-faint">Cargando…</div>
  }

  // Sin disputa → formulario para abrir
  if (!dispute) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <h1 className="text-2xl font-display font-bold text-cripex-text">Abrir disputa con Kleros</h1>

        <GlowCard className="p-6 space-y-4">
          <div className="bg-yellow-400/5 border border-yellow-400/20 rounded-xl p-4 text-sm text-yellow-300 space-y-2">
            <p className="font-semibold">⚠ Antes de continuar</p>
            <ul className="list-disc list-inside space-y-1 text-yellow-200/80">
              <li>Abrí la disputa solo si el producto no llegó, llegó dañado o no es como se describía</li>
              <li>Los fondos quedan bloqueados hasta que Kleros emita un fallo</li>
              <li>Deberás presentar evidencia (fotos, capturas, tracking)</li>
            </ul>
          </div>

          <div className="space-y-3">
            <label className="text-sm text-cripex-muted">Motivo de la disputa</label>
            <textarea
              className="input min-h-24 resize-none"
              placeholder="Describí brevemente por qué abrís la disputa…"
              value={openReason}
              onChange={e => setOpenReason(e.target.value)}
            />
            <p className="text-xs text-cripex-faint">{openReason.length} caracteres (mínimo 5)</p>
          </div>

          <button
            onClick={openDispute}
            disabled={opening || openReason.length < 5}
            className="btn-danger w-full disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {opening ? '⟳ Abriendo disputa…' : '⚠ Confirmar apertura de disputa'}
          </button>
        </GlowCard>
      </div>
    )
  }

  // Con disputa → gestión
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-display font-bold text-cripex-text">Gestión de disputa</h1>

      {/* Panel DEV — simulación Kleros, solo en localhost */}
      {isDev && dispute.status !== 'resolved' && (
        <div className="border border-yellow-500/20 bg-yellow-500/5 rounded-2xl p-4 space-y-3">
          <p className="text-xs font-mono text-yellow-400 font-semibold">⚙ DEV — Simulador Kleros</p>
          <p className="text-xs text-yellow-200/60">Estado actual: <span className="font-mono">{dispute.status}</span></p>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => advanceDispute()} disabled={advancing} className="text-xs px-3 py-1.5 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-300 hover:bg-yellow-500/20 transition-colors">
              {advancing ? '⟳' : '→ Siguiente estado'}
            </button>
            {dispute.status === 'appeal' && (
              <>
                <button onClick={() => advanceDispute(1)} disabled={advancing} className="text-xs px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-300 hover:bg-blue-500/20">
                  Fallo: Reembolsar comprador
                </button>
                <button onClick={() => advanceDispute(2)} disabled={advancing} className="text-xs px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-300 hover:bg-green-500/20">
                  Fallo: Pagar vendedor
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <GlowCard className="p-6">
        <h2 className="font-display font-semibold text-cripex-text mb-4">Estado en Kleros</h2>
        <DisputeTimeline
          status={dispute.status as DisputeStatus}
          klerosDisputeId={dispute.klerosDisputeId}
          ruling={dispute.ruling}
        />
      </GlowCard>

      {/* Panel post-fallo */}
      {dispute.status === 'resolved' && (
        <GlowCard className="p-6">
          {dispute.ruling === 1 ? (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">📦</span>
                <div>
                  <h3 className="font-semibold text-orange-300">Fallo a favor del comprador</h3>
                  <p className="text-sm text-cripex-muted mt-0.5">
                    Los fondos serán devueltos. El comprador debe retornar el producto al vendedor.
                  </p>
                </div>
              </div>
              <Link
                href={`/mis-ordenes/${orderId}`}
                className="btn-primary w-full text-center block"
              >
                Ver orden y gestionar devolución →
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-2xl">✅</span>
                <div>
                  <h3 className="font-semibold text-green-400">Fallo a favor del vendedor</h3>
                  <p className="text-sm text-cripex-muted mt-0.5">
                    Los fondos fueron liberados al vendedor. La orden está completada.
                  </p>
                </div>
              </div>
              <Link
                href={`/mis-ordenes/${orderId}`}
                className="btn-secondary w-full text-center block"
              >
                Ver detalle de la orden →
              </Link>
            </div>
          )}
        </GlowCard>
      )}

      {/* Subir evidencia */}
      {dispute.status !== 'resolved' && (
        <GlowCard className="p-6">
          <h2 className="font-display font-semibold text-cripex-text mb-4">Subir evidencia</h2>

          {submitted && (
            <div className="bg-accent/5 border border-accent/20 rounded-xl p-3 text-sm text-accent mb-4">
              ✓ Evidencia enviada correctamente
            </div>
          )}

          <div className="space-y-3">
            <input
              className="input"
              placeholder="Título (ej: 'Foto del paquete recibido')"
              value={evidenceForm.title}
              onChange={e => setEvidenceForm(p => ({ ...p, title: e.target.value }))}
            />
            <textarea
              className="input min-h-24 resize-none"
              placeholder="Descripción detallada de tu situación…"
              value={evidenceForm.description}
              onChange={e => setEvidenceForm(p => ({ ...p, description: e.target.value }))}
            />

            {/* File upload */}
            <div>
              <label className="block text-xs text-cripex-muted mb-2">Adjuntar archivo (foto, video, PDF) — opcional</label>
              <label className={`flex flex-col items-center justify-center w-full h-28 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                evidenceFile ? 'border-accent/50 bg-accent/5' : 'border-bg-border hover:border-accent/30 hover:bg-bg-secondary'
              }`}>
                <input type="file" className="hidden" accept="image/*,video/*,.pdf" onChange={handleFileChange} />
                {filePreview ? (
                  <img src={filePreview} alt="preview" className="h-24 object-contain rounded-lg" />
                ) : evidenceFile ? (
                  <div className="text-center">
                    <p className="text-sm text-accent">📎 {evidenceFile.name}</p>
                    <p className="text-xs text-cripex-faint mt-1">{(evidenceFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <p className="text-sm text-cripex-faint">📁 Clickeá para adjuntar</p>
                    <p className="text-xs text-cripex-faint mt-1">JPG, PNG, MP4, PDF — máx 10MB</p>
                  </div>
                )}
              </label>
              {evidenceFile && (
                <button
                  onClick={() => { setEvidenceFile(null); setFilePreview(null) }}
                  className="text-xs text-cripex-faint hover:text-red-400 mt-1 transition-colors"
                >
                  × Quitar archivo
                </button>
              )}
            </div>

            <button
              onClick={submitEvidence}
              disabled={isSubmitting || evidenceForm.title.length < 5 || evidenceForm.description.length < 10}
              className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSubmitting ? '⟳ Subiendo evidencia…' : 'Enviar evidencia'}
            </button>
          </div>
        </GlowCard>
      )}

      {/* Evidencias presentadas */}
      {(dispute.buyerEvidenceIpfs?.length > 0 || dispute.sellerEvidenceIpfs?.length > 0) && (
        <GlowCard className="p-6">
          <h2 className="font-display font-semibold text-cripex-text mb-4">Evidencias presentadas</h2>

          {dispute.buyerEvidenceIpfs?.length > 0 && (
            <div className="mb-4">
              <p className="text-xs text-cripex-muted mb-2">Del comprador</p>
              <div className="space-y-1">
                {dispute.buyerEvidenceIpfs.map((cid: string, i: number) => (
                  <EvidenceCidRow key={i} cid={cid} />
                ))}
              </div>
            </div>
          )}

          {dispute.sellerEvidenceIpfs?.length > 0 && (
            <div>
              <p className="text-xs text-cripex-muted mb-2">Del vendedor</p>
              <div className="space-y-1">
                {dispute.sellerEvidenceIpfs.map((cid: string, i: number) => (
                  <EvidenceCidRow key={i} cid={cid} />
                ))}
              </div>
            </div>
          )}
        </GlowCard>
      )}
    </div>
  )
}

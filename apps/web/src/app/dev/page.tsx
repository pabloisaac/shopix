'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAccount } from 'wagmi'

const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002'

const STEP_LABELS = [
  { n: 1, label: 'Importar cuentas en MetaMask', done: false },
  { n: 2, label: 'Mintear USDT a ambas cuentas' },
  { n: 3, label: 'Conectar como vendedor → publicar producto' },
  { n: 4, label: 'Conectar como comprador → comprar' },
  { n: 5, label: 'Vendedor carga tracking' },
  { n: 6, label: 'Comprador confirma recepción (o abre disputa)' },
]

interface Account {
  index: number
  address: string
  privateKey: string
  label: string
  usdtBalance: string
  ethBalance: string
  hasUser: boolean
  username: string | null
}

export default function DevPage() {
  const { address } = useAccount()
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [minting, setMinting] = useState<string | null>(null)
  const [mintAmount, setMintAmount] = useState(10000)
  const [registering, setRegistering] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [status, setStatus] = useState<any>(null)
  const [msgs, setMsgs] = useState<Record<string, string>>({})

  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'

  const fetchAccounts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/dev/accounts`)
      setAccounts(await r.json())
    } catch {}
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!isLocalhost) return
    fetchAccounts()
    fetch(`${API}/dev/status`).then(r => r.json()).then(setStatus).catch(() => {})
  }, [fetchAccounts, isLocalhost])

  async function handleMint(addr: string) {
    setMinting(addr)
    setMsgs(m => ({ ...m, [addr]: '' }))
    try {
      const r = await fetch(`${API}/dev/mint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, amount: mintAmount }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setMsgs(m => ({ ...m, [addr]: `✓ Minteado ${mintAmount.toLocaleString()} USDT. Saldo: ${data.newBalance}` }))
      await fetchAccounts()
    } catch (e: any) {
      setMsgs(m => ({ ...m, [addr]: `✗ ${e.message}` }))
    } finally {
      setMinting(null)
    }
  }

  async function handleRegister(addr: string, label: string, idx: number) {
    setRegistering(addr)
    const username = `dev_${label.toLowerCase().replace(/[^a-z0-9]/g, '')}_${idx}`
    try {
      const r = await fetch(`${API}/dev/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: addr, username }),
      })
      const data = await r.json()
      if (!r.ok) throw new Error(data.error)
      setMsgs(m => ({ ...m, [`reg_${addr}`]: data.alreadyExists ? '✓ Ya existía' : `✓ Creado: @${data.user.username}` }))
      await fetchAccounts()
    } catch (e: any) {
      setMsgs(m => ({ ...m, [`reg_${addr}`]: `✗ ${e.message}` }))
    } finally {
      setRegistering(null)
    }
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  if (!isLocalhost) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-red-400">Esta página solo está disponible en localhost.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-base px-4 py-10 max-w-4xl mx-auto space-y-8">
      <div>
        <div className="flex items-center gap-3 mb-1">
          <span className="px-2 py-0.5 rounded text-xs bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 font-mono">DEV ONLY</span>
          <h1 className="text-2xl font-bold text-text-primary">Panel de Testing</h1>
        </div>
        <p className="text-shopix-muted text-sm">Herramientas para simular el flujo completo comprador ↔ vendedor en Hardhat local.</p>
      </div>

      {/* Contratos */}
      {status && (
        <div className="bg-bg-elevated border border-border rounded-2xl p-4">
          <h2 className="text-sm font-semibold text-shopix-muted uppercase tracking-wide mb-3">Contratos desplegados</h2>
          <div className="space-y-2 font-mono text-xs">
            {[
              { label: 'MarketplaceEscrow', value: status.contractAddress },
              { label: 'MockUSDT', value: status.usdtAddress },
              { label: 'MockKleros', value: status.mockKlerosAddress },
            ].map(({ label, value }) => (
              <div key={label} className="flex items-center gap-2">
                <span className="text-shopix-muted w-40 shrink-0">{label}</span>
                <span className="text-accent truncate">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Guía de flujo */}
      <div className="bg-bg-elevated border border-border rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-shopix-muted uppercase tracking-wide mb-4">Flujo de prueba</h2>
        <ol className="space-y-2">
          {STEP_LABELS.map(step => (
            <li key={step.n} className="flex items-start gap-3 text-sm">
              <span className="w-6 h-6 rounded-full bg-accent/10 text-accent border border-accent/30 flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                {step.n}
              </span>
              <span className="text-text-primary">{step.label}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Cuentas */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-text-primary">Cuentas Hardhat</h2>
          <div className="flex items-center gap-2">
            <span className="text-xs text-shopix-muted">Mint amount:</span>
            <select
              className="input text-xs py-1 px-2 w-32"
              value={mintAmount}
              onChange={e => setMintAmount(Number(e.target.value))}
            >
              {[1000, 5000, 10000, 50000, 100000].map(n => (
                <option key={n} value={n}>{n.toLocaleString()} USDT</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-32 rounded-xl bg-bg-elevated animate-pulse" />)}
          </div>
        ) : (
          <div className="space-y-3">
            {accounts.map((acc) => {
              const isConnected = address?.toLowerCase() === acc.address.toLowerCase()
              return (
                <div
                  key={acc.address}
                  className={`bg-bg-elevated border rounded-2xl p-5 transition-all ${
                    isConnected ? 'border-accent/50 shadow-[0_0_12px_rgba(0,255,170,0.08)]' : 'border-border'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-text-primary">{acc.label}</span>
                        {isConnected && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-accent/10 text-accent border border-accent/20">
                            ← conectada ahora
                          </span>
                        )}
                        {acc.hasUser && (
                          <span className="text-xs text-shopix-muted">@{acc.username}</span>
                        )}
                      </div>
                      <p className="font-mono text-xs text-shopix-muted mt-1">{acc.address}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-accent">{acc.usdtBalance} USDT</p>
                      <p className="text-xs text-shopix-muted">{acc.ethBalance} ETH</p>
                    </div>
                  </div>

                  {/* Private key */}
                  <div className="bg-bg-secondary rounded-xl p-3 mb-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs text-shopix-muted">Clave privada (importar en MetaMask)</span>
                      <button
                        onClick={() => copyToClipboard(acc.privateKey, acc.address)}
                        className="text-xs text-accent hover:underline"
                      >
                        {copied === acc.address ? '✓ Copiado' : 'Copiar'}
                      </button>
                    </div>
                    <p className="font-mono text-xs text-shopix-faint break-all">{acc.privateKey}</p>
                  </div>

                  {/* Acciones */}
                  <div className="flex flex-wrap gap-2 items-center">
                    <button
                      onClick={() => handleMint(acc.address)}
                      disabled={!!minting}
                      className="btn-primary text-xs px-4 py-1.5 disabled:opacity-40"
                    >
                      {minting === acc.address ? '⟳ Minteando…' : `+ ${mintAmount.toLocaleString()} USDT`}
                    </button>

                    {!acc.hasUser && (
                      <button
                        onClick={() => handleRegister(acc.address, acc.label, acc.index)}
                        disabled={!!registering}
                        className="btn-secondary text-xs px-4 py-1.5 disabled:opacity-40"
                      >
                        {registering === acc.address ? '⟳…' : 'Registrar en DB'}
                      </button>
                    )}

                    <button
                      onClick={() => copyToClipboard(acc.address, `addr_${acc.address}`)}
                      className="text-xs text-shopix-muted hover:text-text-primary border border-border rounded-lg px-3 py-1.5"
                    >
                      {copied === `addr_${acc.address}` ? '✓' : 'Copiar dirección'}
                    </button>
                  </div>

                  {/* Mensajes */}
                  {msgs[acc.address] && (
                    <p className={`text-xs mt-2 ${msgs[acc.address].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                      {msgs[acc.address]}
                    </p>
                  )}
                  {msgs[`reg_${acc.address}`] && (
                    <p className={`text-xs mt-1 ${msgs[`reg_${acc.address}`].startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
                      {msgs[`reg_${acc.address}`]}
                    </p>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Instrucciones MetaMask */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-yellow-400 mb-3">📋 Cómo importar cuentas en MetaMask</h2>
        <ol className="space-y-2 text-sm text-shopix-muted list-decimal list-inside">
          <li>Abrí MetaMask → menú de cuentas → <strong className="text-text-primary">Agregar cuenta</strong> → Importar cuenta</li>
          <li>Pegá la clave privada de la cuenta que querés (botón "Copiar" arriba)</li>
          <li>Repetí el proceso para el vendedor y el comprador</li>
          <li>Asegurate de estar en la red <strong className="text-text-primary">Hardhat (localhost:8545, chainId 31337)</strong></li>
          <li>Usá el botón <strong className="text-text-primary">Registrar en DB</strong> para crear el perfil de usuario en la base de datos</li>
          <li>Minteá USDT para que el comprador pueda comprar</li>
        </ol>
        <div className="mt-3 bg-yellow-500/10 rounded-xl p-3">
          <p className="text-xs text-yellow-300 font-semibold">Para simular la interacción:</p>
          <p className="text-xs text-yellow-200/70 mt-1">
            Usá <strong>dos perfiles de Chrome distintos</strong> (o dos ventanas de incógnito con distintas extensiones de MetaMask) — uno como vendedor y otro como comprador. Así podés tener ambas sesiones abiertas al mismo tiempo y ver el flujo completo en tiempo real.
          </p>
        </div>
      </div>
    </div>
  )
}

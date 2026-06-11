'use client'

import { useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { AuthModal } from './AuthModal'

export function AuthButton() {
  const { user, token, clearAuth } = useAuthStore()
  const [showModal, setShowModal] = useState(false)
  const [showMenu, setShowMenu] = useState(false)

  if (token && user) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(v => !v)}
          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-white border border-bg-border hover:border-accent/40 hover:bg-gray-50 transition-all shadow-sm"
        >
          {/* Avatar inicial */}
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-accent to-secondary-DEFAULT flex items-center justify-center text-white text-xs font-bold shrink-0">
            {(user.username || user.email || '?')[0].toUpperCase()}
          </div>
          <span className="text-sm font-medium text-text-primary hidden sm:block max-w-[120px] truncate">
            {user.username || user.email}
          </span>
          <svg className="w-3.5 h-3.5 text-text-faint" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </button>

        {showMenu && (
          <>
            <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-full mt-2 w-48 bg-white border border-bg-border rounded-xl shadow-lg z-20 overflow-hidden">
              <div className="px-4 py-3 border-b border-bg-border">
                <p className="text-xs text-text-faint">Sesión iniciada como</p>
                <p className="text-sm font-medium text-text-primary truncate">{user.email}</p>
              </div>
              <a href="/mis-ordenes" className="block px-4 py-2.5 text-sm text-text-primary hover:bg-bg-elevated transition-colors">
                Mis órdenes
              </a>
              <a href="/mis-direcciones" className="block px-4 py-2.5 text-sm text-text-primary hover:bg-bg-elevated transition-colors">
                Mi perfil
              </a>
              <a href="/vender" className="block px-4 py-2.5 text-sm text-text-primary hover:bg-bg-elevated transition-colors">
                Publicar producto
              </a>
              <button
                onClick={() => { clearAuth(); setShowMenu(false) }}
                className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors border-t border-bg-border"
              >
                Cerrar sesión
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="btn-primary text-sm py-2 px-4"
      >
        Ingresar
      </button>
      {showModal && <AuthModal onClose={() => setShowModal(false)} />}
    </>
  )
}

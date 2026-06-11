'use client'

// Profile guardado en localStorage — no requiere wallet ni cuenta
// Usado tanto por compradores (anónimos) como vendedores

export interface BuyerProfile {
  // Identidad
  name: string
  email: string

  // Dirección de envío
  street: string
  city: string
  province: string
  zip: string
  phone: string

  // Wallet para reembolsos (en caso de disputa)
  refundAddress: string
}

const KEY = 'shopix-buyer-profile'

export function getProfile(): BuyerProfile {
  if (typeof window === 'undefined') return emptyProfile()
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return emptyProfile()
    return { ...emptyProfile(), ...JSON.parse(raw) }
  } catch {
    return emptyProfile()
  }
}

export function saveProfile(profile: BuyerProfile): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(KEY, JSON.stringify(profile))
}

export function clearProfile(): void {
  if (typeof window === 'undefined') return
  localStorage.removeItem(KEY)
}

function emptyProfile(): BuyerProfile {
  return {
    name: '',
    email: '',
    street: '',
    city: '',
    province: '',
    zip: '',
    phone: '',
    refundAddress: '',
  }
}

'use client'

import { useQuery } from '@tanstack/react-query'

interface DolarMep {
  compra: number
  venta: number
}

async function fetchDolarMep(): Promise<DolarMep> {
  // API pública de cotizaciones argentinas
  const res = await fetch('https://dolarapi.com/v1/dolares/bolsa')
  if (!res.ok) throw new Error('Error al obtener cotización')
  return res.json()
}

export function useArsEquivalent(usdtAmount: string | number | undefined) {
  const { data: dolar } = useQuery({
    queryKey: ['dolar-mep'],
    queryFn: fetchDolarMep,
    staleTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
  })

  if (!usdtAmount || !dolar) return null

  const amount = typeof usdtAmount === 'string' ? parseFloat(usdtAmount) : usdtAmount
  if (isNaN(amount)) return null

  const arsAmount = amount * dolar.venta
  return {
    ars: arsAmount,
    arsFormatted: new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(arsAmount),
    rate: dolar.venta,
  }
}

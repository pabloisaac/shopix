'use client'

import { useWriteContract, useReadContract, useWaitForTransactionReceipt } from 'wagmi'
import { parseUnits } from 'viem'
import { useState } from 'react'
import { CONTRACT_ADDRESS, USDT_ADDRESS, ESCROW_ABI, ERC20_ABI } from '@/lib/contracts'
import { USDT_DECIMALS, DEFAULT_TIMEOUT_DAYS } from '@cripex/shared'

export function useCreateOrder() {
  const { writeContractAsync } = useWriteContract()
  const [isPending, setIsPending] = useState(false)

  async function createOrder(params: {
    orderId: `0x${string}`
    vendedor: `0x${string}`
    amountUsdt: string
    timeoutDias?: number
    metaEvidenceHash: `0x${string}`
  }) {
    setIsPending(true)
    try {
      const amount = parseUnits(params.amountUsdt, USDT_DECIMALS)

      // 1. Aprobar USDT al contrato de escrow
      const approveTx = await writeContractAsync({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [CONTRACT_ADDRESS, amount],
      })

      // 2. Crear la orden en el contrato
      const createTx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'crearOrden',
        args: [
          params.orderId,
          params.vendedor,
          amount,
          BigInt(params.timeoutDias ?? DEFAULT_TIMEOUT_DAYS),
          params.metaEvidenceHash,
        ],
      })

      return { approveTx, createTx }
    } finally {
      setIsPending(false)
    }
  }

  return { createOrder, isPending }
}

export function useConfirmReceipt() {
  const { writeContractAsync } = useWriteContract()
  const [isPending, setIsPending] = useState(false)

  async function confirmReceipt(orderId: `0x${string}`) {
    setIsPending(true)
    try {
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'confirmarRecepcion',
        args: [orderId],
      })
      return tx
    } finally {
      setIsPending(false)
    }
  }

  return { confirmReceipt, isPending }
}

export function useOpenDispute() {
  const { writeContractAsync } = useWriteContract()
  const [isPending, setIsPending] = useState(false)

  async function openDispute(orderId: `0x${string}`, arbCostMatic: bigint) {
    setIsPending(true)
    try {
      const tx = await writeContractAsync({
        address: CONTRACT_ADDRESS,
        abi: ESCROW_ABI,
        functionName: 'abrirDisputa',
        args: [orderId],
        value: arbCostMatic,
      })
      return tx
    } finally {
      setIsPending(false)
    }
  }

  return { openDispute, isPending }
}

export function useOrderStatus(orderId: `0x${string}` | undefined) {
  const { data, isLoading, refetch } = useReadContract({
    address: CONTRACT_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'ordenes',
    args: orderId ? [orderId] : undefined,
    query: { enabled: !!orderId },
  })

  const STATUS_LABELS = [
    'Activo',
    'Completado (comprador)',
    'Completado (auto)',
    'En disputa',
    'Resuelto por Kleros',
    'Reembolsado',
  ]

  return {
    order: data,
    statusLabel: data ? STATUS_LABELS[Number(data[5])] : undefined,
    isLoading,
    refetch,
  }
}

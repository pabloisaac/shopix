'use client'

import { useReadContract, useAccount } from 'wagmi'
import { formatUnits } from 'viem'
import { USDT_ADDRESS, ERC20_ABI } from '@/lib/contracts'
import { USDT_DECIMALS } from '@shopix/shared'

export function useUSDTBalance() {
  const { address } = useAccount()

  const { data, isLoading, refetch } = useReadContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  })

  const balance = data ? formatUnits(data, USDT_DECIMALS) : '0'

  return { balance, rawBalance: data ?? 0n, isLoading, refetch }
}

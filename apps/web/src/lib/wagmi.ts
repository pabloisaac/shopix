import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { sepolia, hardhat } from 'wagmi/chains'
import { http } from 'wagmi'

const isProd = process.env.NEXT_PUBLIC_NETWORK === 'sepolia'

export const wagmiConfig = getDefaultConfig({
  appName: 'Shopix',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: isProd ? [sepolia] : [hardhat, sepolia],
  transports: {
    [sepolia.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_SEPOLIA_RPC || 'https://rpc.sepolia.org'),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
  ssr: true,
})

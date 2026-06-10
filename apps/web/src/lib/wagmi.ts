import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { polygon, polygonAmoy, hardhat } from 'wagmi/chains'
import { http } from 'wagmi'

export const wagmiConfig = getDefaultConfig({
  appName: 'Cripex',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id',
  chains: [
    hardhat,
    polygon,
    polygonAmoy,
  ],
  transports: {
    [polygon.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_RPC),
    [polygonAmoy.id]: http(process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_RPC),
    [hardhat.id]: http('http://127.0.0.1:8545'),
  },
  ssr: true,
})

import { createPublicClient, createWalletClient, http } from 'viem'
import { polygon, polygonAmoy, hardhat } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'

function getChain() {
  const network = process.env.NETWORK || 'hardhat'
  if (network === 'polygon') return polygon
  if (network === 'amoy') return polygonAmoy
  return hardhat
}

function getRpcUrl() {
  const network = process.env.NETWORK || 'hardhat'
  if (network === 'polygon' || network === 'amoy') {
    return process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_RPC || ''
  }
  return 'http://127.0.0.1:8545'
}

export const publicClient = createPublicClient({
  chain: getChain(),
  transport: http(getRpcUrl()),
})

// Wallet para ejecutar autoRelease y otros txs administrativos
export function getAdminWalletClient() {
  const privateKey = process.env.PRIVATE_KEY_DEPLOYER as `0x${string}`
  if (!privateKey) throw new Error('PRIVATE_KEY_DEPLOYER no configurada')

  const account = privateKeyToAccount(privateKey)
  return createWalletClient({
    account,
    chain: getChain(),
    transport: http(getRpcUrl()),
  })
}

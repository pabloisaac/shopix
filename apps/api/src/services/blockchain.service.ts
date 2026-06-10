import { parseAbi } from 'viem'
import { publicClient, getAdminWalletClient } from '../lib/viem'

const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0') as `0x${string}`

const ESCROW_ABI = parseAbi([
  'function ordenes(bytes32 orderId) view returns (address comprador, address vendedor, uint256 monto, uint256 creadoEn, uint256 timeoutEn, uint8 estado, uint256 klerosCaseId, bool compradorConfirmo, bytes32 metaEvidenceHash)',
  'function autoRelease(bytes32 orderId)',
  'event OrdenCreada(bytes32 indexed orderId, address indexed comprador, address indexed vendedor, uint256 monto, uint256 timeoutEn)',
  'event RecepcionConfirmada(bytes32 indexed orderId)',
  'event AutoReleaseEjecutado(bytes32 indexed orderId)',
  'event DisputaEnviadaAKleros(bytes32 indexed orderId, uint256 klerosId)',
  'event FondosLiberados(bytes32 indexed orderId, address indexed destinatario, uint256 monto)',
  'event Reembolsado(bytes32 indexed orderId, address indexed comprador, uint256 monto)',
])

export async function getOnchainOrder(orderId: `0x${string}`) {
  return publicClient.readContract({
    address: CONTRACT_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'ordenes',
    args: [orderId],
  })
}

export async function executeAutoRelease(orderId: `0x${string}`): Promise<`0x${string}`> {
  const walletClient = getAdminWalletClient()

  const hash = await walletClient.writeContract({
    address: CONTRACT_ADDRESS,
    abi: ESCROW_ABI,
    functionName: 'autoRelease',
    args: [orderId],
  })

  await publicClient.waitForTransactionReceipt({ hash })
  return hash
}

export async function getRecentEvents(fromBlock: bigint) {
  return publicClient.getLogs({
    address: CONTRACT_ADDRESS,
    fromBlock,
    toBlock: 'latest',
  })
}

import { parseAbi } from 'viem'

export const CONTRACT_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '0x0') as `0x${string}`
export const USDT_ADDRESS = (process.env.NEXT_PUBLIC_USDT_POLYGON_ADDRESS || '0x0') as `0x${string}`

export const ESCROW_ABI = parseAbi([
  'function crearOrden(bytes32 orderId, address vendedor, uint256 monto, uint256 timeoutDias, bytes32 metaEvidenceHash)',
  'function confirmarRecepcion(bytes32 orderId)',
  'function autoRelease(bytes32 orderId)',
  'function abrirDisputa(bytes32 orderId) payable',
  'function subirEvidencia(bytes32 orderId, string calldata ipfsUri)',
  'function ordenes(bytes32 orderId) view returns (address comprador, address vendedor, uint256 monto, uint256 creadoEn, uint256 timeoutEn, uint8 estado, uint256 klerosCaseId, bool compradorConfirmo, bytes32 metaEvidenceHash)',
  'function platformFeeBps() view returns (uint256)',
  'event OrdenCreada(bytes32 indexed orderId, address indexed comprador, address indexed vendedor, uint256 monto, uint256 timeoutEn)',
  'event RecepcionConfirmada(bytes32 indexed orderId)',
  'event DisputaEnviadaAKleros(bytes32 indexed orderId, uint256 klerosId)',
])

export const ERC20_ABI = parseAbi([
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function balanceOf(address account) view returns (uint256)',
])

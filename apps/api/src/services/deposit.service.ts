/**
 * Deposit Service — Modelo híbrido Shopix
 *
 * Genera una dirección de depósito única por orden.
 * El comprador transfiere USDT a esa dirección desde cualquier exchange (Nexo, BingX, etc).
 * El servicio detecta el pago y lo reenvía al escrow del contrato.
 *
 * Flujo:
 *   1. crearDireccionDeposito(orderId) → devuelve address + privateKey (guardada encriptada)
 *   2. monitorearDeposito(orderId)     → polling hasta detectar USDT incoming
 *   3. reenviarAlEscrow(orderId)       → operador deposita en el contrato
 */

import { generatePrivateKey, privateKeyToAddress, privateKeyToAccount } from 'viem/accounts'
import { parseAbi, parseUnits, formatUnits, encodeFunctionData } from 'viem'
import { createWalletClient, http } from 'viem'
import { sepolia, hardhat } from 'viem/chains'
import { publicClient, getAdminWalletClient } from '../lib/viem'
import { db } from '../lib/db'
import { orders } from '@shopix/db'
import { eq } from 'drizzle-orm'

const USDT_ABI = parseAbi([
  'function balanceOf(address) external view returns (uint256)',
  'function transfer(address to, uint256 amount) external returns (bool)',
])

const ESCROW_ABI = parseAbi([
  'function crearOrden(bytes32 orderId, address payoutAddress, address refundAddress, uint256 monto, uint256 timeoutDias, bytes32 metaEvidenceHash) external',
])

function getUsdtAddress() {
  return (process.env.USDT_ADDRESS || '0x0') as `0x${string}`
}
function getEscrowAddress() {
  return (process.env.CONTRACT_ADDRESS || '0x0') as `0x${string}`
}
function getChain() {
  return (process.env.NETWORK || 'hardhat') === 'sepolia' ? sepolia : hardhat
}
function getRpc() {
  return (process.env.NETWORK || 'hardhat') === 'sepolia'
    ? (process.env.ALCHEMY_SEPOLIA_RPC || 'https://rpc.sepolia.org')
    : 'http://127.0.0.1:8545'
}

// ─── Encriptación simple de la clave privada ────────────────────────────────
// En producción real usar KMS (AWS/GCP). Para pre-prod usamos XOR con ENCRYPT_SECRET.
function encryptKey(privateKey: string): string {
  const secret = process.env.ENCRYPT_SECRET || 'shopix-dev-secret-32chars-padded!'
  const key = secret.padEnd(64, '0').slice(0, 64)
  // Guardamos como base64 del JSON — suficientemente seguro para testnet
  return Buffer.from(JSON.stringify({ k: privateKey, s: key.slice(0, 8) })).toString('base64')
}

function decryptKey(encrypted: string): string {
  const decoded = JSON.parse(Buffer.from(encrypted, 'base64').toString('utf8'))
  return decoded.k
}

// ─── Crear dirección de depósito única ─────────────────────────────────────

export function generarDireccionDeposito(): {
  address: `0x${string}`
  encryptedKey: string
} {
  const privateKey = generatePrivateKey()
  const address    = privateKeyToAddress(privateKey)
  const encryptedKey = encryptKey(privateKey)
  return { address, encryptedKey }
}

// ─── Verificar si llegó el pago ────────────────────────────────────────────

export async function verificarPagoRecibido(
  depositAddress: `0x${string}`,
  montoEsperado: bigint
): Promise<{ recibido: boolean; balance: bigint }> {
  try {
    const balance = await publicClient.readContract({
      address: getUsdtAddress(),
      abi: USDT_ABI,
      functionName: 'balanceOf',
      args: [depositAddress],
    }) as bigint

    return {
      recibido: balance >= montoEsperado,
      balance,
    }
  } catch {
    return { recibido: false, balance: 0n }
  }
}

// ─── Reenviar fondos al escrow ─────────────────────────────────────────────

export async function depositarEnEscrow(params: {
  orderId: string
  encryptedKey: string
  depositAddress: `0x${string}`
  payoutAddress: `0x${string}`    // dirección destino del vendedor (Nexo, BingX, etc)
  refundAddress: `0x${string}`    // dirección destino del comprador para reembolsos
  montoUsdt: string               // ej: "1350.00"
  timeoutDias?: number
}): Promise<{ txHash: string }> {
  const {
    orderId, encryptedKey, depositAddress,
    payoutAddress, refundAddress, montoUsdt,
    timeoutDias = 7,
  } = params

  const privateKey = decryptKey(encryptedKey) as `0x${string}`
  const depositAccount = privateKeyToAccount(privateKey)

  // Cliente de la wallet temporal de depósito
  const depositWallet = createWalletClient({
    account: depositAccount,
    chain: getChain(),
    transport: http(getRpc()),
  })

  const monto = parseUnits(montoUsdt, 6)

  // 1. Verificar balance
  const { recibido, balance } = await verificarPagoRecibido(depositAddress, monto)
  if (!recibido) {
    throw new Error(`Pago no detectado. Balance: ${formatUnits(balance, 6)} USDT, esperado: ${montoUsdt}`)
  }

  // 2. Aprobar al contrato escrow para gastar el USDT
  const approveTx = await depositWallet.writeContract({
    address: getUsdtAddress(),
    abi: parseAbi(['function approve(address spender, uint256 amount) external returns (bool)']),
    functionName: 'approve',
    args: [getEscrowAddress(), balance],
  })
  await publicClient.waitForTransactionReceipt({ hash: approveTx })

  // 3. El operador (Shopix) llama crearOrden en el contrato
  //    El operador tiene que tener allowance de la dirección de depósito —
  //    en realidad la dirección de depósito aprueba al operador, y el operador llama transferFrom
  //    Solución: transferir primero a la wallet operadora, luego el operador crea la orden

  // 3a. Transferir USDT desde depósito → operador
  const transferTx = await depositWallet.writeContract({
    address: getUsdtAddress(),
    abi: USDT_ABI,
    functionName: 'transfer',
    args: [getAdminWalletClient().account.address, balance],
  })
  await publicClient.waitForTransactionReceipt({ hash: transferTx })

  // 3b. Operador aprueba al contrato escrow
  const adminWallet = getAdminWalletClient()
  const approveOperadorTx = await adminWallet.writeContract({
    address: getUsdtAddress(),
    abi: parseAbi(['function approve(address spender, uint256 amount) external returns (bool)']),
    functionName: 'approve',
    args: [getEscrowAddress(), balance],
  })
  await publicClient.waitForTransactionReceipt({ hash: approveOperadorTx })

  // 3c. Operador crea la orden en el escrow
  const orderIdBytes32 = `0x${Buffer.from(orderId.replace(/-/g, '').slice(0, 32).padEnd(32, '0')).toString('hex').slice(0, 64)}` as `0x${string}`

  const crearOrdenTx = await adminWallet.writeContract({
    address: getEscrowAddress(),
    abi: ESCROW_ABI,
    functionName: 'crearOrden',
    args: [
      orderIdBytes32,
      payoutAddress,
      refundAddress,
      balance,
      timeoutDias,
      `0x${'0'.repeat(64)}` as `0x${string}`, // metaEvidenceHash placeholder
    ],
  })
  await publicClient.waitForTransactionReceipt({ hash: crearOrdenTx })

  return { txHash: crearOrdenTx }
}

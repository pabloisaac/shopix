import { FastifyInstance } from 'fastify'
import { parseAbi, parseUnits } from 'viem'
import { z } from 'zod'
import { publicClient, getAdminWalletClient } from '../lib/viem'

/**
 * Rutas de testnet — disponibles en producción SOLO en Sepolia.
 * Protegidas con MINT_SECRET para evitar abuso.
 */

const USDT_ABI = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
])

function getUsdtAddress() {
  return (process.env.USDT_ADDRESS || process.env.NEXT_PUBLIC_USDT_POLYGON_ADDRESS || '0x0') as `0x${string}`
}

export async function testnetRoutes(app: FastifyInstance) {
  // Bloquear si no es Sepolia
  app.addHook('onRequest', async (_request, reply) => {
    const network = process.env.NETWORK || 'hardhat'
    if (network !== 'sepolia' && network !== 'hardhat') {
      return reply.status(404).send({ error: 'Not found' })
    }
  })

  // POST /testnet/mint — mintear MockUSDT (requiere secret)
  // Body: { address, amount?, secret }
  app.post('/mint', async (request, reply) => {
    const schema = z.object({
      address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      amount:  z.number().min(1).max(100_000).default(10_000),
      secret:  z.string(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos', details: parsed.error.issues })
    }

    const mintSecret = process.env.MINT_SECRET
    if (!mintSecret || parsed.data.secret !== mintSecret) {
      return reply.status(401).send({ error: 'Secret inválido' })
    }

    const { address, amount } = parsed.data
    const walletClient = getAdminWalletClient()
    const usdtAddr = getUsdtAddress()

    if (usdtAddr === '0x0') {
      return reply.status(500).send({ error: 'USDT_ADDRESS no configurado' })
    }

    try {
      const hash = await walletClient.writeContract({
        address: usdtAddr,
        abi: USDT_ABI,
        functionName: 'mint',
        args: [address as `0x${string}`, parseUnits(amount.toString(), 6)],
      })
      await publicClient.waitForTransactionReceipt({ hash })

      const rawBalance = await publicClient.readContract({
        address: usdtAddr,
        abi: USDT_ABI,
        functionName: 'balanceOf',
        args: [address as `0x${string}`],
      })
      const newBalance = (Number(rawBalance) / 1e6).toFixed(2)

      return reply.send({ ok: true, txHash: hash, newBalance, amount, address })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })

  // GET /testnet/balance/:address — consultar balance MockUSDT
  app.get('/balance/:address', async (request, reply) => {
    const { address } = request.params as { address: string }
    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      return reply.status(400).send({ error: 'Dirección inválida' })
    }

    const usdtAddr = getUsdtAddress()
    try {
      const [usdtRaw, ethRaw] = await Promise.all([
        publicClient.readContract({
          address: usdtAddr,
          abi: USDT_ABI,
          functionName: 'balanceOf',
          args: [address as `0x${string}`],
        }),
        publicClient.getBalance({ address: address as `0x${string}` }),
      ])
      return reply.send({
        address,
        usdt: (Number(usdtRaw) / 1e6).toFixed(2),
        eth:  (Number(ethRaw)  / 1e18).toFixed(6),
        network: process.env.NETWORK || 'unknown',
      })
    } catch (err: any) {
      return reply.status(500).send({ error: err.message })
    }
  })
}

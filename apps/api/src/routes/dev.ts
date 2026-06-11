import { FastifyInstance } from 'fastify'
import { parseAbi, parseUnits } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { eq, ilike } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '../lib/db'
import { users } from '@shopix/db'
import { publicClient, getAdminWalletClient } from '../lib/viem'

// Cuentas Hardhat (dev only — claves públicamente conocidas)
export const HARDHAT_ACCOUNTS = [
  { index: 0, address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266', privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80', label: 'Deployer / Admin' },
  { index: 1, address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8', privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d', label: 'Vendedor' },
  { index: 2, address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC', privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a', label: 'Comprador' },
  { index: 3, address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906', privateKey: '0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6', label: 'Extra 1' },
  { index: 4, address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65', privateKey: '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926b', label: 'Extra 2' },
]

const USDT_ABI = parseAbi([
  'function mint(address to, uint256 amount) external',
  'function balanceOf(address account) external view returns (uint256)',
])

// Leído en runtime (no a nivel módulo) para respetar el orden de dotenv
function getUsdtAddress() {
  return (process.env.USDT_ADDRESS || process.env.NEXT_PUBLIC_USDT_POLYGON_ADDRESS || '0x0') as `0x${string}`
}

export async function devRoutes(app: FastifyInstance) {
  // Solo disponible en desarrollo
  app.addHook('onRequest', async (request, reply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ error: 'Not found' })
    }
  })

  // GET /dev/accounts — lista de cuentas Hardhat con balances
  app.get('/accounts', async (_request, reply) => {
    const accounts = await Promise.all(
      HARDHAT_ACCOUNTS.map(async (acc) => {
        let usdtBalance = '0'
        let ethBalance = '0'
        try {
          const rawUsdt = await publicClient.readContract({
            address: getUsdtAddress(),
            abi: USDT_ABI,
            functionName: 'balanceOf',
            args: [acc.address as `0x${string}`],
          })
          usdtBalance = (Number(rawUsdt) / 1e6).toFixed(2)

          const rawEth = await publicClient.getBalance({ address: acc.address as `0x${string}` })
          ethBalance = (Number(rawEth) / 1e18).toFixed(4)
        } catch {}

        // Buscar si tiene usuario en la DB
        const user = await db.query.users.findFirst({
          where: ilike(users.walletAddress, acc.address.toLowerCase()),
        })

        return {
          ...acc,
          usdtBalance,
          ethBalance,
          hasUser: !!user,
          username: user?.username || null,
          userId: user?.id || null,
        }
      })
    )
    return reply.send(accounts)
  })

  // POST /dev/mint — mintear USDT a una dirección
  app.post('/mint', async (request, reply) => {
    const schema = z.object({
      address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      amount: z.number().min(1).max(1_000_000).default(10_000),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'Datos inválidos' })
    }

    const { address, amount } = parsed.data
    const walletClient = getAdminWalletClient()

    const usdtAddr = getUsdtAddress()
    const hash = await walletClient.writeContract({
      address: usdtAddr,
      abi: USDT_ABI,
      functionName: 'mint',
      args: [address as `0x${string}`, parseUnits(amount.toString(), 6)],
    })
    await publicClient.waitForTransactionReceipt({ hash })

    // Leer balance nuevo
    const rawBalance = await publicClient.readContract({
      address: usdtAddr,
      abi: USDT_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })
    const newBalance = (Number(rawBalance) / 1e6).toFixed(2)

    return reply.send({ ok: true, txHash: hash, newBalance, amount })
  })

  // POST /dev/register — registrar una cuenta Hardhat como usuario en la DB
  app.post('/register', async (request, reply) => {
    const schema = z.object({
      address: z.string().regex(/^0x[0-9a-fA-F]{40}$/),
      username: z.string().min(3).max(30),
    })
    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'Datos inválidos' })

    const { address, username } = parsed.data
    const walletAddr = address.toLowerCase()

    const existing = await db.query.users.findFirst({
      where: ilike(users.walletAddress, walletAddr),
    })
    if (existing) return reply.send({ ok: true, user: existing, alreadyExists: true })

    const [user] = await db.insert(users).values({
      walletAddress: walletAddr,
      username,
    }).returning()

    return reply.status(201).send({ ok: true, user })
  })

  // GET /dev/status — info general del entorno
  app.get('/status', async (_request, reply) => {
    return reply.send({
      network: process.env.NETWORK || 'hardhat',
      contractAddress: process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
      usdtAddress: getUsdtAddress(),
      mockKlerosAddress: process.env.MOCK_KLEROS_ADDRESS,
    })
  })
}

import { ethers, network } from 'hardhat'
import * as fs from 'fs'
import * as path from 'path'

// Direcciones reales en Polygon mainnet/Amoy
const DEPLOYED_ADDRESSES: Record<string, { usdt: string; kleros: string }> = {
  amoy: {
    usdt: '0x1616C9941C7F4E32566E4847eFB5D5e699E2AF5D', // USDT testnet Amoy
    kleros: '0x90992fb4E15ce0C59aEFfb376460Fda4Ee19C879', // Kleros Amoy
  },
  polygon: {
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    kleros: '0x9C1dA9A04925bDfDedf0f6421bC7EEa8305F9002',
  },
}

async function main() {
  const [deployer] = await ethers.getSigners()
  console.log(`Deploying on network: ${network.name}`)
  console.log(`Deployer: ${deployer.address}`)

  let usdtAddress: string
  let klerosAddress: string

  if (network.name === 'localhost' || network.name === 'hardhat' || network.name === 'sepolia') {
    // Deploy mocks en local
    const MockUSDT = await ethers.getContractFactory('MockUSDT')
    const usdt = await MockUSDT.deploy()
    await usdt.waitForDeployment()
    usdtAddress = await usdt.getAddress()
    console.log(`MockUSDT deployed: ${usdtAddress}`)

    // Mintear 10k USDT al deployer para pruebas
    await usdt.mint(deployer.address, ethers.parseUnits('10000', 6))

    const MockKleros = await ethers.getContractFactory('MockKleros')
    const kleros = await MockKleros.deploy()
    await kleros.waitForDeployment()
    klerosAddress = await kleros.getAddress()
    console.log(`MockKleros deployed: ${klerosAddress}`)
  } else {
    const addrs = DEPLOYED_ADDRESSES[network.name]
    if (!addrs) throw new Error(`Unknown network: ${network.name}`)
    usdtAddress = addrs.usdt
    klerosAddress = addrs.kleros
  }

  const Escrow = await ethers.getContractFactory('MarketplaceEscrow')
  const escrow = await Escrow.deploy(usdtAddress, klerosAddress)
  await escrow.waitForDeployment()
  const escrowAddress = await escrow.getAddress()
  console.log(`MarketplaceEscrow deployed: ${escrowAddress}`)

  // Guardar direcciones deployadas
  const deploymentsDir = path.join(__dirname, '../deployments')
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true })
  }

  const deployment = {
    network: network.name,
    chainId: (await ethers.provider.getNetwork()).chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      MarketplaceEscrow: escrowAddress,
      USDT: usdtAddress,
      Kleros: klerosAddress,
    },
  }

  fs.writeFileSync(
    path.join(deploymentsDir, `${network.name}.json`),
    JSON.stringify(deployment, null, 2)
  )

  console.log('\nDeployment saved to deployments/', network.name + '.json')
  console.log('\nAdd to .env:')
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${escrowAddress}`)
  console.log(`NEXT_PUBLIC_USDT_ADDRESS=${usdtAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

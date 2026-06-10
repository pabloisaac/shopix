import { HardhatUserConfig } from 'hardhat/config'
import '@nomicfoundation/hardhat-toolbox'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const PRIVATE_KEY = process.env.PRIVATE_KEY_DEPLOYER ||
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' // hardhat default
const PRIVATE_KEY_AMOY = process.env.PRIVATE_KEY_AMOY || PRIVATE_KEY

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
      chainId: 31337,
    },
    amoy: {
      url: process.env.NEXT_PUBLIC_ALCHEMY_POLYGON_RPC || 'https://rpc-amoy.polygon.technology',
      chainId: 80002,
      accounts: [PRIVATE_KEY_AMOY],
      gasPrice: 'auto',
    },
    sepolia: {
      url: process.env.ALCHEMY_SEPOLIA_RPC || `https://eth-sepolia.g.alchemy.com/v2/${process.env.ALCHEMY_API_KEY}`,
      chainId: 11155111,
      accounts: [PRIVATE_KEY_AMOY],
      gasPrice: 'auto',
    },
  },
  paths: {
    sources: './contracts',
    tests: './test',
    cache: './cache',
    artifacts: './artifacts',
  },
  typechain: {
    outDir: './typechain-types',
    target: 'ethers-v6',
  },
}

export default config

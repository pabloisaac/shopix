# Cripex

Marketplace P2P con pagos en USDT y arbitraje descentralizado vía Kleros.

## Stack

- **Frontend**: Next.js 14 (App Router) · wagmi · RainbowKit · TailwindCSS
- **Backend**: Fastify 4 · Node.js · TypeScript · PostgreSQL · Redis · BullMQ
- **Contratos**: Solidity 0.8.20 · Hardhat · OpenZeppelin · Kleros ERC-792
- **ORM**: Drizzle ORM
- **IPFS**: Pinata
- **Red**: Polygon (mainnet) / Polygon Amoy (testnet)

## Correr el proyecto localmente

### Prerequisitos

```bash
node >= 20
pnpm >= 9
docker (para postgres + redis)
```

### Setup

```bash
# 1. Clonar e instalar dependencias
git clone <repo>
cd cripex
pnpm install

# 2. Variables de entorno
cp .env.example .env
# Editar .env con tus credenciales

# 3. Levantar infraestructura local
docker-compose up -d

# 4. Compilar contratos y deployar en red local
pnpm --filter @cripex/contracts build
npx hardhat node &   # en packages/contracts
pnpm contracts:deploy:local

# 5. Migrations y seed
pnpm db:migrate
pnpm db:seed

# 6. Correr todo en desarrollo
pnpm dev
```

### URLs locales

| Servicio | URL |
|---|---|
| Frontend | http://localhost:3000 |
| API | http://localhost:3001 |
| Hardhat node | http://localhost:8545 |
| PostgreSQL | localhost:5432 |
| Redis | localhost:6379 |

## Arquitectura

```
┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐
│   Next.js Web   │────▶│   Fastify API   │────▶│  PostgreSQL   │
│  wagmi/Rainbow  │     │  SIWE Auth      │     │  (Drizzle)    │
└────────┬────────┘     └────────┬────────┘     └───────────────┘
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐     ┌───────────────┐
│ MarketplaceEscr │     │   BullMQ Jobs   │────▶│    Redis      │
│ ow.sol (Polygon)│     │  auto-release   │     └───────────────┘
│ Kleros ERC-792  │     │  tracking poll  │
└─────────────────┘     └─────────────────┘
         │
         ▼
┌─────────────────┐
│  Kleros Court   │
│ (Arbitraje P2P) │
└─────────────────┘
```

## Flujo de una compra

1. Comprador llama `approve(escrowAddress, monto)` en el contrato USDT
2. Comprador llama `crearOrden(orderId, vendedor, monto, timeout, metaHash)` → USDT entra al escrow
3. Vendedor despacha y carga el tracking en la API
4. Si el comprador confirma recepción → `confirmarRecepcion()` → USDT al vendedor (menos fee)
5. Si expira el timeout sin disputa → cualquiera llama `autoRelease()` → USDT al vendedor
6. Si hay problema → comprador llama `abrirDisputa()` con MATIC para Kleros → jurados deciden

## Tests

```bash
# Contratos (todos deben pasar)
pnpm contracts:test

# API
pnpm --filter @cripex/api test
```

## Deploy en Polygon Amoy (testnet)

```bash
# Configurar PRIVATE_KEY_DEPLOYER en .env
pnpm --filter @cripex/contracts deploy:amoy
```

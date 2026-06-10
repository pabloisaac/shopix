# Cripex — Security Checklist

## Smart Contract Audit Checklist (pre-mainnet)

### Reentrancy Protection
- [x] `ReentrancyGuard` en todas las funciones que transfieren tokens: `crearOrden`, `confirmarRecepcion`, `autoRelease`, `abrirDisputa`
- [x] Pattern Check-Effects-Interactions: el estado se actualiza ANTES de las transferencias en `_liberarAlVendedor` y `_reembolsarAlComprador`

### Access Control
- [x] Solo Kleros (`address(arbitrator)`) puede llamar `rule()` — verificado con `require(msg.sender == address(arbitrator))`
- [x] Solo el owner puede cambiar el fee — máximo 5% hardcodeado
- [x] Solo el comprador puede confirmar recepción y abrir disputas
- [x] Solo el vendedor puede ser liberado (address no puede ser address(0))

### Overflow/Underflow
- [x] Protegido automáticamente por Solidity 0.8+ (checked arithmetic)

### Token Safety
- [x] La plataforma NUNCA retiene USDT de usuarios — los fondos van directamente al vendedor o comprador
- [x] Fee transferido al `owner()` en la misma transacción que la liberación
- [x] Si `transferFrom` falla, la transacción revierte (no hay fondos atrapados)

### Kleros Integration
- [x] El `disputeId` se mapea al `orderId` correctamente (`klerosIdAOrden`)
- [x] Solo una disputa por orden (verificar estado `Disputado`)
- [x] El exceso de MATIC es devuelto al comprador

### Known Risks
- **Rug pull**: El owner puede cambiar su propia address via `transferOwnership` (OpenZeppelin). En producción, se recomienda un multisig (Gnosis Safe) como owner.
- **Kleros downtime**: Si Kleros no emite ruling, los fondos pueden quedar bloqueados. Mitigación: mecanismo de timeout adicional para disputas (pendiente implementar).
- **USDT blacklist**: Tether puede blacklistear addresses. Si la address del vendedor es blacklisteada, la transferencia fallará. No hay mecanismo de recovery en v1.

## API Security

### Rate Limiting
- 100 req/min por IP en endpoints públicos
- 20 req/min por wallet en endpoints autenticados
- 5 req/min en upload de imágenes

### Authentication
- SIWE (Sign-In With Ethereum) — no hay contraseñas
- Nonces de un solo uso almacenados en Redis con TTL de 5 minutos
- JWT con expiración de 7 días

### Input Validation
- Zod schemas en todos los endpoints
- Validación de tipos y rangos en el contrato y la API

## Slither Analysis

```bash
cd packages/contracts
pip install slither-analyzer
slither contracts/MarketplaceEscrow.sol --solc-remaps "@openzeppelin=node_modules/@openzeppelin @kleros=node_modules/@kleros"
```

## Fuzzing

```bash
cd packages/contracts
npx hardhat test --grep "fuzzing"
```

## Recommended pre-mainnet steps

1. Auditoría externa por 2 firmas independientes
2. Bug bounty en Immunefi (min. $50k pool)
3. Multisig (3/5) para el owner del contrato
4. Deploy en Polygon Amoy + 3 meses de operación sin incidentes
5. Capping del volumen en los primeros 90 días ($500k USDT máximo en escrow simultáneo)

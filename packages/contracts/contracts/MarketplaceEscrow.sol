// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@kleros/erc-792/contracts/IArbitrable.sol";
import "@kleros/erc-792/contracts/IArbitrator.sol";

/// @title MarketplaceEscrow v2
/// @notice Escrow P2P sin comisiones. El operador (Shopix) ejecuta transacciones
///         técnicas pero nunca decide el resultado — eso lo hace Kleros o el comprador.
///         Vendedor y comprador pueden usar cualquier dirección (exchange, wallet, etc).
contract MarketplaceEscrow is IArbitrable, ReentrancyGuard, Ownable {

    IERC20  public immutable usdt;
    IArbitrator public immutable arbitrator;

    uint256 public constant RULING_OPTIONS = 2;  // 1=reembolso comprador, 2=pago vendedor
    uint256 public defaultTimeoutDias = 7;

    enum Estado {
        Activo,
        CompletadoComprador,
        CompletadoAutoRelease,
        Disputado,
        ResueltoPorKleros,
        Reembolsado
    }

    struct Orden {
        // Direcciones de origen (quién creó la orden on-chain)
        address operadorComprador;   // wallet Shopix que depositó en nombre del comprador
        address operadorVendedor;    // wallet Shopix que recibirá y enviará al vendedor

        // Direcciones de destino real (pueden ser exchanges como Nexo, BingX, etc.)
        address payoutAddress;       // adonde van los fondos cuando se libera al vendedor
        address refundAddress;       // adonde van los fondos si se reembolsa al comprador

        uint256 monto;
        uint256 creadoEn;
        uint256 timeoutEn;
        Estado  estado;
        uint256 klerosCaseId;
        bytes32 metaEvidenceHash;
    }

    mapping(bytes32 => Orden) public ordenes;
    mapping(uint256 => bytes32) public klerosIdAOrden;

    // ─── Eventos ────────────────────────────────────────────────────────

    event OrdenCreada(
        bytes32 indexed orderId,
        address indexed payoutAddress,
        address indexed refundAddress,
        uint256 monto,
        uint256 timeoutEn
    );
    event RecepcionConfirmada(bytes32 indexed orderId);
    event AutoReleaseEjecutado(bytes32 indexed orderId);
    event DisputaAbierta(bytes32 indexed orderId, uint256 klerosId);
    event EvidenciaSubida(bytes32 indexed orderId, string ipfsUri);
    event FondosLiberados(bytes32 indexed orderId, address indexed destino, uint256 monto);
    event FondosReembolsados(bytes32 indexed orderId, address indexed destino, uint256 monto);

    // ─── Constructor ────────────────────────────────────────────────────

    constructor(address _usdt, address _arbitrator) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        arbitrator = IArbitrator(_arbitrator);
    }

    // ─── Funciones principales ──────────────────────────────────────────

    /// @notice El operador de Shopix deposita USDT y crea la orden.
    ///         El USDT viene de la dirección de depósito única generada para el comprador.
    ///         payoutAddress  = dirección destino del vendedor (puede ser Nexo, BingX, etc.)
    ///         refundAddress  = dirección destino del comprador para reembolsos
    function crearOrden(
        bytes32 orderId,
        address payoutAddress,
        address refundAddress,
        uint256 monto,
        uint256 timeoutDias,
        bytes32 metaEvidenceHash
    ) external nonReentrant onlyOwner {
        require(ordenes[orderId].monto == 0,        "Orden ya existe");
        require(payoutAddress  != address(0),       "payoutAddress invalido");
        require(refundAddress  != address(0),       "refundAddress invalido");
        require(monto > 0,                          "Monto debe ser positivo");
        require(timeoutDias >= 1 && timeoutDias <= 30, "Timeout: 1-30 dias");

        bool ok = usdt.transferFrom(msg.sender, address(this), monto);
        require(ok, "Transferencia USDT fallida");

        ordenes[orderId] = Orden({
            operadorComprador: msg.sender,
            operadorVendedor:  msg.sender,
            payoutAddress:     payoutAddress,
            refundAddress:     refundAddress,
            monto:             monto,
            creadoEn:          block.timestamp,
            timeoutEn:         block.timestamp + (timeoutDias * 1 days),
            estado:            Estado.Activo,
            klerosCaseId:      0,
            metaEvidenceHash:  metaEvidenceHash
        });

        emit OrdenCreada(orderId, payoutAddress, refundAddress, monto, ordenes[orderId].timeoutEn);
    }

    /// @notice El operador confirma que el comprador recibió el producto.
    ///         Shopix solo llama esto cuando el comprador lo confirma en la web (sin wallet).
    function confirmarRecepcion(bytes32 orderId) external nonReentrant onlyOwner {
        Orden storage orden = ordenes[orderId];
        require(orden.estado == Estado.Activo, "Orden no activa");

        orden.estado = Estado.CompletadoComprador;
        _liberarAlVendedor(orderId);
        emit RecepcionConfirmada(orderId);
    }

    /// @notice Cualquiera puede llamar esto si el timeout expiró. Protege al vendedor.
    function autoRelease(bytes32 orderId) external nonReentrant {
        Orden storage orden = ordenes[orderId];
        require(orden.estado == Estado.Activo,           "Orden no activa");
        require(block.timestamp >= orden.timeoutEn,      "Timeout no alcanzado");

        orden.estado = Estado.CompletadoAutoRelease;
        _liberarAlVendedor(orderId);
        emit AutoReleaseEjecutado(orderId);
    }

    /// @notice El operador abre una disputa en Kleros en nombre del comprador.
    ///         Shopix paga el arbitration fee con ETH/MATIC propio.
    function abrirDisputa(bytes32 orderId) external payable nonReentrant onlyOwner {
        Orden storage orden = ordenes[orderId];
        require(orden.estado == Estado.Activo,   "Orden no activa");
        require(block.timestamp < orden.timeoutEn, "Timeout expirado");

        uint256 arbCost = arbitrator.arbitrationCost("");
        require(msg.value >= arbCost, "ETH insuficiente para Kleros");

        string memory metaUri = string(
            abi.encodePacked("ipfs://", _bytes32ToHex(orden.metaEvidenceHash))
        );

        uint256 klerosId = arbitrator.createDispute{value: arbCost}(
            RULING_OPTIONS,
            bytes(metaUri)
        );

        orden.estado        = Estado.Disputado;
        orden.klerosCaseId  = klerosId;
        klerosIdAOrden[klerosId] = orderId;

        if (msg.value > arbCost) {
            payable(msg.sender).transfer(msg.value - arbCost);
        }

        emit DisputaAbierta(orderId, klerosId);
    }

    /// @notice Subir evidencia IPFS. El operador la sube en nombre de las partes.
    function subirEvidencia(bytes32 orderId, string calldata ipfsUri) external onlyOwner {
        Orden storage orden = ordenes[orderId];
        require(orden.estado == Estado.Disputado, "Orden no en disputa");
        emit EvidenciaSubida(orderId, ipfsUri);
    }

    /// @notice Callback de Kleros — Shopix no decide, Kleros llama esto directamente.
    function rule(uint256 disputeId, uint256 ruling) external override {
        require(msg.sender == address(arbitrator), "Solo Kleros");

        bytes32 orderId = klerosIdAOrden[disputeId];
        Orden storage orden = ordenes[orderId];
        require(orden.estado == Estado.Disputado, "No en disputa");

        orden.estado = Estado.ResueltoPorKleros;

        if (ruling == 1) {
            _reembolsarAlComprador(orderId);
        } else {
            // ruling == 2 (vendedor gana) o ruling == 0 (sin consenso) → pagar al vendedor
            _liberarAlVendedor(orderId);
        }
    }

    // ─── Internals ──────────────────────────────────────────────────────

    /// @dev Sin comisiones — monto completo al vendedor (a su exchange/wallet de destino)
    function _liberarAlVendedor(bytes32 orderId) internal {
        Orden storage orden = ordenes[orderId];
        usdt.transfer(orden.payoutAddress, orden.monto);
        emit FondosLiberados(orderId, orden.payoutAddress, orden.monto);
    }

    /// @dev Reembolso completo al comprador (a su exchange/wallet de destino)
    function _reembolsarAlComprador(bytes32 orderId) internal {
        Orden storage orden = ordenes[orderId];
        usdt.transfer(orden.refundAddress, orden.monto);
        emit FondosReembolsados(orderId, orden.refundAddress, orden.monto);
    }

    function _bytes32ToHex(bytes32 data) internal pure returns (string memory) {
        bytes memory alphabet = "0123456789abcdef";
        bytes memory str = new bytes(64);
        for (uint256 i = 0; i < 32; i++) {
            str[i * 2]     = alphabet[uint8(data[i] >> 4)];
            str[i * 2 + 1] = alphabet[uint8(data[i] & 0x0f)];
        }
        return string(str);
    }

    // ─── Admin ──────────────────────────────────────────────────────────

    function actualizarTimeout(uint256 nuevosDias) external onlyOwner {
        require(nuevosDias >= 1 && nuevosDias <= 30, "1-30 dias");
        defaultTimeoutDias = nuevosDias;
    }

    /// @notice DEV ONLY — forzar fallo sin Kleros. Solo para testing.
    function devForceRuling(bytes32 orderId, uint256 ruling) external onlyOwner nonReentrant {
        Orden storage orden = ordenes[orderId];
        require(
            orden.estado == Estado.Activo || orden.estado == Estado.Disputado,
            "Estado invalido"
        );
        orden.estado = Estado.ResueltoPorKleros;
        if (ruling == 1) {
            _reembolsarAlComprador(orderId);
        } else {
            _liberarAlVendedor(orderId);
        }
    }

    receive() external payable {}
}

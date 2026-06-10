// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@kleros/erc-792/contracts/IArbitrable.sol";
import "@kleros/erc-792/contracts/IArbitrator.sol";

/// @title MarketplaceEscrow
/// @notice Escrow P2P con arbitraje descentralizado via Kleros. La plataforma nunca custodia fondos propios.
contract MarketplaceEscrow is IArbitrable, ReentrancyGuard, Ownable {

    IERC20 public immutable usdt;
    IArbitrator public immutable arbitrator;

    uint256 public platformFeeBps = 150;          // 1.5%
    uint256 public constant RULING_OPTIONS = 2;   // 1=comprador, 2=vendedor
    uint256 public defaultTimeout = 7 days;

    enum Estado {
        Activo,
        CompletadoComprador,
        CompletadoAutoRelease,
        Disputado,
        ResueltoPorKleros,
        Reembolsado
    }

    struct Orden {
        address comprador;
        address vendedor;
        uint256 monto;
        uint256 creadoEn;
        uint256 timeoutEn;
        Estado estado;
        uint256 klerosCaseId;
        bool compradorConfirmo;
        bytes32 metaEvidenceHash;
    }

    mapping(bytes32 => Orden) public ordenes;
    mapping(uint256 => bytes32) public klerosIdAOrden;

    event OrdenCreada(
        bytes32 indexed orderId,
        address indexed comprador,
        address indexed vendedor,
        uint256 monto,
        uint256 timeoutEn
    );
    event RecepcionConfirmada(bytes32 indexed orderId);
    event AutoReleaseEjecutado(bytes32 indexed orderId);
    event DisputaEnviadaAKleros(bytes32 indexed orderId, uint256 klerosId);
    event EvidenciaSubida(bytes32 indexed orderId, address indexed parte, string ipfsUri);
    event FondosLiberados(bytes32 indexed orderId, address indexed destinatario, uint256 monto);
    event Reembolsado(bytes32 indexed orderId, address indexed comprador, uint256 monto);

    constructor(address _usdt, address _arbitrator) Ownable(msg.sender) {
        usdt = IERC20(_usdt);
        arbitrator = IArbitrator(_arbitrator);
    }

    /// @notice El comprador deposita USDT y crea la orden.
    /// @dev Requiere approve() previo del comprador al contrato por `monto`.
    function crearOrden(
        bytes32 orderId,
        address vendedor,
        uint256 monto,
        uint256 timeoutDias,
        bytes32 metaEvidenceHash
    ) external nonReentrant {
        require(ordenes[orderId].monto == 0, "Orden ya existe");
        require(vendedor != address(0) && vendedor != msg.sender, "Vendedor invalido");
        require(monto > 0, "Monto debe ser positivo");
        require(timeoutDias >= 1 && timeoutDias <= 30, "Timeout: 1-30 dias");

        bool ok = usdt.transferFrom(msg.sender, address(this), monto);
        require(ok, "Transferencia USDT fallida");

        ordenes[orderId] = Orden({
            comprador: msg.sender,
            vendedor: vendedor,
            monto: monto,
            creadoEn: block.timestamp,
            timeoutEn: block.timestamp + (timeoutDias * 1 days),
            estado: Estado.Activo,
            klerosCaseId: 0,
            compradorConfirmo: false,
            metaEvidenceHash: metaEvidenceHash
        });

        emit OrdenCreada(orderId, msg.sender, vendedor, monto, ordenes[orderId].timeoutEn);
    }

    /// @notice El comprador confirma que recibió el producto. Libera fondos al vendedor descontando el fee.
    function confirmarRecepcion(bytes32 orderId) external nonReentrant {
        Orden storage orden = ordenes[orderId];
        require(msg.sender == orden.comprador, "Solo el comprador");
        require(orden.estado == Estado.Activo, "Orden no activa");

        orden.estado = Estado.CompletadoComprador;
        orden.compradorConfirmo = true;
        _liberarAlVendedor(orderId);
        emit RecepcionConfirmada(orderId);
    }

    /// @notice Cualquiera puede llamar esto si el timeout expiró sin disputa. Protege al vendedor.
    function autoRelease(bytes32 orderId) external nonReentrant {
        Orden storage orden = ordenes[orderId];
        require(orden.estado == Estado.Activo, "Orden no activa");
        require(block.timestamp >= orden.timeoutEn, "Timeout no alcanzado");

        orden.estado = Estado.CompletadoAutoRelease;
        _liberarAlVendedor(orderId);
        emit AutoReleaseEjecutado(orderId);
    }

    /// @notice El comprador abre una disputa. Paga el arbitration fee de Kleros en MATIC/POL.
    function abrirDisputa(bytes32 orderId) external payable nonReentrant {
        Orden storage orden = ordenes[orderId];
        require(msg.sender == orden.comprador, "Solo el comprador");
        require(orden.estado == Estado.Activo, "Orden no activa");
        require(block.timestamp < orden.timeoutEn, "Timeout expirado, usar autoRelease");

        uint256 arbCost = arbitrator.arbitrationCost("");
        require(msg.value >= arbCost, "MATIC insuficiente para Kleros");

        string memory metaUri = string(
            abi.encodePacked("ipfs://", _bytes32ToHex(orden.metaEvidenceHash))
        );

        uint256 klerosId = arbitrator.createDispute{value: arbCost}(
            RULING_OPTIONS,
            bytes(metaUri)
        );

        orden.estado = Estado.Disputado;
        orden.klerosCaseId = klerosId;
        klerosIdAOrden[klerosId] = orderId;

        if (msg.value > arbCost) {
            payable(msg.sender).transfer(msg.value - arbCost);
        }

        emit DisputaEnviadaAKleros(orderId, klerosId);
    }

    /// @notice Subir evidencia IPFS. Solo las partes pueden llamarlo mientras la orden está Disputada.
    function subirEvidencia(bytes32 orderId, string calldata ipfsUri) external {
        Orden storage orden = ordenes[orderId];
        require(
            msg.sender == orden.comprador || msg.sender == orden.vendedor,
            "Solo las partes"
        );
        require(orden.estado == Estado.Disputado, "Orden no en disputa");
        emit EvidenciaSubida(orderId, msg.sender, ipfsUri);
    }

    /// @notice Callback de Kleros con el fallo. Implementa IArbitrable.
    function rule(uint256 disputeId, uint256 ruling) external override {
        require(msg.sender == address(arbitrator), "Solo Kleros");

        bytes32 orderId = klerosIdAOrden[disputeId];
        Orden storage orden = ordenes[orderId];
        require(orden.estado == Estado.Disputado, "No en disputa");

        orden.estado = Estado.ResueltoPorKleros;
        // El evento Ruling se hereda de IArbitrable

        if (ruling == 1) {
            _reembolsarAlComprador(orderId);
        } else {
            // ruling == 2 (vendedor) o ruling == 0 (sin consenso) → pagar al vendedor
            _liberarAlVendedor(orderId);
        }
    }

    // ─── Internals ──────────────────────────────────────────────────────

    function _liberarAlVendedor(bytes32 orderId) internal {
        Orden storage orden = ordenes[orderId];
        uint256 fee = (orden.monto * platformFeeBps) / 10000;
        uint256 montoVendedor = orden.monto - fee;

        // Check-Effects-Interactions: estado ya actualizado antes de llamar aquí
        usdt.transfer(orden.vendedor, montoVendedor);
        if (fee > 0) usdt.transfer(owner(), fee);

        emit FondosLiberados(orderId, orden.vendedor, montoVendedor);
    }

    function _reembolsarAlComprador(bytes32 orderId) internal {
        Orden storage orden = ordenes[orderId];
        usdt.transfer(orden.comprador, orden.monto);
        emit Reembolsado(orderId, orden.comprador, orden.monto);
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

    /// @notice Actualiza el fee de plataforma. Máximo 5% para proteger a los usuarios.
    function actualizarFee(uint256 nuevoBps) external onlyOwner {
        require(nuevoBps <= 500, "Max 5%");
        platformFeeBps = nuevoBps;
    }

    function actualizarTimeout(uint256 nuevosDias) external onlyOwner {
        require(nuevosDias >= 1 && nuevosDias <= 30, "1-30 dias");
        defaultTimeout = nuevosDias * 1 days;
    }

    /// @notice DEV ONLY — permite al owner forzar el fallo sin pasar por Kleros.
    /// @dev Solo para entornos de prueba. Nunca deployar esto en producción.
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

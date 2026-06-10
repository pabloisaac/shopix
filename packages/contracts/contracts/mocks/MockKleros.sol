// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@kleros/erc-792/contracts/IArbitrator.sol";
import "@kleros/erc-792/contracts/IArbitrable.sol";

/// @dev Simulador de Kleros para tests locales. Permite emitir fallos manualmente.
contract MockKleros is IArbitrator {
    uint256 public constant ARB_COST = 0.01 ether;
    uint256 private nextDisputeId = 1;

    struct Dispute {
        IArbitrable arbitrable;
        uint256 choices;
        uint256 ruling;
        bool ruled;
    }

    mapping(uint256 => Dispute) public disputes;

    function arbitrationCost(bytes calldata) external pure override returns (uint256) {
        return ARB_COST;
    }

    function appealCost(uint256, bytes calldata) external pure override returns (uint256) {
        return ARB_COST * 2;
    }

    function createDispute(uint256 _choices, bytes calldata _extraData)
        external
        payable
        override
        returns (uint256 disputeId)
    {
        require(msg.value >= ARB_COST, "Insufficient arbitration fee");
        disputeId = nextDisputeId++;
        disputes[disputeId] = Dispute({
            arbitrable: IArbitrable(msg.sender),
            choices: _choices,
            ruling: 0,
            ruled: false
        });
        emit DisputeCreation(disputeId, IArbitrable(msg.sender));
    }

    function appeal(uint256, bytes calldata) external payable override {}

    function appealPeriod(uint256) external pure override returns (uint256, uint256) {
        return (0, 0);
    }

    function disputeStatus(uint256 _disputeId) external view override returns (DisputeStatus) {
        return disputes[_disputeId].ruled
            ? DisputeStatus.Solved
            : DisputeStatus.Waiting;
    }

    function currentRuling(uint256 _disputeId) external view override returns (uint256) {
        return disputes[_disputeId].ruling;
    }

    /// @notice Emitir fallo manualmente en tests.
    function giveRuling(uint256 _disputeId, uint256 _ruling) external {
        Dispute storage d = disputes[_disputeId];
        require(!d.ruled, "Already ruled");
        d.ruling = _ruling;
        d.ruled = true;
        d.arbitrable.rule(_disputeId, _ruling);
    }
}

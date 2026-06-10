"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NETWORKS = exports.RULING = exports.DEFAULT_TIMEOUT_DAYS = exports.PLATFORM_FEE_BPS = exports.USDT_DECIMALS = void 0;
exports.USDT_DECIMALS = 6;
exports.PLATFORM_FEE_BPS = 150; // 1.5%
exports.DEFAULT_TIMEOUT_DAYS = 7;
exports.RULING = {
    NO_RULING: 0,
    BUYER_WINS: 1,
    SELLER_WINS: 2,
};
exports.NETWORKS = {
    POLYGON: 137,
    POLYGON_AMOY: 80002,
    HARDHAT: 31337,
};

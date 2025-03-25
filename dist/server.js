"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const swagger_1 = require("./swagger/swagger");
const routes_1 = __importDefault(require("./routes"));
const blockchain_1 = require("./services/blockchain");
const parse_1 = require("./services/parse");
const logger_1 = __importDefault(require("./utils/logger"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'http://localhost';
const chainConfig = {
    rpcPoolMap: new Map([
        [
            1,
            {
                rpcPool: [
                    process.env.ETH_RPC_MAINNET ||
                        'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
                ],
            },
        ],
    ]),
    blockRange: parseInt(process.env.BLOCK_RANGE || '100', 10),
    blockDelayed: parseInt(process.env.BLOCK_DELAYED || '6', 10),
    syncInterval: parseInt(process.env.SYNC_INTERVAL || '10000', 10),
};
app.use(express_1.default.json());
app.use('/api', routes_1.default);
(0, swagger_1.setupSwagger)(app);
//区块链服务
const blockchainService = new blockchain_1.BlockchainService(chainConfig);
blockchainService.start();
//解析服务
const parseService = new parse_1.ParseService(parseInt(process.env.PARSE_INTERVAL || '30000', 10));
parseService.start();
app.listen(PORT, () => {
    logger_1.default.info(`服务器运行在 ${HOST}:${PORT}`);
    logger_1.default.info(`API 文档在 ${HOST}:${PORT}/docs`);
});

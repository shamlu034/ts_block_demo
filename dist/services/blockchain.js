"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const ethers_1 = require("ethers");
const mysqlQueryBuilder_1 = require("../utils/mysqlQueryBuilder");
const logger_1 = __importDefault(require("../utils/logger"));
class BlockchainService {
    constructor(chainConfig) {
        this.isSyncing = false; // 防止重叠的标志
        this.chainConfig = chainConfig;
    }
    // 获取最新区块号
    getLatestBlock(rpc) {
        return __awaiter(this, void 0, void 0, function* () {
            const provider = new ethers_1.ethers.JsonRpcProvider(rpc);
            return provider.getBlockNumber();
        });
    }
    // 获取交易发送者
    getSender(provider, txHash) {
        return __awaiter(this, void 0, void 0, function* () {
            const tx = yield provider.getTransaction(txHash);
            return (tx === null || tx === void 0 ? void 0 : tx.from) || '0x0';
        });
    }
    // 获取区块时间戳
    getTimestamp(provider, blockNumber) {
        return __awaiter(this, void 0, void 0, function* () {
            const block = yield provider.getBlock(blockNumber);
            return (block === null || block === void 0 ? void 0 : block.timestamp) || 0;
        });
    }
    // 同步事件
    syncEvents() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSyncing) {
                logger_1.default.info('上一个同步仍在进行中，跳过本次循环');
                return;
            }
            this.isSyncing = true;
            // 从数据库获取扫描任务
            try {
                const scanTasks = yield mysqlQueryBuilder_1.queryBuilder
                    .select({
                    table: 'scan_tasks',
                })
                    .catch((err) => {
                    logger_1.default.error('获取扫描任务失败:', err);
                    return [];
                });
                if (!scanTasks.length) {
                    logger_1.default.info('无扫描任务');
                    return;
                }
                // 按链 ID 组织数据
                const chainIds = [];
                const chainIdTofrom_block = new Map();
                const chainIdToContracts = new Map();
                const chainIdToScanTasks = new Map();
                for (const task of scanTasks) {
                    const contracts = chainIdToContracts.get(task.chain_id) || [];
                    if (!contracts.includes(task.address)) {
                        contracts.push(task.address);
                        chainIdToContracts.set(task.chain_id, contracts);
                        if (!chainIds.includes(task.chain_id)) {
                            chainIds.push(task.chain_id);
                        }
                    }
                    const currentFrom = chainIdTofrom_block.get(task.chain_id);
                    if (!currentFrom || task.from_block < currentFrom) {
                        chainIdTofrom_block.set(task.chain_id, task.from_block);
                    }
                    const tasks = chainIdToScanTasks.get(task.chain_id) || [];
                    tasks.push(task);
                    chainIdToScanTasks.set(task.chain_id, tasks);
                }
                // 存储结果
                const chainToEventData = new Map();
                const chainToToBlock = new Map();
                logger_1.default.info(`扫描任务: ${chainIds}`);
                // 并发扫描每个链
                yield Promise.all(chainIds.map((chain_id) => __awaiter(this, void 0, void 0, function* () {
                    const config = this.chainConfig.rpcPoolMap.get(chain_id);
                    if (!config || !config.rpcPool.length) {
                        logger_1.default.warn(`链 ${chain_id} 未配置 RPC `);
                        return;
                    }
                    const rpc = config.rpcPool[Math.floor(Math.random() * config.rpcPool.length)];
                    const provider = new ethers_1.ethers.JsonRpcProvider(rpc);
                    const blockRange = this.chainConfig.blockRange;
                    const blockDelayed = this.chainConfig.blockDelayed;
                    const from_block = chainIdTofrom_block.get(chain_id) || 0;
                    let toBlock = (yield this.getLatestBlock(rpc)) - blockDelayed;
                    if (toBlock <= 0 || toBlock < from_block) {
                        logger_1.default.warn(`无效区块范围: chain_id=${chain_id}, toBlock=${toBlock}, from_block=${from_block}`);
                        return;
                    }
                    if (from_block + blockRange < toBlock) {
                        toBlock = from_block + blockRange;
                    }
                    logger_1.default.info(`扫描链 ${chain_id} 区块范围: ${from_block}-${toBlock}`);
                    const eventKeccaks = (chainIdToScanTasks.get(chain_id) || []).map((task) => ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(task.event_keccak)));
                    const contracts = chainIdToContracts.get(chain_id) || [];
                    const filter = {
                        address: contracts,
                        fromBlock: from_block,
                        toBlock: toBlock,
                        topics: [[...new Set(eventKeccaks)]],
                    };
                    try {
                        const logs = yield provider.getLogs(filter);
                        const eventData = [];
                        for (const log of logs) {
                            if (log.topics.length === 0 || log.removed)
                                continue;
                            const tasks = chainIdToScanTasks.get(chain_id) || [];
                            for (const task of tasks) {
                                const eventKeccak = ethers_1.ethers.keccak256(ethers_1.ethers.toUtf8Bytes(task.event_keccak));
                                if (log.topics[0] !== eventKeccak ||
                                    log.address.toLowerCase() !==
                                        task.address.toLowerCase()) {
                                    continue;
                                }
                                logger_1.default.info(`开始查询 event_data 的数量 chain_id=${chain_id}, event_type=${task.event_type}, block_number=${log.transactionHash}`);
                                // 检查事件是否已存在
                                const count = yield mysqlQueryBuilder_1.queryBuilder.count('event_data', {
                                    chain_id,
                                    event_type: task.event_type,
                                    tx_hash: log.transactionHash,
                                });
                                if (count > 0) {
                                    logger_1.default.warn(`事件已存在: chainId=${chain_id}, event_type=${task.event_type}, block_number=${log.blockNumber}, txHash=${log.transactionHash}`);
                                    continue;
                                }
                                const topics = log.topics.map((t) => t.toLowerCase());
                                const data = ethers_1.ethers.hexlify(log.data);
                                const sender = yield this.getSender(provider, log.transactionHash);
                                const timestamp = yield this.getTimestamp(provider, log.blockNumber);
                                logger_1.default.info(`push event_data: chain_id=${chain_id}, sender=${sender}, event_type=${task.event_type}, block_number=${log.blockNumber}, timestamp=${timestamp}, tx_hash=${log.transactionHash}, log_index=${log.index}`);
                                eventData.push({
                                    chain_id,
                                    sender,
                                    event_type: task.event_type,
                                    address: log.address,
                                    topic0: topics[0] || '',
                                    topic1: topics[1] || '',
                                    topic2: topics[2] || '',
                                    topic3: topics[3] || '',
                                    data,
                                    log_index: log.index,
                                    tx_hash: log.transactionHash,
                                    block_number: log.blockNumber,
                                    timestamp,
                                    tx_index: log.transactionIndex,
                                });
                                break; // 匹配后跳出任务循环
                            }
                        }
                        chainToEventData.set(chain_id, eventData);
                        chainToToBlock.set(chain_id, toBlock + 1);
                    }
                    catch (err) {
                        logger_1.default.error(`扫描链 ${chain_id} 失败:`, err);
                    }
                })));
                // 批量写入数据库
                for (const chainId of chainIds) {
                    const toBlock = chainToToBlock.get(chainId);
                    if (toBlock) {
                        yield mysqlQueryBuilder_1.queryBuilder.update('scan_tasks', { from_block: toBlock }, { chain_id: chainId });
                    }
                    const eventData = chainToEventData.get(chainId) || [];
                    if (eventData.length > 0) {
                        yield mysqlQueryBuilder_1.queryBuilder.insertBatch('event_data', eventData); // 批量插入
                    }
                }
            }
            finally {
                this.isSyncing = false;
                const interval = this.chainConfig.syncInterval || 60000;
                setTimeout(() => this.syncEvents().catch(logger_1.default.error), interval); // 下次调度
            }
        });
    }
    // 启动服务
    start() {
        this.syncEvents().catch(logger_1.default.error);
    }
}
exports.BlockchainService = BlockchainService;

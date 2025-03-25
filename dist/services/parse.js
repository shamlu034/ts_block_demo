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
exports.ParseService = void 0;
const logger_1 = __importDefault(require("../utils/logger"));
const mysqlQueryBuilder_1 = require("../utils/mysqlQueryBuilder");
// 解析 event_data 中的 data 字段，获取钱包地址和金额
function parseEventData(data) {
    if (data.length !== 130) {
        logger_1.default.error('Invalid data length:', data.length);
        throw new Error('Invalid data length');
    }
    const wallet = '0x' + data.slice(26, 66); // 解析钱包地址
    const amount = BigInt('0x' + data.slice(66)); // 解析金额为大整数
    logger_1.default.info('解析成功:', wallet, amount.toString());
    return { wallet, amount };
}
class ParseService {
    constructor(syncInterval) {
        this.isSyncing = false; // 防止重复同步
        this.interval = syncInterval;
    }
    // 处理事件并同步数据
    processEvent(event) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const { wallet, amount } = parseEventData(event.data);
                // 根据事件类型处理 Staked 或 UnStaked
                if (event.event_type === 'Staked') {
                    yield this.handleStaked(wallet, amount);
                }
                else if (event.event_type === 'UnStaked') {
                    yield this.handleUnStaked(wallet, amount);
                }
                // 更新 event_data 的 version 字段为 1，标记为已处理
                yield mysqlQueryBuilder_1.queryBuilder.update('event_data', { version: 1 }, { id: event.id });
                logger_1.default.info(`✅ 处理完成: ${event.event_type} - ${wallet} - ${amount}`);
            }
            catch (error) {
                logger_1.default.error(`❌ 处理事件失败: ${event.id} - `, error);
            }
        });
    }
    // 处理 Staked 事件
    handleStaked(wallet, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.getUser(wallet);
            if (user) {
                // 将当前的 `total_staked` 和 `current_staked` 转换为 BigInt 类型进行运算
                const totalStaked = BigInt(user.total_staked);
                const currentStaked = BigInt(user.current_staked);
                // 更新已有用户的 total_staked 和 current_staked
                yield mysqlQueryBuilder_1.queryBuilder.update('user', {
                    total_staked: (totalStaked + amount).toString(),
                    current_staked: (currentStaked + amount).toString(),
                }, { address: wallet });
            }
            else {
                // 用户不存在时插入新的记录
                yield mysqlQueryBuilder_1.queryBuilder.insert('user', {
                    address: wallet,
                    total_staked: amount.toString(),
                    total_unstaked: '0',
                    current_staked: amount.toString(),
                });
            }
        });
    }
    // 处理 UnStaked 事件
    handleUnStaked(wallet, amount) {
        return __awaiter(this, void 0, void 0, function* () {
            const user = yield this.getUser(wallet);
            if (user) {
                // 将当前的 `total_unstaked` 和 `current_staked` 转换为 BigInt 类型进行运算
                const totalUnstaked = BigInt(user.total_unstaked);
                const currentStaked = BigInt(user.current_staked);
                // 更新已有用户的 total_unstaked 和 current_staked
                yield mysqlQueryBuilder_1.queryBuilder.update('user', {
                    total_unstaked: (totalUnstaked + amount).toString(),
                    current_staked: (currentStaked - amount).toString(),
                }, { address: wallet });
                logger_1.default.error('wellet:', wallet, '当前 UnStaked 金额:', currentStaked.toString(), amount.toString(), '减去后:', (currentStaked - amount).toString());
            }
            else {
                // 用户不存在时插入新的记录
                yield mysqlQueryBuilder_1.queryBuilder.insert('user', {
                    address: wallet,
                    total_staked: '0',
                    total_unstaked: amount.toString(),
                    current_staked: '0',
                });
            }
        });
    }
    // 获取用户信息
    getUser(wallet) {
        return __awaiter(this, void 0, void 0, function* () {
            const users = yield mysqlQueryBuilder_1.queryBuilder.select({
                table: 'user',
                where: { address: wallet },
                fields: ['id', 'total_staked', 'current_staked', 'total_unstaked'],
                limit: { count: 1 },
            });
            return users.length > 0 ? users[0] : null;
        });
    }
    // 同步解析事件数据
    syncParse() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isSyncing) {
                logger_1.default.info('上一个同步仍在进行中，跳过本次循环');
                return;
            }
            this.isSyncing = true;
            try {
                // 查询未处理的事件数据
                const events = yield mysqlQueryBuilder_1.queryBuilder.select({
                    table: 'event_data',
                    where: { version: 0 },
                    limit: { count: 10 },
                });
                for (const event of events) {
                    yield this.processEvent(event);
                }
            }
            catch (error) {
                logger_1.default.error('❌ 解析 event_data 失败:', error);
            }
            finally {
                this.isSyncing = false;
                setTimeout(() => this.syncParse().catch(logger_1.default.error), this.interval); // 调度下次同步
            }
        });
    }
    // 启动解析服务
    start() {
        this.syncParse().catch(logger_1.default.error);
    }
}
exports.ParseService = ParseService;

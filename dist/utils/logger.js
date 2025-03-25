"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
// ANSI 颜色码
const COLORS = {
    RESET: '\x1b[0m', // 重置颜色
    RED: '\x1b[31m', // 红色（错误）
    YELLOW: '\x1b[33m', // 黄色（警告）
    GREEN: '\x1b[32m', // 绿色（信息）
    BLUE: '\x1b[34m', // 蓝色（调试）
};
class Logger {
    constructor() {
        this.logDir = path.join(__dirname, '../logs'); // 日志文件存放路径
        this.info = this.info.bind(this);
        this.warn = this.warn.bind(this);
        this.error = this.error.bind(this);
        this.debug = this.debug.bind(this);
        this.ensureLogDirExists(); // 确保日志目录存在
        this.logStream = this.createLogStream();
    }
    // 确保日志目录存在
    ensureLogDirExists() {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true });
        }
    }
    // 创建日志文件流
    createLogStream() {
        const logFilePath = path.join(this.logDir, `${this.getCurrentDate()}.log`);
        return fs.createWriteStream(logFilePath, { flags: 'a' }); // 追加写入
    }
    // 获取当前日期字符串（YYYY-MM-DD）
    getCurrentDate() {
        return new Date().toISOString().split('T')[0]; // 例如："2025-03-25"
    }
    // 生成日志前缀（时间戳 + 调用信息）
    formatMessage(level, ...args) {
        var _a;
        const stack = (_a = new Error().stack) === null || _a === void 0 ? void 0 : _a.split('\n')[4]; // 获取调用栈信息
        const callerInfo = (stack === null || stack === void 0 ? void 0 : stack.match(/at (.*) \((.*):(\d+):(\d+)\)/)) ||
            (stack === null || stack === void 0 ? void 0 : stack.match(/at (.*):(\d+):(\d+)/));
        const timestamp = new Date().toISOString();
        const functionName = (callerInfo === null || callerInfo === void 0 ? void 0 : callerInfo[1]) || 'anonymous';
        const fullFilePath = (callerInfo === null || callerInfo === void 0 ? void 0 : callerInfo[2]) || 'unknown';
        const fileName = path.basename(fullFilePath);
        const lineNumber = (callerInfo === null || callerInfo === void 0 ? void 0 : callerInfo[3]) || 'unknown';
        return `[${timestamp}] [${fileName}:${lineNumber}] [${functionName}] [${level.toUpperCase()}]`;
    }
    // 根据日志级别获取颜色
    getColor(level) {
        switch (level) {
            case 'info':
                return COLORS.GREEN;
            case 'warn':
                return COLORS.YELLOW;
            case 'error':
                return COLORS.RED;
            case 'debug':
                return COLORS.BLUE;
            default:
                return COLORS.RESET;
        }
    }
    // 通用日志方法，输出到控制台 + 写入文件
    log(level, ...args) {
        const color = this.getColor(level);
        const message = this.formatMessage(level, ...args);
        const logText = `${message} ${args.join(' ')}`;
        // 输出到控制台（带颜色）
        console.log(`${color}${logText}${COLORS.RESET}`);
        // 输出到日志文件
        this.logStream.write(logText + '\n');
    }
    // 公开方法：不同级别的日志
    info(...args) {
        this.log('info', ...args);
    }
    warn(...args) {
        this.log('warn', ...args);
    }
    error(...args) {
        this.log('error', ...args);
    }
    debug(...args) {
        this.log('debug', ...args);
    }
}
exports.default = new Logger();

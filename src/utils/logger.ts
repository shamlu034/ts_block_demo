import * as fs from 'fs'
import * as path from 'path'

// ANSI 颜色码
const COLORS = {
    RESET: '\x1b[0m', // 重置颜色
    RED: '\x1b[31m', // 红色（错误）
    YELLOW: '\x1b[33m', // 黄色（警告）
    GREEN: '\x1b[32m', // 绿色（信息）
    BLUE: '\x1b[34m', // 蓝色（调试）
}

// 日志级别类型
type LogLevel = 'info' | 'warn' | 'error' | 'debug'

class Logger {
    private logDir = path.join(__dirname, '../logs') // 日志文件存放路径
    private logStream: fs.WriteStream

    constructor() {
        this.info = this.info.bind(this)
        this.warn = this.warn.bind(this)
        this.error = this.error.bind(this)
        this.debug = this.debug.bind(this)

        this.ensureLogDirExists() // 确保日志目录存在
        this.logStream = this.createLogStream()
    }

    // 确保日志目录存在
    private ensureLogDirExists(): void {
        if (!fs.existsSync(this.logDir)) {
            fs.mkdirSync(this.logDir, { recursive: true })
        }
    }

    // 创建日志文件流
    private createLogStream(): fs.WriteStream {
        const logFilePath = path.join(
            this.logDir,
            `${this.getCurrentDate()}.log`
        )
        return fs.createWriteStream(logFilePath, { flags: 'a' }) // 追加写入
    }

    // 获取当前日期字符串（YYYY-MM-DD）
    private getCurrentDate(): string {
        return new Date().toISOString().split('T')[0] // 例如："2025-03-25"
    }

    // 生成日志前缀（时间戳 + 调用信息）
    private formatMessage(level: LogLevel, ...args: any[]): string {
        const stack = new Error().stack?.split('\n')[4] // 获取调用栈信息
        const callerInfo =
            stack?.match(/at (.*) \((.*):(\d+):(\d+)\)/) ||
            stack?.match(/at (.*):(\d+):(\d+)/)

        const timestamp = new Date().toISOString()
        const functionName = callerInfo?.[1] || 'anonymous'
        const fullFilePath = callerInfo?.[2] || 'unknown'
        const fileName = path.basename(fullFilePath)
        const lineNumber = callerInfo?.[3] || 'unknown'

        return `[${timestamp}] [${fileName}:${lineNumber}] [${functionName}] [${level.toUpperCase()}]`
    }

    // 根据日志级别获取颜色
    private getColor(level: LogLevel): string {
        switch (level) {
            case 'info':
                return COLORS.GREEN
            case 'warn':
                return COLORS.YELLOW
            case 'error':
                return COLORS.RED
            case 'debug':
                return COLORS.BLUE
            default:
                return COLORS.RESET
        }
    }

    // 通用日志方法，输出到控制台 + 写入文件
    private log(level: LogLevel, ...args: any[]): void {
        const color = this.getColor(level)
        const message = this.formatMessage(level, ...args)
        const logText = `${message} ${args.join(' ')}`

        // 输出到控制台（带颜色）
        console.log(`${color}${logText}${COLORS.RESET}`)

        // 输出到日志文件
        this.logStream.write(logText + '\n')
    }

    // 公开方法：不同级别的日志
    info(...args: any[]): void {
        this.log('info', ...args)
    }

    warn(...args: any[]): void {
        this.log('warn', ...args)
    }

    error(...args: any[]): void {
        this.log('error', ...args)
    }

    debug(...args: any[]): void {
        this.log('debug', ...args)
    }
}

export default new Logger()

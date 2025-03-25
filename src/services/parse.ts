import { User } from '../models/user'
import logger from '../utils/logger'
import { queryBuilder } from '../utils/mysqlQueryBuilder'

// 解析 event_data 中的 data 字段，获取钱包地址和金额
function parseEventData(data: string): { wallet: string; amount: bigint } {
    if (data.length !== 130) {
        logger.error('Invalid data length:', data.length)
        throw new Error('Invalid data length')
    }
    const wallet = '0x' + data.slice(26, 66) // 解析钱包地址
    const amount = BigInt('0x' + data.slice(66)) // 解析金额为大整数
    logger.info('解析成功:', wallet, amount.toString())
    return { wallet, amount }
}

export class ParseService {
    private interval: number
    private isSyncing: boolean = false // 防止重复同步

    constructor(syncInterval: number) {
        this.interval = syncInterval
    }

    // 处理事件并同步数据
    private async processEvent(event: any): Promise<void> {
        try {
            const { wallet, amount } = parseEventData(event.data)

            // 根据事件类型处理 Staked 或 UnStaked
            if (event.event_type === 'Staked') {
                await this.handleStaked(wallet, amount)
            } else if (event.event_type === 'UnStaked') {
                await this.handleUnStaked(wallet, amount)
            }

            // 更新 event_data 的 version 字段为 1，标记为已处理
            await queryBuilder.update(
                'event_data',
                { version: 1 },
                { id: event.id }
            )
            logger.info(
                `✅ 处理完成: ${event.event_type} - ${wallet} - ${amount}`
            )
        } catch (error) {
            logger.error(`❌ 处理事件失败: ${event.id} - `, error)
        }
    }

    // 处理 Staked 事件
    private async handleStaked(wallet: string, amount: bigint): Promise<void> {
        const user = await this.getUser(wallet)

        if (user) {
            // 将当前的 `total_staked` 和 `current_staked` 转换为 BigInt 类型进行运算
            const totalStaked = BigInt(user.total_staked)
            const currentStaked = BigInt(user.current_staked)

            // 更新已有用户的 total_staked 和 current_staked
            await queryBuilder.update(
                'user',
                {
                    total_staked: (totalStaked + amount).toString(),
                    current_staked: (currentStaked + amount).toString(),
                },
                { address: wallet }
            )
        } else {
            // 用户不存在时插入新的记录
            await queryBuilder.insert('user', {
                address: wallet,
                total_staked: amount.toString(),
                total_unstaked: '0',
                current_staked: amount.toString(),
            })
        }
    }

    // 处理 UnStaked 事件
    private async handleUnStaked(
        wallet: string,
        amount: bigint
    ): Promise<void> {
        const user = await this.getUser(wallet)

        if (user) {
            // 将当前的 `total_unstaked` 和 `current_staked` 转换为 BigInt 类型进行运算
            const totalUnstaked = BigInt(user.total_unstaked)
            const currentStaked = BigInt(user.current_staked)

            // 更新已有用户的 total_unstaked 和 current_staked
            await queryBuilder.update(
                'user',
                {
                    total_unstaked: (totalUnstaked + amount).toString(),
                    current_staked: (currentStaked - amount).toString(),
                },
                { address: wallet }
            )
            logger.error(
                'wellet:',
                wallet,
                '当前 UnStaked 金额:',
                currentStaked.toString(),
                amount.toString(),
                '减去后:',
                (currentStaked - amount).toString()
            )
        } else {
            // 用户不存在时插入新的记录
            await queryBuilder.insert('user', {
                address: wallet,
                total_staked: '0',
                total_unstaked: amount.toString(),
                current_staked: '0',
            })
        }
    }

    // 获取用户信息
    private async getUser(wallet: string): Promise<{
        total_staked: string
        current_staked: string
        total_unstaked: string
    } | null> {
        const users = await queryBuilder.select<User[]>({
            table: 'user',
            where: { address: wallet },
            fields: ['id', 'total_staked', 'current_staked', 'total_unstaked'],
            limit: { count: 1 },
        })

        return users.length > 0 ? users[0] : null
    }

    // 同步解析事件数据
    public async syncParse(): Promise<void> {
        if (this.isSyncing) {
            logger.info('上一个同步仍在进行中，跳过本次循环')
            return
        }

        this.isSyncing = true
        try {
            // 查询未处理的事件数据
            const events = await queryBuilder.select({
                table: 'event_data',
                where: { version: 0 },
                limit: { count: 10 },
            })

            for (const event of events) {
                await this.processEvent(event)
            }
        } catch (error) {
            logger.error('❌ 解析 event_data 失败:', error)
        } finally {
            this.isSyncing = false
            setTimeout(
                () => this.syncParse().catch(logger.error),
                this.interval
            ) // 调度下次同步
        }
    }

    // 启动解析服务
    public start(): void {
        this.syncParse().catch(logger.error)
    }
}

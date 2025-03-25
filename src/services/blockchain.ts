import { ethers } from 'ethers'
import { queryBuilder } from '../utils/mysqlQueryBuilder'
import { ScanTask } from '../models/scanTask'
import logger from '../utils/logger'
import { EventData } from '../models/eventData'

interface ChainConfig {
    rpcPoolMap: Map<number, { rpcPool: string[] }>
    blockRange: number
    blockDelayed: number
    syncInterval: number
}

export class BlockchainService {
    private readonly chainConfig: ChainConfig

    constructor(chainConfig: ChainConfig) {
        this.chainConfig = chainConfig
    }
    private isSyncing: boolean = false // 防止重叠的标志

    // 获取最新区块号
    private async getLatestBlock(rpc: string): Promise<number> {
        const provider = new ethers.JsonRpcProvider(rpc)
        return provider.getBlockNumber()
    }

    // 获取交易发送者
    private async getSender(
        provider: ethers.JsonRpcProvider,
        txHash: string
    ): Promise<string> {
        const tx = await provider.getTransaction(txHash)
        return tx?.from || '0x0'
    }

    // 获取区块时间戳
    private async getTimestamp(
        provider: ethers.JsonRpcProvider,
        blockNumber: number
    ): Promise<number> {
        const block = await provider.getBlock(blockNumber)
        return block?.timestamp || 0
    }

    // 同步事件
    async syncEvents(): Promise<void> {
        if (this.isSyncing) {
            logger.info('上一个同步仍在进行中，跳过本次循环')
            return
        }

        this.isSyncing = true
        // 从数据库获取扫描任务
        try {
            const scanTasks = await queryBuilder
                .select<ScanTask[]>({
                    table: 'scan_tasks',
                })
                .catch((err) => {
                    logger.error('获取扫描任务失败:', err)
                    return []
                })

            if (!scanTasks.length) {
                logger.info('无扫描任务')
                return
            }

            // 按链 ID 组织数据
            const chainIds: number[] = []
            const chainIdTofrom_block = new Map<number, number>()
            const chainIdToContracts = new Map<number, string[]>()
            const chainIdToScanTasks = new Map<number, ScanTask[]>()

            for (const task of scanTasks) {
                const contracts = chainIdToContracts.get(task.chain_id) || []
                if (!contracts.includes(task.address)) {
                    contracts.push(task.address)
                    chainIdToContracts.set(task.chain_id, contracts)
                    if (!chainIds.includes(task.chain_id)) {
                        chainIds.push(task.chain_id)
                    }
                }

                const currentFrom = chainIdTofrom_block.get(task.chain_id)
                if (!currentFrom || task.from_block < currentFrom) {
                    chainIdTofrom_block.set(task.chain_id, task.from_block)
                }

                const tasks = chainIdToScanTasks.get(task.chain_id) || []
                tasks.push(task)
                chainIdToScanTasks.set(task.chain_id, tasks)
            }

            // 存储结果

            const chainToEventData = new Map<number, EventData[]>()
            const chainToToBlock = new Map<number, number>()

            logger.info(`扫描任务: ${chainIds}`)
            // 并发扫描每个链
            await Promise.all(
                chainIds.map(async (chain_id) => {
                    const config = this.chainConfig.rpcPoolMap.get(chain_id)
                    if (!config || !config.rpcPool.length) {
                        logger.warn(`链 ${chain_id} 未配置 RPC `)
                        return
                    }

                    const rpc =
                        config.rpcPool[
                            Math.floor(Math.random() * config.rpcPool.length)
                        ]
                    const provider = new ethers.JsonRpcProvider(rpc)
                    const blockRange = this.chainConfig.blockRange
                    const blockDelayed = this.chainConfig.blockDelayed

                    const from_block = chainIdTofrom_block.get(chain_id) || 0
                    let toBlock =
                        (await this.getLatestBlock(rpc)) - blockDelayed

                    if (toBlock <= 0 || toBlock < from_block) {
                        logger.warn(
                            `无效区块范围: chain_id=${chain_id}, toBlock=${toBlock}, from_block=${from_block}`
                        )
                        return
                    }
                    if (from_block + blockRange < toBlock) {
                        toBlock = from_block + blockRange
                    }
                    logger.info(
                        `扫描链 ${chain_id} 区块范围: ${from_block}-${toBlock}`
                    )
                    const eventKeccaks = (
                        chainIdToScanTasks.get(chain_id) || []
                    ).map((task) =>
                        ethers.keccak256(ethers.toUtf8Bytes(task.event_keccak))
                    )

                    const contracts = chainIdToContracts.get(chain_id) || []
                    const filter = {
                        address: contracts,
                        fromBlock: from_block,
                        toBlock: toBlock,
                        topics: [[...new Set(eventKeccaks)]],
                    }

                    try {
                        const logs = await provider.getLogs(filter)
                        const eventData: EventData[] = []

                        for (const log of logs) {
                            if (log.topics.length === 0 || log.removed) continue

                            const tasks = chainIdToScanTasks.get(chain_id) || []
                            for (const task of tasks) {
                                const eventKeccak = ethers.keccak256(
                                    ethers.toUtf8Bytes(task.event_keccak)
                                )
                                if (
                                    log.topics[0] !== eventKeccak ||
                                    log.address.toLowerCase() !==
                                        task.address.toLowerCase()
                                ) {
                                    continue
                                }
                                logger.info(
                                    `开始查询 event_data 的数量 chain_id=${chain_id}, event_type=${task.event_type}, block_number=${log.transactionHash}`
                                )
                                // 检查事件是否已存在
                                const count = await queryBuilder.count(
                                    'event_data',
                                    {
                                        chain_id,
                                        event_type: task.event_type,
                                        tx_hash: log.transactionHash,
                                    }
                                )
                                if (count > 0) {
                                    logger.warn(
                                        `事件已存在: chainId=${chain_id}, event_type=${task.event_type}, block_number=${log.blockNumber}, txHash=${log.transactionHash}`
                                    )
                                    continue
                                }

                                const topics = log.topics.map((t) =>
                                    t.toLowerCase()
                                )
                                const data = ethers.hexlify(log.data)
                                const sender = await this.getSender(
                                    provider,
                                    log.transactionHash
                                )
                                const timestamp = await this.getTimestamp(
                                    provider,
                                    log.blockNumber
                                )
                                logger.info(
                                    `push event_data: chain_id=${chain_id}, sender=${sender}, event_type=${task.event_type}, block_number=${log.blockNumber}, timestamp=${timestamp}, tx_hash=${log.transactionHash}, log_index=${log.index}`
                                )
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
                                } as EventData)

                                break // 匹配后跳出任务循环
                            }
                        }

                        chainToEventData.set(chain_id, eventData)

                        chainToToBlock.set(chain_id, toBlock + 1)
                    } catch (err) {
                        logger.error(`扫描链 ${chain_id} 失败:`, err)
                    }
                })
            )

            // 批量写入数据库
            for (const chainId of chainIds) {
                const toBlock = chainToToBlock.get(chainId)
                if (toBlock) {
                    await queryBuilder.update(
                        'scan_tasks',
                        { from_block: toBlock },
                        { chain_id: chainId }
                    )
                }

                const eventData = chainToEventData.get(chainId) || []
                if (eventData.length > 0) {
                    await queryBuilder.insertBatch('event_data', eventData) // 批量插入
                }
            }
        } finally {
            this.isSyncing = false
            const interval = this.chainConfig.syncInterval || 60_000
            setTimeout(() => this.syncEvents().catch(logger.error), interval) // 下次调度
        }
    }

    // 启动服务
    start(): void {
        this.syncEvents().catch(logger.error)
    }
}

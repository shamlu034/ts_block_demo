import { RowDataPacket } from 'mysql2/promise'
export interface EventData extends RowDataPacket {
    id?: number
    chain_id: number
    sender: string
    event_type: string
    address: string
    topic0: string
    topic1: string
    topic2: string
    topic3: string
    data: string
    log_index: number
    tx_hash: string
    block_number: number
    timestamp: number
    tx_index: number
    // 可选：如果需要，添加以下字段
    create_time?: string // TIMESTAMP 可以映射为 string
    update_time?: string
    version?: number
}

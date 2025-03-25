import { RowDataPacket } from 'mysql2/promise'

export interface ScanTask extends RowDataPacket {
    id?: number
    chain_id: number // 与数据库一致
    address: string // 改为 address，与数据库一致
    from_block: number
    event_type: string
    event_keccak: string
    proxy_event_type?: string // 可选，与数据库默认值 '' 兼容
    proxy_event_keccak?: string
    proxy_location?: string
    // 可选：添加数据库中的额外字段
    create_time?: string // TIMESTAMP 映射为 string
    update_time?: string
}

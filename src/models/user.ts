import { RowDataPacket } from 'mysql2/promise'
export interface User extends RowDataPacket {
    id: number
    address: string
    total_staked: string
    total_unstaked: string
    current_staked: string
}

import { createPool, Pool } from 'mysql2/promise'
import * as dotenv from 'dotenv'

dotenv.config()

export const pool: Pool = createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'blockchain_db',
    connectionLimit: 10,
})

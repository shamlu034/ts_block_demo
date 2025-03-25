import { Pool, ResultSetHeader, RowDataPacket } from 'mysql2/promise'
import { pool } from '../config/db'

// 定义 WHERE 条件的操作符
type Operator =
    | '='
    | '>'
    | '<'
    | '>='
    | '<='
    | '!='
    | 'LIKE'
    | 'IS NULL'
    | 'IS NOT NULL'

// 扩展 WhereCondition 支持操作符
interface WhereCondition {
    [key: string]:
        | string
        | number
        | null
        | { [op in Operator]?: string | number }
}

// JOIN 类型
type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'

// JOIN 配置
interface JoinClause {
    type: JoinType
    table: string
    on: { left: string; right: string } // 例如 { left: 'stakes.id', right: 'users.stakeId' }
}

// 查询选项
interface QueryOptions {
    table: string
    fields?: string[] | string // 自定义查询字段，默认为 *
    where?: WhereCondition
    orderBy?: { field: string; direction: 'ASC' | 'DESC' }
    groupBy?: string | string[]
    limit?: { count: number; offset?: number }
    joins?: JoinClause[]
}

export class MySQLQueryBuilder {
    private pool: Pool

    constructor(pool: Pool) {
        this.pool = pool
    }

    // 构建 WHERE 子句，支持多种操作符
    private buildWhereClause(where?: WhereCondition): {
        sql: string
        values: any[]
    } {
        if (!where || Object.keys(where).length === 0) {
            return { sql: '', values: [] }
        }

        const conditions: string[] = []
        const values: any[] = []

        for (const [key, value] of Object.entries(where)) {
            if (value === null) {
                conditions.push(`${key} IS NULL`)
            } else if (typeof value === 'object' && value !== null) {
                // 处理操作符
                for (const [op, val] of Object.entries(value)) {
                    if (op === 'IS NULL' || op === 'IS NOT NULL') {
                        conditions.push(`${key} ${op}`)
                    } else {
                        conditions.push(`${key} ${op} ?`)
                        values.push(val)
                    }
                }
            } else {
                // 默认使用 =
                conditions.push(`${key} = ?`)
                values.push(value)
            }
        }

        return {
            sql: ' WHERE ' + conditions.join(' AND '),
            values,
        }
    }

    // 构建 JOIN 子句
    private buildJoinClause(joins?: JoinClause[]): string {
        if (!joins || joins.length === 0) {
            return ''
        }

        return joins
            .map(
                (join) =>
                    `${join.type} JOIN ${join.table} ON ${join.on.left} = ${join.on.right}`
            )
            .join(' ')
    }

    // 构建 ORDER BY 子句
    private buildOrderByClause(orderBy?: {
        field: string
        direction: 'ASC' | 'DESC'
    }): string {
        if (!orderBy) {
            return ''
        }
        return ` ORDER BY ${orderBy.field} ${orderBy.direction}`
    }

    // 构建 GROUP BY 子句
    private buildGroupByClause(groupBy?: string | string[]): string {
        if (!groupBy) {
            return ''
        }
        const fields = Array.isArray(groupBy) ? groupBy.join(', ') : groupBy
        return ` GROUP BY ${fields}`
    }

    // 构建 LIMIT 子句
    private buildLimitClause(limit?: {
        count: number
        offset?: number
    }): string {
        if (!limit) {
            return ''
        }
        return limit.offset !== undefined
            ? ` LIMIT ${limit.offset}, ${limit.count}`
            : ` LIMIT ${limit.count}`
    }

    // 查询记录，泛型 T 不再强制继承 RowDataPacket[]
    async select<T = RowDataPacket[]>(options: QueryOptions): Promise<T> {
        const {
            table,
            fields = '*',
            where,
            orderBy,
            groupBy,
            limit,
            joins,
        } = options

        const whereClause = this.buildWhereClause(where)
        const joinClause = this.buildJoinClause(joins)
        const orderByClause = this.buildOrderByClause(orderBy)
        const groupByClause = this.buildGroupByClause(groupBy)
        const limitClause = this.buildLimitClause(limit)

        const fieldList = Array.isArray(fields) ? fields.join(', ') : fields
        const sql = `SELECT ${fieldList} FROM ${table}${joinClause}${whereClause.sql}${groupByClause}${orderByClause}${limitClause}`
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            sql,
            whereClause.values
        )
        return rows as T // 类型断言
    }

    // 插入记录
    async insert(table: string, data: { [key: string]: any }): Promise<number> {
        const keys = Object.keys(data)
        const placeholders = keys.map(() => '?').join(', ')
        const values = Object.values(data)

        const sql = `INSERT INTO ${table} (${keys.join(
            ', '
        )}) VALUES (${placeholders})`
        const [result] = await this.pool.execute<ResultSetHeader>(sql, values)
        return result.insertId
    }

    // 更新记录
    async update(
        table: string,
        data: { [key: string]: any },
        where?: WhereCondition
    ): Promise<number> {
        const setClause = Object.keys(data)
            .map((key) => `${key} = ?`)
            .join(', ')
        const values = Object.values(data)

        const whereClause = this.buildWhereClause(where)
        const sql = `UPDATE ${table} SET ${setClause}${whereClause.sql}`
        const [result] = await this.pool.execute<ResultSetHeader>(sql, [
            ...values,
            ...whereClause.values,
        ])
        return result.affectedRows
    }

    // 删除记录
    async delete(table: string, where?: WhereCondition): Promise<number> {
        const whereClause = this.buildWhereClause(where)
        const sql = `DELETE FROM ${table}${whereClause.sql}`
        const [result] = await this.pool.execute<ResultSetHeader>(
            sql,
            whereClause.values
        )
        return result.affectedRows
    }

    // 查询总数
    async count(table: string, where?: WhereCondition): Promise<number> {
        const whereClause = this.buildWhereClause(where)
        const sql = `SELECT COUNT(*) as total FROM ${table}${whereClause.sql}`
        const [rows] = await this.pool.execute<RowDataPacket[]>(
            sql,
            whereClause.values
        )
        return rows[0].total as number
    }
    // 批量插入记录
    async insertBatch(table: string, data: any[]): Promise<number> {
        if (!data || data.length === 0) return 0

        const batchSize = 1000 // 每批 1000 条
        let totalAffectedRows = 0

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize)
            const keys = Object.keys(batch[0])
            const placeholders = keys.map(() => '?').join(', ')
            const valuesClause = batch.map(() => `(${placeholders})`).join(', ')
            const values = batch.flatMap((item) => keys.map((key) => item[key]))

            const sql = `INSERT INTO ${table} (${keys.join(
                ', '
            )}) VALUES ${valuesClause}`
            const [result] = await this.pool.execute<ResultSetHeader>(
                sql,
                values
            )
            totalAffectedRows += result.affectedRows
        }

        return totalAffectedRows
    }
}

export const queryBuilder = new MySQLQueryBuilder(pool)

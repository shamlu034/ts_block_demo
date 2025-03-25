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
Object.defineProperty(exports, "__esModule", { value: true });
exports.queryBuilder = exports.MySQLQueryBuilder = void 0;
const db_1 = require("../config/db");
class MySQLQueryBuilder {
    constructor(pool) {
        this.pool = pool;
    }
    // 构建 WHERE 子句，支持多种操作符
    buildWhereClause(where) {
        if (!where || Object.keys(where).length === 0) {
            return { sql: '', values: [] };
        }
        const conditions = [];
        const values = [];
        for (const [key, value] of Object.entries(where)) {
            if (value === null) {
                conditions.push(`${key} IS NULL`);
            }
            else if (typeof value === 'object' && value !== null) {
                // 处理操作符
                for (const [op, val] of Object.entries(value)) {
                    if (op === 'IS NULL' || op === 'IS NOT NULL') {
                        conditions.push(`${key} ${op}`);
                    }
                    else {
                        conditions.push(`${key} ${op} ?`);
                        values.push(val);
                    }
                }
            }
            else {
                // 默认使用 =
                conditions.push(`${key} = ?`);
                values.push(value);
            }
        }
        return {
            sql: ' WHERE ' + conditions.join(' AND '),
            values,
        };
    }
    // 构建 JOIN 子句
    buildJoinClause(joins) {
        if (!joins || joins.length === 0) {
            return '';
        }
        return joins
            .map((join) => `${join.type} JOIN ${join.table} ON ${join.on.left} = ${join.on.right}`)
            .join(' ');
    }
    // 构建 ORDER BY 子句
    buildOrderByClause(orderBy) {
        if (!orderBy) {
            return '';
        }
        return ` ORDER BY ${orderBy.field} ${orderBy.direction}`;
    }
    // 构建 GROUP BY 子句
    buildGroupByClause(groupBy) {
        if (!groupBy) {
            return '';
        }
        const fields = Array.isArray(groupBy) ? groupBy.join(', ') : groupBy;
        return ` GROUP BY ${fields}`;
    }
    // 构建 LIMIT 子句
    buildLimitClause(limit) {
        if (!limit) {
            return '';
        }
        return limit.offset !== undefined
            ? ` LIMIT ${limit.offset}, ${limit.count}`
            : ` LIMIT ${limit.count}`;
    }
    // 查询记录，泛型 T 不再强制继承 RowDataPacket[]
    select(options) {
        return __awaiter(this, void 0, void 0, function* () {
            const { table, fields = '*', where, orderBy, groupBy, limit, joins, } = options;
            const whereClause = this.buildWhereClause(where);
            const joinClause = this.buildJoinClause(joins);
            const orderByClause = this.buildOrderByClause(orderBy);
            const groupByClause = this.buildGroupByClause(groupBy);
            const limitClause = this.buildLimitClause(limit);
            const fieldList = Array.isArray(fields) ? fields.join(', ') : fields;
            const sql = `SELECT ${fieldList} FROM ${table}${joinClause}${whereClause.sql}${groupByClause}${orderByClause}${limitClause}`;
            const [rows] = yield this.pool.execute(sql, whereClause.values);
            return rows; // 类型断言
        });
    }
    // 插入记录
    insert(table, data) {
        return __awaiter(this, void 0, void 0, function* () {
            const keys = Object.keys(data);
            const placeholders = keys.map(() => '?').join(', ');
            const values = Object.values(data);
            const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
            const [result] = yield this.pool.execute(sql, values);
            return result.insertId;
        });
    }
    // 更新记录
    update(table, data, where) {
        return __awaiter(this, void 0, void 0, function* () {
            const setClause = Object.keys(data)
                .map((key) => `${key} = ?`)
                .join(', ');
            const values = Object.values(data);
            const whereClause = this.buildWhereClause(where);
            const sql = `UPDATE ${table} SET ${setClause}${whereClause.sql}`;
            const [result] = yield this.pool.execute(sql, [
                ...values,
                ...whereClause.values,
            ]);
            return result.affectedRows;
        });
    }
    // 删除记录
    delete(table, where) {
        return __awaiter(this, void 0, void 0, function* () {
            const whereClause = this.buildWhereClause(where);
            const sql = `DELETE FROM ${table}${whereClause.sql}`;
            const [result] = yield this.pool.execute(sql, whereClause.values);
            return result.affectedRows;
        });
    }
    // 查询总数
    count(table, where) {
        return __awaiter(this, void 0, void 0, function* () {
            const whereClause = this.buildWhereClause(where);
            const sql = `SELECT COUNT(*) as total FROM ${table}${whereClause.sql}`;
            const [rows] = yield this.pool.execute(sql, whereClause.values);
            return rows[0].total;
        });
    }
    // 批量插入记录
    insertBatch(table, data) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!data || data.length === 0)
                return 0;
            const batchSize = 1000; // 每批 1000 条
            let totalAffectedRows = 0;
            for (let i = 0; i < data.length; i += batchSize) {
                const batch = data.slice(i, i + batchSize);
                const keys = Object.keys(batch[0]);
                const placeholders = keys.map(() => '?').join(', ');
                const valuesClause = batch.map(() => `(${placeholders})`).join(', ');
                const values = batch.flatMap((item) => keys.map((key) => item[key]));
                const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES ${valuesClause}`;
                const [result] = yield this.pool.execute(sql, values);
                totalAffectedRows += result.affectedRows;
            }
            return totalAffectedRows;
        });
    }
}
exports.MySQLQueryBuilder = MySQLQueryBuilder;
exports.queryBuilder = new MySQLQueryBuilder(db_1.pool);

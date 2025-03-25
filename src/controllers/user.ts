import { Get, Put, Route, Controller, Body, Query } from 'tsoa'
import { queryBuilder } from '../utils/mysqlQueryBuilder'

interface UpdateUserRequest {
    address: string
    totalStaked: string
    totalUnstaked: string
    currentStaked: string
}

@Route('users')
export class UserController extends Controller {
    // 获取用户信息
    @Get('/')
    public async getUser(@Query() address: string): Promise<{
        address: string
        total_staked: string
        total_unstaked: string
        current_staked: string
    }> {
        // 从数据库查询用户信息
        const users = await queryBuilder.select<
            {
                address: string
                total_staked: string
                total_unstaked: string
                current_staked: string
            }[]
        >({
            table: 'user',
            where: { address: address },
            fields: [
                'address',
                'total_staked',
                'total_unstaked',
                'current_staked',
            ],
        })

        if (users.length === 0) {
            throw new Error('User not found')
        }

        return users[0] // 返回第一个匹配的用户
    }
}

import express from 'express'
import { setupSwagger } from './swagger/swagger'
import router from './routes'
import { BlockchainService } from './services/blockchain'
import { ParseService } from './services/parse'
import logger from './utils/logger'

const app = express()
const PORT = process.env.PORT || 3000
const HOST = process.env.HOST || 'http://localhost'

const chainConfig: {
    rpcPoolMap: Map<number, { rpcPool: string[] }>
    blockRange: number
    blockDelayed: number
    syncInterval: number
} = {
    rpcPoolMap: new Map<number, { rpcPool: string[] }>([
        [
            1,
            {
                rpcPool: [
                    process.env.ETH_RPC_MAINNET ||
                        'https://mainnet.infura.io/v3/YOUR_PROJECT_ID',
                ],
            },
        ],
    ]),
    blockRange: parseInt(process.env.BLOCK_RANGE || '100', 10),
    blockDelayed: parseInt(process.env.BLOCK_DELAYED || '6', 10),
    syncInterval: parseInt(process.env.SYNC_INTERVAL || '10000', 10),
}

app.use(express.json())
app.use('/api', router)
setupSwagger(app)
//区块链服务
const blockchainService = new BlockchainService(chainConfig)
blockchainService.start()
//解析服务
const parseService = new ParseService(
    parseInt(process.env.PARSE_INTERVAL || '30000', 10)
)
parseService.start()

app.listen(PORT, () => {
    logger.info(`服务器运行在 ${HOST}:${PORT}`)
    logger.info(`API 文档在 ${HOST}:${PORT}/docs`)
})

import * as swaggerUi from 'swagger-ui-express'
import { Application } from 'express'
import { RegisterRoutes } from '../routes/routes' // 确保路径正确

export const setupSwagger = (app: Application) => {
    app.use(
        '/docs',
        swaggerUi.serve,
        swaggerUi.setup(require(`${__dirname}/swagger.json`))
    )
    RegisterRoutes(app) // 注册 tsoa 生成的路由
}

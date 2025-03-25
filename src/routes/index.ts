import * as express from 'express'
import { UserController } from '../controllers/user'

const router = express.Router()
const userController = new UserController()

router.get('/user', async (req, res) => {
    const address = (req.query.address as string) || ''
    const userData = await userController.getUser(address)
    res.json(userData)
})

export default router

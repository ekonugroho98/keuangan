import { handle } from 'hono/vercel'
import { buildApp } from './app'

const app = buildApp()

export default handle(app)

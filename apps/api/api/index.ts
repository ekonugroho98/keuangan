import { handle } from 'hono/vercel'
import { buildApp } from '../src/app'

export const config = { runtime: 'nodejs22.x' }

const app = buildApp()

export default handle(app)

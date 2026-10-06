import { handle } from 'hono/vercel'
import { buildApp } from '../src/app'

export const config = { runtime: 'nodejs' }

const app = buildApp()

export default handle(app)

import { serve } from '@hono/node-server'
import { buildApp } from './app'
import { env } from './env'

const app = buildApp()

serve({ fetch: app.fetch, port: env.PORT }, (info) => {
  console.log(`[api] listening on http://localhost:${info.port}`)
  console.log(`[api] docs:   http://localhost:${info.port}/v1/docs`)
  console.log(`[api] health: http://localhost:${info.port}/v1/health`)
})

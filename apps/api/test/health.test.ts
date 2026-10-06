import { describe, expect, it } from 'vitest'
import { buildApp } from '../src/app'

describe('GET /v1/health', () => {
  it('returns ok without requiring auth or DB', async () => {
    const app = buildApp()
    const res = await app.request('/v1/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ status: 'ok', version: '0.1.0', db: 'ok' })
  })
})

describe('GET /v1/openapi.json', () => {
  it('serves a valid OpenAPI 3.1 document', async () => {
    const app = buildApp()
    const res = await app.request('/v1/openapi.json')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.openapi).toBe('3.1.0')
    expect(body.paths['/v1/health']).toBeDefined()
  })
})

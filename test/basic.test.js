import { describe, test, expect } from 'vitest'
import app from '../src/app.js'

describe('Basic Hono App Tests', () => {
    test('should respond to health check', async () => {
        const response = await app.request('/')
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.message).toBe('Hono AI Testing Server is running!')
    })

    test('should echo chat messages', async () => {
        const response = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'Hello World' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.message).toBe('Echo: Hello World')
        expect(data.timestamp).toBeDefined()
    })

    test('should generate mock profiles', async () => {
        const response = await app.request('/generate-profile', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'creative artist' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.name).toBe('Test User')
        expect(data.occupation).toBe('Developer')
        expect(data.backstory).toContain('creative artist')
    })

    test('should respond to unknown routes with 404', async () => {
        const response = await app.request('/unknown-route')
        expect(response.status).toBe(404)
    })
})
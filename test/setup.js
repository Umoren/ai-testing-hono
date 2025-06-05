// Global test setup for MSW
import { beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'

// Create MSW server (individual tests can add handlers)
const server = setupServer()

beforeAll(() => {
    // Start MSW server
    server.listen({ onUnhandledRequest: 'warn' })
    console.log('🔧 MSW server started for testing')
})

afterEach(() => {
    // Reset handlers after each test
    server.resetHandlers()
})

afterAll(() => {
    // Clean up
    server.close()
    console.log('🔧 MSW server stopped')
})

// Make server available globally for individual tests
globalThis.mockServer = server
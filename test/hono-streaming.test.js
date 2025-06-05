import { describe, test, expect } from 'vitest'
import { createStreamingOpenAIMock } from './streaming-mocks.js'
import { createDynamicOpenAIMock } from './dynamic-mocks.js'
import app from '../src/app-with-ai.js'

describe('Hono Streaming Chat API', () => {
    // Use the global MSW server from setup.js
    const server = globalThis.mockServer

    test('should stream creative chat responses', async () => {
        // Setup streaming mock
        const streamingMocks = {
            'creative story': {
                type: 'text',
                content: 'Once upon a time in a magical kingdom there lived a brave knight'
            }
        }

        server.use(createStreamingOpenAIMock(streamingMocks))

        // Make request to streaming endpoint
        const response = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'Tell me a creative story' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)
        expect(response.headers.get('Content-Type')).toContain('text/plain')

        // Read the streaming response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let chunks = []

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(decoder.decode(value))
        }

        const fullResponse = chunks.join('')

        // Verify streaming format and content (AI SDK format)
        expect(fullResponse).toContain('0:"Once')  // AI SDK chunk format
        expect(fullResponse).toContain('0:"upon')
        expect(fullResponse).toContain('magical')
    })

    test('should handle tool calling with weather requests', async () => {
        // Setup tool calling mock
        const toolMocks = {
            'weather': {
                type: 'tool_call',
                tool_name: 'getWeather',
                tool_args: { location: 'San Francisco, CA' },
                final_response: 'The weather in San Francisco is currently 72°F and sunny with 65% humidity.'
            }
        }

        server.use(createStreamingOpenAIMock(toolMocks))

        const response = await app.request('/chat-with-tools', {
            method: 'POST',
            body: JSON.stringify({ message: 'What is the weather like today?' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)

        // Read streaming response
        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let chunks = []

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(decoder.decode(value))
        }

        const fullResponse = chunks.join('')

        // Verify tool call format (AI SDK format)
        expect(fullResponse).toContain('9:{"toolCallId"')  // AI SDK tool format
        expect(fullResponse).toContain('toolName":"getWeather"')
        expect(fullResponse).toContain('San Francisco')
    })

    test('should generate structured profiles (non-streaming)', async () => {
        // Reuse structured data mocks from previous demo
        const profileMocks = {
            'creative artist': {
                name: 'Luna Martinez',
                age: 28,
                occupation: 'Digital Artist',
                personality: ['imaginative', 'passionate', 'detail-oriented'],
                backstory: 'Luna discovered her artistic passion while studying computer science.'
            }
        }

        server.use(createDynamicOpenAIMock(profileMocks))

        const response = await app.request('/generate-profile', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate a creative artist profile' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)

        const profile = await response.json()
        expect(profile.name).toBe('Luna Martinez')
        expect(profile.occupation).toBe('Digital Artist')
        expect(profile.personality).toContain('imaginative')
    })

    test('should handle streaming errors gracefully', async () => {
        // Setup empty mocks to trigger fallback
        server.use(createStreamingOpenAIMock({}))

        const response = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'This will trigger fallback response' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let chunks = []

        while (true) {
            const { done, value } = await reader.read()
            if (done) break
            chunks.push(decoder.decode(value))
        }

        const fullResponse = chunks.join('')
        expect(fullResponse).toContain('Sorry, I cannot help with that')
    })

    test('should handle multiple streaming scenarios', async () => {
        const multiMocks = {
            'poem': {
                type: 'text',
                content: 'Roses are red violets are blue testing is fun and so are you'
            },
            'recipe': {
                type: 'text',
                content: 'First gather ingredients then mix them carefully and bake for 30 minutes'
            }
        }

        server.use(createStreamingOpenAIMock(multiMocks))

        // Test poem request
        const poemResponse = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'Write me a poem' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(poemResponse.status).toBe(200)

        // Test recipe request
        const recipeResponse = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'Give me a recipe' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(recipeResponse.status).toBe(200)

        // Both should work with different content
        const poemText = await streamToText(poemResponse)
        const recipeText = await streamToText(recipeResponse)

        expect(poemText).toContain('0:"Roses')  // AI SDK format
        expect(poemText).toContain('violets')   // Content check
        expect(recipeText).toContain('0:"')     // AI SDK format (any content)
    })
})

// Helper function to convert stream to text
async function streamToText(response) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let chunks = []

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(decoder.decode(value))
    }

    return chunks.join('')
}
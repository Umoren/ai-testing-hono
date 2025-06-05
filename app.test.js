import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse, delay } from 'msw'
import app from './app.js'

// MSW Server Setup (from test/setup.js)
const server = setupServer()

beforeAll(() => {
    server.listen({ onUnhandledRequest: 'warn' })
    console.log('🔧 MSW server started for testing')
})

afterEach(() => {
    server.resetHandlers()
})

afterAll(() => {
    server.close()
    console.log('🔧 MSW server stopped')
})

// Make server available globally
globalThis.mockServer = server

// Mock Functions (from test/streaming-mocks.js)
function createStreamChunk(content, isLast = false, toolCall = null) {
    const chunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: Math.floor(Date.now() / 1000),
        model: 'gpt-4o',
        choices: [{
            index: 0,
            delta: {},
            finish_reason: isLast ? 'stop' : null
        }]
    }

    if (content) {
        chunk.choices[0].delta.content = content
    }

    if (toolCall) {
        chunk.choices[0].delta.tool_calls = [toolCall]
    }

    return `data: ${JSON.stringify(chunk)}\n\n`
}

export function createStreamingOpenAIMock(streamResponses) {
    return http.post('*/chat/completions', async ({ request }) => {
        const body = await request.json()
        // Handle both message formats: prompt (AI SDK streamText) and messages array
        const userMessage = body.prompt || body.messages?.find(msg => msg.role === 'user')?.content || ''

        // Check if request wants streaming
        if (!body.stream) {
            // Return regular generateObject response (reuse previous logic)
            return HttpResponse.json({
                id: 'chatcmpl-test',
                object: 'chat.completion',
                created: Math.floor(Date.now() / 1000),
                model: 'gpt-4o',
                choices: [{
                    index: 0,
                    message: {
                        role: 'assistant',
                        content: null,
                        tool_calls: [{
                            id: 'call_test',
                            type: 'function',
                            function: {
                                name: 'json',
                                arguments: JSON.stringify({ error: "No mock configured" })
                            }
                        }]
                    },
                    finish_reason: 'tool_calls'
                }]
            })
        }

        // Handle streaming responses
        for (const [pattern, response] of Object.entries(streamResponses)) {
            if (userMessage.toLowerCase().includes(pattern.toLowerCase())) {

                if (response.type === 'text') {
                    // Text streaming
                    const stream = new ReadableStream({
                        async start(controller) {
                            const encoder = new TextEncoder()
                            const words = response.content.split(' ')

                            // Stream word by word
                            for (const word of words) {
                                const chunk = createStreamChunk(word + ' ')
                                controller.enqueue(encoder.encode(chunk))
                                await delay(100) // Add realistic delay
                            }

                            // Final chunk
                            const finalChunk = createStreamChunk('', true)
                            controller.enqueue(encoder.encode(finalChunk))
                            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                            controller.close()
                        }
                    })

                    return new HttpResponse(stream, {
                        headers: {
                            'Content-Type': 'text/plain; charset=utf-8',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        }
                    })
                }

                if (response.type === 'tool_call') {
                    // Tool calling streaming
                    const stream = new ReadableStream({
                        async start(controller) {
                            const encoder = new TextEncoder()

                            // First chunk: tool call
                            const toolCallChunk = createStreamChunk(null, false, {
                                index: 0,
                                id: 'call_test_tool',
                                type: 'function',
                                function: {
                                    name: response.tool_name,
                                    arguments: JSON.stringify(response.tool_args)
                                }
                            })
                            controller.enqueue(encoder.encode(toolCallChunk))
                            await delay(200)

                            // Second chunk: tool result and AI response
                            const words = response.final_response.split(' ')
                            for (const word of words) {
                                const chunk = createStreamChunk(word + ' ')
                                controller.enqueue(encoder.encode(chunk))
                                await delay(100)
                            }

                            // Final chunk
                            const finalChunk = createStreamChunk('', true)
                            controller.enqueue(encoder.encode(finalChunk))
                            controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                            controller.close()
                        }
                    })

                    return new HttpResponse(stream, {
                        headers: {
                            'Content-Type': 'text/plain; charset=utf-8',
                            'Cache-Control': 'no-cache',
                            'Connection': 'keep-alive',
                        }
                    })
                }
            }
        }

        // Fallback: simple error stream
        const stream = new ReadableStream({
            start(controller) {
                const encoder = new TextEncoder()
                const chunk = createStreamChunk('Sorry, I cannot help with that.', true)
                controller.enqueue(encoder.encode(chunk))
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                controller.close()
            }
        })

        return new HttpResponse(stream, {
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            }
        })
    })
}

// Dynamic Mocks (from test/dynamic-mocks.js)
export function createDynamicOpenAIMock(mockResponses) {
    return http.post('*/chat/completions', async ({ request }) => {
        const body = await request.json()
        // Handle both message formats: prompt (AI SDK) and messages array
        const userMessage = body.prompt || body.messages?.find(msg => msg.role === 'user')?.content || ''

        // Find matching mock based on prompt content
        for (const [promptPattern, response] of Object.entries(mockResponses)) {
            if (userMessage.toLowerCase().includes(promptPattern.toLowerCase())) {

                // Return tool call response format for AI SDK generateObject
                return HttpResponse.json({
                    id: 'chatcmpl-test-' + Date.now(),
                    object: 'chat.completion',
                    created: Math.floor(Date.now() / 1000),
                    model: 'gpt-4o',
                    choices: [{
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: null,
                            tool_calls: [{
                                id: 'call_test_' + Date.now(),
                                type: 'function',
                                function: {
                                    name: 'json',
                                    arguments: JSON.stringify(response)
                                }
                            }]
                        },
                        finish_reason: 'tool_calls'
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20, total_tokens: 30 }
                })
            }
        }

        // Fallback for unmatched patterns
        return HttpResponse.json({
            id: 'chatcmpl-test-fallback',
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: 'gpt-4o',
            choices: [{
                index: 0,
                message: {
                    role: 'assistant',
                    content: null,
                    tool_calls: [{
                        id: 'call_fallback_' + Date.now(),
                        type: 'function',
                        function: {
                            name: 'json',
                            arguments: JSON.stringify({ error: "No mock configured for this prompt" })
                        }
                    }]
                },
                finish_reason: 'tool_calls'
            }],
            usage: { prompt_tokens: 5, completion_tokens: 10, total_tokens: 15 }
        })
    })
}

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

// Tests (from test/basic.test.js and test/hono-streaming.test.js)
describe('Basic Hono App Tests', () => {
    test('should respond to health check', async () => {
        const response = await app.request('/')
        expect(response.status).toBe(200)

        const data = await response.json()
        expect(data.message).toBe('Hono AI Testing Server with AI is running!')
    })
})

describe('Hono Streaming Chat API', () => {
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
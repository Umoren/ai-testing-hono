import { describe, test, expect, beforeAll, afterEach, afterAll } from 'vitest'
import { setupServer } from 'msw/node'
import { http, HttpResponse } from 'msw'
import app from './app.js'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

// Create proper OpenAI responses (not AI SDK format!)
function createOpenAIResponse(mockData, requestPrompt, isStreaming = false) {
    for (const [pattern, response] of Object.entries(mockData)) {
        if (requestPrompt.toLowerCase().includes(pattern.toLowerCase())) {

            if (isStreaming && response.type === 'text') {
                // OpenAI streaming format
                const chunks = response.content.split(' ').map(word =>
                    `data: {"choices":[{"delta":{"content":"${word} "},"finish_reason":null}]}\n\n`
                ).join('') + 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'

                return new HttpResponse(chunks, {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                })
            }

            if (isStreaming && response.type === 'tool_call') {
                // Tool call in OpenAI streaming format
                const toolChunk = `data: {"choices":[{"delta":{"tool_calls":[{"id":"call_1","function":{"name":"${response.tool_name}","arguments":"${JSON.stringify(response.tool_args)}"}}]},"finish_reason":null}]}\n\n`
                const textChunks = response.final_response.split(' ').map(word =>
                    `data: {"choices":[{"delta":{"content":"${word} "},"finish_reason":null}]}\n\n`
                ).join('')
                const endChunk = 'data: {"choices":[{"delta":{},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n'

                return new HttpResponse(toolChunk + textChunks + endChunk, {
                    headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                })
            }

            if (!isStreaming && response.name) {
                // generateObject expects choices array with content as JSON string
                return HttpResponse.json({
                    choices: [{
                        message: {
                            role: 'assistant',
                            content: JSON.stringify(response)
                        },
                        finish_reason: 'stop'
                    }],
                    usage: { prompt_tokens: 10, completion_tokens: 20 }
                })
            }
        }
    }

    // Fallback
    if (isStreaming) {
        return new HttpResponse(
            'data: {"choices":[{"delta":{"content":"Sorry, I cannot help with that."},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',
            { headers: { 'Content-Type': 'text/plain; charset=utf-8' } }
        )
    }
    return HttpResponse.json({ error: "No mock configured" }, { status: 500 })
}

function createMSWMock(mockData) {
    return http.post('*/chat/completions', async ({ request }) => {
        const body = await request.json()
        const userMessage = body.prompt ||
            (body.messages && body.messages.find(msg => msg.role === 'user')?.content) || ''

        return createOpenAIResponse(mockData, userMessage, body.stream)
    })
}

async function streamToText(response) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let result = ''

    while (true) {
        const { done, value } = await reader.read()
        if (done) break
        result += decoder.decode(value)
    }
    return result
}

const mockData = {
    'creative story': {
        type: 'text',
        content: 'Once upon a time in a magical kingdom there lived a brave knight'
    },
    'hello': {
        type: 'text',
        content: 'Hello there! How can I help you today?'
    },
    'weather': {
        type: 'tool_call',
        tool_name: 'getWeather',
        tool_args: { location: 'San Francisco, CA' },
        final_response: 'The weather in San Francisco is currently 72°F and sunny with 65% humidity.'
    },
    'creative artist': {
        name: 'Luna Martinez',
        age: 28,
        occupation: 'Digital Artist',
        personality: ['imaginative', 'passionate', 'detail-oriented'],
        backstory: 'Luna discovered her artistic passion while studying computer science.'
    }
}

describe('Health Check', () => {
    test('should return health status', async () => {
        const response = await app.request('/')
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.message).toBe('Hono AI Testing Server with AI is running!')
    })
})

describe('AI Tests', () => {
    test('should stream creative chat responses', async () => {
        server.use(createMSWMock(mockData))

        const response = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'Tell me a creative story' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)
        const fullResponse = await streamToText(response)
        expect(fullResponse).toContain('Once')
        expect(fullResponse).toContain('magical')
        expect(fullResponse).toContain('knight')
    })

    test('should handle simple greetings', async () => {
        server.use(createMSWMock(mockData))

        const response = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({ message: 'Hello there' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)
        const fullResponse = await streamToText(response)
        expect(fullResponse).toContain('Hello')
        expect(fullResponse).toContain('help')
    })

    test('should handle tool calling', async () => {
        server.use(createMSWMock(mockData))

        const response = await app.request('/chat-with-tools', {
            method: 'POST',
            body: JSON.stringify({ message: 'What is the weather like today?' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)
        const fullResponse = await streamToText(response)
        expect(fullResponse).toContain('weather')
        expect(fullResponse).toContain('72°F')
    })

    test('should generate structured profiles', async () => {
        server.use(createMSWMock(mockData))

        const response = await app.request('/generate-profile', {
            method: 'POST',
            body: JSON.stringify({ prompt: 'Generate a creative artist profile' }),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(200)
        const profile = await response.json()
        expect(profile.name).toBe('Luna Martinez')
        expect(profile.age).toBe(28)
        expect(profile.occupation).toBe('Digital Artist')
    })

    test('should handle malformed JSON', async () => {
        const response = await app.request('/chat', {
            method: 'POST',
            body: 'invalid json',
            headers: { 'Content-Type': 'application/json' }
        })

        expect([400, 500]).toContain(response.status)
    })
})
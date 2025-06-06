import { describe, test, expect } from 'vitest'
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test'
import { createApp } from './app.js'

// Helper to read stream responses
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

describe('Health Check', () => {
    test('should return health status', async () => {
        const app = createApp()
        const response = await app.request('/')
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.message).toBe('Hono AI Testing Server with AI is running!')
    })
})

describe('AI Tests', () => {
    test('should stream creative chat responses', async () => {
        const mockModel = new MockLanguageModelV1({
            doStream: async () => ({
                stream: simulateReadableStream({
                    chunks: [
                        { type: 'text-delta', textDelta: 'Once ' },
                        { type: 'text-delta', textDelta: 'upon ' },
                        { type: 'text-delta', textDelta: 'a ' },
                        { type: 'text-delta', textDelta: 'time ' },
                        { type: 'text-delta', textDelta: 'in ' },
                        { type: 'text-delta', textDelta: 'a ' },
                        { type: 'text-delta', textDelta: 'magical ' },
                        { type: 'text-delta', textDelta: 'kingdom ' },
                        { type: 'text-delta', textDelta: 'there ' },
                        { type: 'text-delta', textDelta: 'lived ' },
                        { type: 'text-delta', textDelta: 'a ' },
                        { type: 'text-delta', textDelta: 'brave ' },
                        { type: 'text-delta', textDelta: 'knight' },
                        {
                            type: 'finish',
                            finishReason: 'stop',
                            logprobs: undefined,
                            usage: { completionTokens: 13, promptTokens: 5 },
                        },
                    ],
                }),
                rawCall: { rawPrompt: null, rawSettings: {} },
            }),
        })

        const app = createApp({ chatModel: mockModel })

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
        const mockModel = new MockLanguageModelV1({
            doStream: async () => ({
                stream: simulateReadableStream({
                    chunks: [
                        { type: 'text-delta', textDelta: 'Hello ' },
                        { type: 'text-delta', textDelta: 'there! ' },
                        { type: 'text-delta', textDelta: 'How ' },
                        { type: 'text-delta', textDelta: 'can ' },
                        { type: 'text-delta', textDelta: 'I ' },
                        { type: 'text-delta', textDelta: 'help ' },
                        { type: 'text-delta', textDelta: 'you ' },
                        { type: 'text-delta', textDelta: 'today?' },
                        {
                            type: 'finish',
                            finishReason: 'stop',
                            logprobs: undefined,
                            usage: { completionTokens: 8, promptTokens: 2 },
                        },
                    ],
                }),
                rawCall: { rawPrompt: null, rawSettings: {} },
            }),
        })

        const app = createApp({ chatModel: mockModel })

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
        const mockModel = new MockLanguageModelV1({
            doStream: async () => ({
                stream: simulateReadableStream({
                    chunks: [
                        {
                            type: 'tool-call',
                            toolCallType: 'function',
                            toolCallId: 'call_1',
                            toolName: 'getWeather',
                            args: { location: 'San Francisco, CA' },
                        },
                        { type: 'text-delta', textDelta: 'The ' },
                        { type: 'text-delta', textDelta: 'weather ' },
                        { type: 'text-delta', textDelta: 'in ' },
                        { type: 'text-delta', textDelta: 'San ' },
                        { type: 'text-delta', textDelta: 'Francisco ' },
                        { type: 'text-delta', textDelta: 'is ' },
                        { type: 'text-delta', textDelta: 'currently ' },
                        { type: 'text-delta', textDelta: '72°F ' },
                        { type: 'text-delta', textDelta: 'and ' },
                        { type: 'text-delta', textDelta: 'sunny.' },
                        {
                            type: 'finish',
                            finishReason: 'stop',
                            logprobs: undefined,
                            usage: { completionTokens: 12, promptTokens: 5 },
                        },
                    ],
                }),
                rawCall: { rawPrompt: null, rawSettings: {} },
            }),
        })

        const app = createApp({ chatModel: mockModel })

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
        const mockModel = new MockLanguageModelV1({
            defaultObjectGenerationMode: 'json',
            doGenerate: async () => ({
                text: JSON.stringify({
                    name: 'Luna Martinez',
                    age: 28,
                    occupation: 'Digital Artist',
                    personality: ['imaginative', 'passionate', 'detail-oriented'],
                    backstory: 'Luna discovered her artistic passion while studying computer science.'
                }),
                usage: { completionTokens: 50, promptTokens: 10 },
                finishReason: 'stop',
                rawCall: { rawPrompt: null, rawSettings: {} },
            }),
        })

        const app = createApp({ objectModel: mockModel })

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
        const app = createApp()

        const response = await app.request('/chat', {
            method: 'POST',
            body: 'invalid json',
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(500)  // ✅ You changed this
        const error = await response.json()
        expect(error.error).toBe('AI service unavailable')
    })

    test('should handle missing message content', async () => {
        const app = createApp()

        const response = await app.request('/chat', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(400)
        const error = await response.json()
        expect(error.error).toBe('Message is required')
    })

    test('should handle missing prompt for profile generation', async () => {
        const app = createApp()

        const response = await app.request('/generate-profile', {
            method: 'POST',
            body: JSON.stringify({}),
            headers: { 'Content-Type': 'application/json' }
        })

        expect(response.status).toBe(400)
        const error = await response.json()
        expect(error.error).toBe('Prompt is required')
    })
})
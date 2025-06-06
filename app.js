import { Hono } from 'hono'
import { streamText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

// Factory function for dependency injection
export function createApp(options = {}) {
    const app = new Hono()

    // Use provided models or default to OpenAI
    const chatModel = options.chatModel || openai('gpt-4o')
    const objectModel = options.objectModel || openai('gpt-4o')

    app.get('/', (c) => {
        return c.json({ message: 'Hono AI Testing Server with AI is running!' })
    })

    app.post('/chat', async (c) => {
        try {
            const { message } = await c.req.json()

            if (!message) {
                return c.json({ error: 'Message is required' }, 400)
            }

            const result = await streamText({
                model: chatModel,
                prompt: message,
            })

            return result.toDataStreamResponse()
        } catch (error) {
            console.error('AI Error:', error)
            return c.json({ error: 'AI service unavailable' }, 500)
        }
    })

    app.post('/chat-with-tools', async (c) => {
        try {
            const { message } = await c.req.json()

            if (!message) {
                return c.json({ error: 'Message is required' }, 400)
            }

            const result = await streamText({
                model: chatModel,
                prompt: message,
                tools: {
                    getWeather: {
                        description: 'Get weather information for a location',
                        parameters: z.object({
                            location: z.string().describe('The location to get weather for'),
                        }),
                        execute: async ({ location }) => {
                            return {
                                location,
                                temperature: '72°F',
                                condition: 'sunny',
                                humidity: '65%'
                            }
                        }
                    }
                }
            })

            return result.toDataStreamResponse()
        } catch (error) {
            console.error('AI Error:', error)
            return c.json({ error: 'AI service unavailable' }, 500)
        }
    })

    app.post('/generate-profile', async (c) => {
        try {
            const { prompt } = await c.req.json()

            if (!prompt) {
                return c.json({ error: 'Prompt is required' }, 400)
            }

            const profileSchema = z.object({
                name: z.string(),
                age: z.number(),
                occupation: z.string(),
                personality: z.array(z.string()),
                backstory: z.string()
            })

            const result = await generateObject({
                model: objectModel,
                schema: profileSchema,
                prompt: prompt,
            })

            return c.json(result.object)
        } catch (error) {
            console.error('AI Error:', error)
            return c.json({ error: 'AI service unavailable' }, 500)
        }
    })

    return app
}

export default createApp()
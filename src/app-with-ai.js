import { Hono } from 'hono'
import { streamText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const app = new Hono()

// Health check endpoint
app.get('/', (c) => {
    return c.json({ message: 'Hono AI Testing Server with AI is running!' })
})

// Simple chat streaming endpoint
app.post('/chat', async (c) => {
    const { message } = await c.req.json()

    try {
        const result = await streamText({
            model: openai('gpt-4o'),
            prompt: message,
        })

        // Convert to HTTP streaming response
        return result.toDataStreamResponse()
    } catch (error) {
        console.error('AI Error:', error)
        return c.json({ error: 'AI service unavailable' }, 500)
    }
})

// Profile generation (structured data)
const UserProfileSchema = z.object({
    name: z.string(),
    age: z.number(),
    occupation: z.string(),
    personality: z.array(z.string()),
    backstory: z.string(),
})

app.post('/generate-profile', async (c) => {
    const { prompt } = await c.req.json()

    try {
        const result = await generateObject({
            model: openai('gpt-4o'),
            schema: UserProfileSchema,
            prompt: prompt,
        })

        return c.json(result.object)
    } catch (error) {
        console.error('AI Error:', error)
        return c.json({ error: 'AI service unavailable' }, 500)
    }
})

// Tool calling endpoint
const weatherTool = {
    description: 'Get current weather for a location',
    parameters: z.object({
        location: z.string().describe('The city and state, e.g. San Francisco, CA'),
    }),
    execute: async ({ location }) => {
        // Mock weather data
        return {
            location,
            temperature: '72°F',
            condition: 'Sunny',
            humidity: '65%'
        }
    },
}

app.post('/chat-with-tools', async (c) => {
    const { message } = await c.req.json()

    try {
        const result = await streamText({
            model: openai('gpt-4o'),
            prompt: message,
            tools: {
                getWeather: weatherTool,
            },
            maxSteps: 5,
        })

        return result.toDataStreamResponse()
    } catch (error) {
        console.error('AI Error:', error)
        return c.json({ error: 'AI service unavailable' }, 500)
    }
})

export default app
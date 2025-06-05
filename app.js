import { Hono } from 'hono'
import { streamText, generateObject } from 'ai'
import { openai } from '@ai-sdk/openai'
import { z } from 'zod'

const app = new Hono()

// Model configuration - allows injection for testing
const getModel = () => {
    // In test environment, you can set global.testModel to inject mock
    if (process.env.NODE_ENV === 'test' && global.testModel) {
        return global.testModel
    }
    return openai('gpt-4o')
}

// Health check endpoint
app.get('/', (c) => {
    return c.json({ message: 'Hono AI Testing Server with AI is running!' })
})


app.post('/chat', async (c) => {
    const { message } = await c.req.json()

    if (!message) {
        return c.json({ error: 'Message is required' }, 400)
    }

    try {
        const result = await streamText({
            model: openai('gpt-4o'),
            prompt: message,
        })
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
            model: getModel(),
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
            model: getModel(),
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

// Server setup (if running directly)
if (import.meta.url === `file://${process.argv[1]}`) {
    const { serve } = await import('@hono/node-server')
    const port = 3000

    try {
        serve({
            fetch: app.fetch,
            port
        })
        console.log(`Server started successfully on http://localhost:${port}`)
    } catch (error) {
        console.error('Failed to start server:', error)
        process.exit(1)
    }
}
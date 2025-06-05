import { Hono } from 'hono'
// Commented out AI imports for now - uncomment after adding API key
// import { streamText, generateObject } from 'ai'
// import { openai } from '@ai-sdk/openai'
// import { z } from 'zod'

const app = new Hono()

// Health check endpoint
app.get('/', (c) => {
    return c.json({ message: 'Hono AI Testing Server is running!' })
})

// Simple chat endpoint (without AI for now)
app.post('/chat', async (c) => {
    const { message } = await c.req.json()

    // For now, just echo back - replace with AI later
    return c.json({
        message: `Echo: ${message}`,
        timestamp: new Date().toISOString()
    })
})

// Profile generation endpoint (without AI for now)
app.post('/generate-profile', async (c) => {
    const { prompt } = await c.req.json()

    // Mock response for now
    return c.json({
        name: 'Test User',
        age: 25,
        occupation: 'Developer',
        personality: ['curious', 'logical'],
        backstory: `Generated from prompt: ${prompt}`
    })
})

// Tool calling endpoint (without AI for now)
app.post('/chat-with-tools', async (c) => {
    const { message } = await c.req.json()

    // Mock tool response
    return c.json({
        message: `Tool response for: ${message}`,
        tool_used: 'mock_tool',
        result: 'This is a mock response'
    })
})

export default app
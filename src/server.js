import { serve } from '@hono/node-server'
import app from './app.js'

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

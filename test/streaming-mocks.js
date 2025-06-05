import { http, HttpResponse, delay } from 'msw'

// Helper to create OpenAI streaming response chunks
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
    return http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
        const body = await request.json()
        const userMessage = body.messages.find(msg => msg.role === 'user')?.content || ''

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
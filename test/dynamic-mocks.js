import { http, HttpResponse } from 'msw'

// Reuse the dynamic mock logic from previous demo
export function createDynamicOpenAIMock(mockResponses) {
    return http.post('https://api.openai.com/v1/chat/completions', async ({ request }) => {
        const body = await request.json()
        const userMessage = body.messages.find(msg => msg.role === 'user')?.content || ''

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
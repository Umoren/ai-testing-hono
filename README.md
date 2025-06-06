# AI Streaming & Tool Calling Testing with Hono + AI SDK Mock Providers

## What We Built

A complete testing framework for streaming AI applications that tests **AI logic directly** using AI SDK's built-in mock providers instead of complex HTTP mocking.

### Architecture

```
HTTP Request → Hono Web Server → AI SDK (streamText/generateObject) → MockLanguageModelV1
```

Instead of mocking HTTP requests to OpenAI, we inject mock models directly into AI SDK calls for cleaner, more reliable testing.

## Setup

```bash
# Install dependencies
npm install

# Set up environment (optional - mocks work without API key)
echo "OPENAI_API_KEY=your-key-here" > .env

# Run all tests
npm test

# Start development server
npm run dev
```

## Project Structure

```
ai-testing-hono/
├── app.js              # Hono app with dependency injection
├── app.test.js         # Complete test suite with AI SDK mocks
├── package.json
├── vitest.config.js
└── README.md
```

## Key Files

### `app.js` - **Dependency Injection Architecture**
```javascript
// Factory function for dependency injection
export function createApp(options = {}) {
    const app = new Hono()

    // Use provided models or default to OpenAI
    const chatModel = options.chatModel || openai('gpt-4o')
    const objectModel = options.objectModel || openai('gpt-4o')

    app.post('/chat', async (c) => {
        const result = await streamText({
            model: chatModel,  // Injected model
            prompt: message,
        })
        return result.toDataStreamResponse()
    })

    return app
}

// Default export for production
export default createApp()
```

**Key Innovation**: Factory function allows injecting mock models for testing while using real OpenAI in production.

### `app.test.js` - **AI SDK Mock Provider Testing**
```javascript
import { MockLanguageModelV1, simulateReadableStream } from 'ai/test'
import { createApp } from './app.js'

test('should stream creative chat responses', async () => {
    const mockModel = new MockLanguageModelV1({
        doStream: async () => ({
            stream: simulateReadableStream({
                chunks: [
                    { type: 'text-delta', textDelta: 'Once ' },
                    { type: 'text-delta', textDelta: 'upon ' },
                    { type: 'text-delta', textDelta: 'a ' },
                    { type: 'text-delta', textDelta: 'time' },
                    {
                        type: 'finish',
                        finishReason: 'stop',
                        usage: { completionTokens: 4, promptTokens: 3 },
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
})
```

**What it does**: Uses AI SDK's testing utilities to inject mock models that return predefined responses in the correct AI SDK format.

## Test Results
```bash
✓ Health Check > should return health status
✓ AI Tests > should stream creative chat responses
✓ AI Tests > should handle simple greetings
✓ AI Tests > should handle tool calling
✓ AI Tests > should generate structured profiles
✓ AI Tests > should handle malformed JSON
✓ AI Tests > should handle missing message content
✓ AI Tests > should handle missing prompt for profile generation

Test Files  1 passed (1)
     Tests  8 passed (8)
```

## Key Features

### 1. **Dependency Injection Pattern**
- Factory function `createApp(options)` accepts models as parameters
- Production: `createApp()` uses real OpenAI models
- Testing: `createApp({ chatModel: mockModel })` uses mocks
- Clean separation between business logic and AI provider

### 2. **AI SDK Mock Providers**
- Use `MockLanguageModelV1` from `ai/test` package
- No HTTP mocking complexity - test at the right abstraction level
- AI SDK handles all format conversion automatically
- Built-in streaming simulation with proper chunk timing

### 3. **Streaming Text Responses**
- Real HTTP streaming endpoints using Hono
- AI SDK `streamText` with `toDataStreamResponse()`
- Mock providers return proper AI SDK stream format
- Automatic word-by-word streaming simulation

### 4. **Tool Calling Support**
```javascript
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
                { type: 'text-delta', textDelta: 'The weather is 72°F' },
                { type: 'finish', finishReason: 'stop' },
            ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
    }),
})
```

### 5. **Structured Data Generation**
```javascript
const mockModel = new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',  // Required for generateObject
    doGenerate: async () => ({
        text: JSON.stringify({
            name: 'Luna Martinez',
            age: 28,
            occupation: 'Digital Artist'
        }),
        usage: { completionTokens: 50, promptTokens: 10 },
        finishReason: 'stop',
        rawCall: { rawPrompt: null, rawSettings: {} },
    }),
})
```

### 6. **Proper Error Handling**
- JSON parsing errors caught and returned as 400
- Missing required fields validated
- AI SDK errors caught and returned as 500
- Framework limitations handled gracefully

## API Endpoints

### `POST /chat`
Streams AI text responses chunk by chunk
```bash
curl -X POST http://localhost:3000/chat \
  -H "Content-Type: application/json" \
  -d '{"message": "Tell me a creative story"}'
```

### `POST /chat-with-tools` 
Streams AI responses with tool calling support
```bash
curl -X POST http://localhost:3000/chat-with-tools \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the weather like?"}'
```

### `POST /generate-profile`
Returns structured user profiles
```bash
curl -X POST http://localhost:3000/generate-profile \
  -H "Content-Type": "application/json" \
  -d '{"prompt": "Generate a creative artist profile"}'
```

## Architecture Benefits

### Why MockLanguageModelV1 > MSW HTTP Mocking

| Aspect | HTTP Mocking (MSW) | AI SDK Mocks |
|--------|-------------------|--------------|
| **Abstraction Level** | Network layer | Business logic layer |
| **Code Complexity** | 200+ lines | 50+ lines |
| **Format Knowledge** | Must know OpenAI JSON | Simple object structure |
| **Maintenance** | Breaks when API changes | Future-proof |
| **Test Focus** | HTTP transport details | AI application logic |
| **Setup Complexity** | Global server setup | Per-test model injection |

### Before vs After

**Before (MSW):**
```javascript
// Complex HTTP response crafting
function createOpenAIResponse(content, isStreaming) {
    if (isStreaming) {
        const chunks = content.split(' ').map(word =>
            `data: {"choices":[{"delta":{"content":"${word} "}}]}\n\n`
        ).join('') + 'data: [DONE]\n\n'

        return new HttpResponse(chunks, {
            headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        })
    }
    // ... 50+ more lines
}
```

**After (AI SDK Mocks):**
```javascript
// Simple AI SDK format
const mockModel = new MockLanguageModelV1({
    doStream: async () => ({
        stream: simulateReadableStream({
            chunks: [
                { type: 'text-delta', textDelta: 'Hello ' },
                { type: 'text-delta', textDelta: 'world' },
                { type: 'finish', finishReason: 'stop' },
            ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
    }),
})
```

## Key Technical Insights

1. **Test the right abstraction level** - Mock AI models, not HTTP transport
2. **Dependency injection** enables clean testing without global state
3. **AI SDK handles complexity** - No manual format crafting required
4. **Framework limitations are OK** - Accept realistic error behavior
5. **Business logic focus** - Test what your app actually does with AI responses

## Common Patterns

### Mock Model for Streaming Text
```javascript
const mockModel = new MockLanguageModelV1({
    doStream: async () => ({
        stream: simulateReadableStream({
            chunks: [
                { type: 'text-delta', textDelta: 'Your ' },
                { type: 'text-delta', textDelta: 'response ' },
                { type: 'text-delta', textDelta: 'here' },
                { type: 'finish', finishReason: 'stop', usage: { ... } },
            ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
    }),
})
```

### Mock Model for Tool Calling
```javascript
const mockModel = new MockLanguageModelV1({
    doStream: async () => ({
        stream: simulateReadableStream({
            chunks: [
                {
                    type: 'tool-call',
                    toolCallType: 'function',
                    toolCallId: 'call_1',
                    toolName: 'getWeather',
                    args: { location: 'San Francisco' },
                },
                { type: 'text-delta', textDelta: 'Based on the weather data...' },
                { type: 'finish', finishReason: 'stop' },
            ],
        }),
        rawCall: { rawPrompt: null, rawSettings: {} },
    }),
})
```

### Mock Model for Structured Generation
```javascript
const mockModel = new MockLanguageModelV1({
    defaultObjectGenerationMode: 'json',
    doGenerate: async () => ({
        text: JSON.stringify({
            name: 'Test User',
            age: 25
        }),
        usage: { completionTokens: 20, promptTokens: 10 },
        finishReason: 'stop',
        rawCall: { rawPrompt: null, rawSettings: {} },
    }),
})
```

## Troubleshooting

### "Model does not have a default object generation mode"
Add `defaultObjectGenerationMode: 'json'` to your MockLanguageModelV1 for `generateObject` tests.

### Tool calls not working?
Remove `tool-result` chunks - AI SDK handles tool execution internally. Only provide `tool-call` chunks.

### JSON parsing errors in tests?
Framework auto-parses based on Content-Type. Either accept 500 status or test with different content-type.

### Tests failing after AI SDK updates?
MockLanguageModelV1 is designed to be forward-compatible. Check if chunk format changed in AI SDK docs.

## Production vs Testing

### Production (`npm start`)
```javascript
// Uses real OpenAI
const app = createApp()  // No options = real models
```

### Testing (`npm test`)
```javascript
// Uses mocks
const app = createApp({
    chatModel: mockModel,
    objectModel: mockModel
})
```

This architecture gives you the best of both worlds: real AI in production, fast reliable tests in development.
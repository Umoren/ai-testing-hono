# AI Streaming & Tool Calling Testing with Hono + AI SDK Mock Providers

## What We Built

A complete testing framework for streaming AI applications that tests the **AI logic directly** using AI SDK's built-in mock providers instead of complex HTTP mocking.

### Architecture

```
HTTP Request → Hono Web Server → AI SDK (streamText/generateObject) → AI SDK Mock Providers
```

Instead of mocking HTTP requests to OpenAI, we inject mock models directly into AI SDK calls for cleaner, more reliable testing.

## Setup

```bash
# Install dependencies
npm install

# Set up environment (optional - mocks work without API key)
echo "OPENAI_API_KEY=your-key-here" > .env

# Run all streaming tests
npm test

# Start development server
npm run dev
```

## Project Structure & File Details

```
ai-testing-hono/
├── app.js              # Complete Hono app with all AI endpoints
├── app.test.js         # Complete test suite with AI SDK mock providers
├── package.json
├── vitest.config.js
└── README.md
```

**Simplified to just 2 core files:**
- **`app.js`** - All AI endpoints with streaming and tool calling
- **`app.test.js`** - Complete test suite using AI SDK testing utilities

### `app.js` - **Complete AI Integration**
```javascript
// All endpoints use real AI SDK calls
app.post('/chat', async (c) => {
  const { message } = await c.req.json()

  const result = await streamText({
    model: openai('gpt-4o'),
    prompt: message,
  })

  return result.toDataStreamResponse() // AI SDK handles streaming
})
```

**What it does**: Defines all AI-powered endpoints with proper streaming and tool calling integration using AI SDK.

### `app.test.js` - **AI SDK Mock Provider Testing**
```javascript
// Import AI SDK testing utilities - much simpler than MSW
import { MockLanguageModelV1, convertArrayToReadableStream } from 'ai/test'

// Create mock model with simple data structure
function createMockModel(mockData) {
    return new MockLanguageModelV1({
        doStream: async ({ prompt }) => {
            // Pattern matching with automatic AI SDK format handling
            const words = response.content.split(' ')
            const textDeltas = words.map(word => ({
                type: 'text-delta',
                textDelta: word + ' '
            }))

            return {
                stream: convertArrayToReadableStream(textDeltas),
                rawCall: { rawPrompt: prompt, rawSettings: {} }
            }
        }
    })
}
```

**What it does**: Uses AI SDK's built-in testing utilities to mock AI responses without complex HTTP mocking. AI SDK handles all format conversion and streaming automatically.

### **Key Improvement: No More Manual JSON Crafting**
```javascript
// BEFORE: Complex MSW HTTP mocking (100+ lines)
function createStreamChunk(content, isLast = false, toolCall = null) {
    const chunk = {
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        // ... 50+ lines of manual OpenAI JSON format
    }
    return `data: ${JSON.stringify(chunk)}\n\n`
}

// AFTER: Simple AI SDK mock (5 lines)
const textDeltas = words.map(word => ({
    type: 'text-delta',
    textDelta: word + ' '
}))
return { stream: convertArrayToReadableStream(textDeltas) }
```

**What changed**: AI SDK testing utilities handle all the complex JSON formatting, streaming protocol, and tool calling automatically.

### `vitest.config.js` - **Simplified Configuration**
```javascript
// No external setup needed - AI SDK mocks are self-contained
export default defineConfig({
  test: {
    environment: 'node'
  }
})
```

**What it does**: Minimal test configuration since AI SDK mock providers don't require global setup like MSW.

## Test Results
```bash
✓ Health Check > should return health status
✓ AI SDK Mock Provider Tests > should test AI streaming directly with mock model
✓ AI SDK Mock Provider Tests > should test AI tool calling directly with mock model
✓ AI SDK Mock Provider Tests > should test structured generation directly
✓ End-to-End Hono Integration Tests > should stream creative chat responses via HTTP
✓ End-to-End Hono Integration Tests > should handle tool calling via HTTP
✓ End-to-End Hono Integration Tests > should generate structured profiles via HTTP
✓ End-to-End Hono Integration Tests > should handle errors gracefully
✓ End-to-End Hono Integration Tests > should handle malformed JSON requests

Test Files  1 passed (1)
     Tests  9 passed (9)
```

## Key Features

### 1. **AI SDK Mock Provider Testing**
- Direct AI logic testing without HTTP layer
- AI SDK handles all format conversion automatically
- Built-in streaming simulation with proper timing
- No manual JSON crafting required

### 2. **Streaming Text Responses**
- Real HTTP streaming endpoints using Hono
- AI SDK `streamText` integration with `toDataStreamResponse()`
- Mock providers return proper AI SDK stream format
- Automatic word-by-word streaming simulation

### 3. **Tool Calling Support**
- Multi-step AI workflows with tool execution
- Simplified tool call mocking with AI SDK testing utilities
- No complex JSON tool call structure needed
- Automatic tool call protocol handling

### 4. **Structured Data Generation**
- Non-streaming endpoints using `generateObject`
- Zod schema validation for type safety
- Mock providers handle structured output automatically

### 5. **Two-Layer Testing Strategy**
- **Unit level**: Test AI logic directly with mock models
- **Integration level**: Test complete HTTP endpoints

## Tool Calling Implementation

### How We Built Tool Calling

```javascript
// 1. Define tools with Zod schemas (same as before)
const weatherTool = {
    description: 'Get current weather for a location',
    parameters: z.object({
        location: z.string().describe('The city and state, e.g. San Francisco, CA'),
    }),
    execute: async ({ location }) => {
        return {
            location,
            temperature: '72°F',
            condition: 'Sunny',
            humidity: '65%'
        }
    },
}

// 2. Pass tools to streamText (same as before)
app.post('/chat-with-tools', async (c) => {
    const { message } = await c.req.json()

    const result = await streamText({
        model: openai('gpt-4o'),
        prompt: message,
        tools: { getWeather: weatherTool },
        maxSteps: 5,
    })

    return result.toDataStreamResponse()
})
```

### Tool Call Testing Strategy (Much Simpler Now)

```javascript
// 3. Mock tool calls with AI SDK testing utilities
const mockModel = new MockLanguageModelV1({
    doStream: async ({ prompt }) => {
        return {
            stream: convertArrayToReadableStream([
                {
                    type: 'tool-call',
                    toolCallId: 'call_test',
                    toolName: 'getWeather',
                    args: { location: 'San Francisco, CA' }
                },
                {
                    type: 'tool-result',
                    toolCallId: 'call_test',
                    result: 'Weather data here'
                },
                {
                    type: 'text-delta',
                    textDelta: 'The weather is sunny!'
                }
            ])
        }
    }
})

// 4. Test tool calls directly - no HTTP needed
const result = await streamText({
    model: mockModel,
    prompt: 'What is the weather?',
    tools: { getWeather: weatherTool }
})

const toolCalls = await result.toolCalls
expect(toolCalls[0].toolName).toBe('getWeather')
```

**Benefits over manual mocking:**
- **90% less code** - AI SDK handles tool call protocol
- **No JSON knowledge** - Simple object structure
- **Built-in validation** - AI SDK ensures proper format
- **Future-proof** - Works when tool calling format changes

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
  -H "Content-Type: application/json" \
  -d '{"prompt": "Generate a creative artist profile"}'
```

## Testing Examples

### Direct AI Logic Testing (New Approach)
```javascript
test('should test AI streaming directly with mock model', async () => {
    const mockModel = createMockModel({
        'creative story': {
            type: 'text',
            content: 'Once upon a time in a magical kingdom'
        }
    })

    // Test AI SDK directly - no HTTP layer
    const result = await streamText({
        model: mockModel,
        prompt: 'Tell me a creative story'
    })

    // Read AI SDK stream directly
    const chunks = []
    for await (const chunk of result.textStream) {
        chunks.push(chunk)
    }

    const fullText = chunks.join('')
    expect(fullText).toContain('Once upon a time')
})
```

### Tool Calling Test (Simplified)
```javascript
test('should test AI tool calling directly', async () => {
    const mockModel = createMockModel({
        'weather': {
            type: 'tool_call',
            tool_name: 'getWeather',
            tool_args: { location: 'San Francisco, CA' },
            final_response: 'The weather is 72°F and sunny.'
        }
    })

    const result = await streamText({
        model: mockModel,
        prompt: 'What is the weather?',
        tools: { getWeather: weatherTool }
    })

    // Test tool calls directly - AI SDK handles the protocol
    const toolCalls = await result.toolCalls
    expect(toolCalls[0].toolName).toBe('getWeather')
    expect(toolCalls[0].args.location).toBe('San Francisco, CA')
})
```

### HTTP Integration Test (Still Supported)
```javascript
test('should stream creative chat responses via HTTP', async () => {
    const response = await testEndpointWithMock('/chat',
        { message: 'Tell me a creative story' },
        mockData
    )

    expect(response.status).toBe(200)
    const fullResponse = await streamToText(response)
    expect(fullResponse).toContain('Once upon a time')
})
```

## Mock Data Format (Simplified)

### Text Streaming
```javascript
{
  'creative story': {
    type: 'text',
    content: 'Once upon a time in a magical kingdom'
  }
}
```

### Tool Calling
```javascript
{
  'weather': {
    type: 'tool_call',
    tool_name: 'getWeather',
    tool_args: { location: 'San Francisco, CA' },
    final_response: 'The weather is currently 72°F and sunny.'
  }
}
```

### Structured Generation
```javascript
{
  'creative artist': {
    name: 'Luna Martinez',
    age: 28,
    occupation: 'Digital Artist',
    personality: ['imaginative', 'passionate', 'detail-oriented'],
    backstory: 'Luna discovered her artistic passion while studying computer science.'
  }
}
```

## How AI SDK Mock Providers Work

1. **Mock Model Creation**: Use `MockLanguageModelV1` instead of real OpenAI model
2. **Pattern Matching**: Analyze prompt content to determine response type
3. **Stream Generation**: Use `convertArrayToReadableStream` with AI SDK format
4. **Automatic Formatting**: AI SDK handles all JSON/streaming protocol details
5. **Tool Call Protocol**: Simple object structure, no manual JSON needed
6. **Format Conversion**: AI SDK automatically converts mock → stream → HTTP response

## AI SDK Stream Format (Handled Automatically)

The AI SDK uses its own format, but now we don't need to know it:

```javascript
// We provide simple structure:
{ type: 'text-delta', textDelta: 'Hello ' }

// AI SDK automatically converts to:
0:"Hello "     // Text chunk
e:{"finishReason":"stop"}    // End frame
d:{"finishReason":"stop"}    // Done
```

**Important**: With AI SDK mock providers, you don't need to know the streaming format - it's handled automatically.

## Key Technical Insights (Updated)

1. **AI SDK mock providers** are better than HTTP mocking - test logic, not protocols
2. **Direct AI testing** is more reliable than end-to-end HTTP testing
3. **Format handling** is automatic - no manual JSON crafting needed
4. **Tool calling** is simplified to basic object structure
5. **Pattern matching** still works but with much less code
6. **Two-layer testing** gives both unit and integration coverage


## Troubleshooting

### Mock not returning expected data?
```javascript
// ❌ Wrong - old MSW approach
expect(response).toContain('data: {')

// ✅ Right - test AI logic directly
const result = await streamText({ model: mockModel, prompt: 'test' })
const text = await result.text
expect(text).toContain('expected content')
```

### Tool calls not working?
```javascript
// ✅ Use AI SDK testing format
{
  type: 'tool_call',
  tool_name: 'getWeather',
  tool_args: { location: 'SF' },
  final_response: 'Weather data'
}
```

### Want to test HTTP endpoints?
```javascript
// Use testEndpointWithMock helper function
const response = await testEndpointWithMock('/chat',
  { message: 'test' },
  mockData
)
```

### Tests running slow?
- AI SDK mock providers are much faster than HTTP mocking
- No network delays or complex stream processing
- Pattern matching happens in memory, not over HTTP
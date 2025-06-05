# AI Streaming & Tool Calling Testing with Hono + MSW

## What We Built

A complete testing framework for streaming AI applications that tests the **full user experience** - from HTTP requests through streaming responses and tool calling.

### Architecture

```
HTTP Request → Hono Web Server → AI SDK (streamText/generateObject) → MSW Mocked OpenAI
```

Instead of testing AI logic in isolation, we test the complete web application that users interact with.

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
├── src/
│   ├── app.js              # Basic Hono app
│   └── app-with-ai.js      # AI-powered endpoints with streaming
├── test/
│   ├── setup.js            # MSW global setup
│   ├── basic.test.js       # Basic API tests
│   ├── hono-streaming.test.js # AI streaming tests
│   ├── streaming-mocks.js  # Mock AI responses with streaming
│   └── dynamic-mocks.js    # Dynamic mock handlers
├── package.json
├── vitest.config.js
└── README.md
```

### `src/app-with-ai.js` - **Core AI Integration**
```javascript
// Most important: streaming text with proper response handling
app.post('/chat', async (c) => {
  const { message } = await c.req.json()

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: message }]
  })

  return result.toTextStreamResponse() // Key: converts AI SDK stream to HTTP response
})
```

**What it does**: Defines all AI-powered endpoints with proper streaming and tool calling integration.

### `test/setup.js` - **Global MSW Configuration**
```javascript
// Most important: global server setup that all tests use
export const server = setupServer()

beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
  console.log('🔧 MSW server started for testing')
})

globalThis.mockServer = server // Key: makes server available to all test files
```

**What it does**: Sets up MSW server globally so all tests can intercept HTTP requests without individual setup.

### `test/streaming-mocks.js` - **AI Response Simulation**
```javascript
// Most important: converts mock data into realistic streaming responses
function createStreamResponse(mockData) {
  const encoder = new TextEncoder()

  return new ReadableStream({
    start(controller) {
      // Key: simulates real OpenAI streaming format with delays
      mockData.content.split(' ').forEach((word, index) => {
        setTimeout(() => {
          const chunk = `data: {"choices":[{"delta":{"content":"${word} "}}]}\n\n`
          controller.enqueue(encoder.encode(chunk))
        }, index * 50) // Realistic delays between words
      })
    }
  })
}
```

**What it does**: Creates realistic streaming responses that match OpenAI's actual streaming format, with proper delays.

### `test/dynamic-mocks.js` - **Smart Mock Routing**
```javascript
// Most important: pattern matching to determine response type
export function createDynamicOpenAIMock(mockData) {
  return http.post('*/chat/completions', async ({ request }) => {
    const body = await request.json()
    const prompt = body.messages[0].content.toLowerCase()

    // Key: analyzes prompt to determine which mock to return
    for (const [pattern, data] of Object.entries(mockData)) {
      if (prompt.includes(pattern.toLowerCase())) {
        return HttpResponse.json(data)
      }
    }
  })
}
```

**What it does**: Analyzes incoming requests and returns appropriate mocked responses based on content patterns.

### `test/hono-streaming.test.js` - **End-to-End Testing**
```javascript
// Most important: full HTTP streaming test flow
test('should stream creative chat responses', async () => {
  // Setup mock
  server.use(createStreamingOpenAIMock(streamingMocks))

  // Make real HTTP request to Hono app
  const response = await app.request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'Tell me a creative story' }),
    headers: { 'Content-Type': 'application/json' }
  })

  // Key: read actual streaming response
  const reader = response.body.getReader()
  // ... process stream chunks
})
```

**What it does**: Tests the complete user experience from HTTP request through AI streaming response.

### `vitest.config.js` - **Test Configuration**
```javascript
// Most important: loads global setup for all tests
export default defineConfig({
  test: {
    setupFiles: ['./test/setup.js'], // Key: runs MSW setup before all tests
    environment: 'node'
  }
})
```

**What it does**: Configures Vitest to run MSW setup globally and use Node environment for HTTP testing.

## Test Results
```bash
✓ test/basic.test.js (4 tests)
✓ test/hono-streaming.test.js (5 tests)
  ✓ should stream creative chat responses
  ✓ should handle tool calling with weather requests
  ✓ should generate structured profiles (non-streaming)
  ✓ should handle streaming errors gracefully
  ✓ should handle multiple streaming scenarios

Test Files  2 passed (2)
     Tests  9 passed (9)
```

## Key Features

### 1. **Streaming Text Responses**
- Real HTTP streaming endpoints using Hono
- AI SDK `streamText` integration with `toTextStreamResponse()`
- MSW mocks that return `ReadableStream` responses
- Word-by-word streaming simulation with realistic delays

### 2. **Tool Calling Support** 
- Multi-step AI workflows with tool execution
- Streaming tool calls and responses
- Mock tool implementations (weather, calculations, etc.)
- Complex agent workflows with proper tool chaining

### 3. **Structured Data Generation**
- Non-streaming endpoints using `generateObject`
- Zod schema validation for type safety
- Reusable dynamic mocking patterns

### 4. **End-to-End Testing**
- HTTP-level testing using Hono's `app.request()`
- Stream reading and validation
- Error scenario testing with graceful fallbacks
- Multiple user intent scenarios

## Tool Calling Implementation

### How We Built Tool Calling

```javascript
// 1. Define tools with Zod schemas
const tools = {
  getWeather: {
    description: 'Get current weather for a location',
    parameters: z.object({
      location: z.string().describe('The city and state/country')
    }),
    execute: async ({ location }) => {
      // Real tool implementation
      return `Weather in ${location}: Sunny, 72°F, 65% humidity`
    }
  }
}

// 2. Pass tools to streamText
app.post('/chat-with-tools', async (c) => {
  const { message } = await c.req.json()

  const result = await streamText({
    model: openai('gpt-4o-mini'),
    messages: [{ role: 'user', content: message }],
    tools, // Key: AI SDK handles tool calling protocol
    maxSteps: 5 // Allow multi-step workflows
  })

  return result.toTextStreamResponse()
})
```

### Tool Call Testing Strategy

```javascript
// 3. Mock tool calls in tests
const toolMocks = {
  'weather': {
    type: 'tool_call',
    tool_name: 'getWeather',
    tool_args: { location: 'San Francisco, CA' },
    final_response: 'The weather in San Francisco is 72°F and sunny.'
  }
}

// 4. Verify tool call format in stream
expect(fullResponse).toContain('9:{"toolCallId"')  // AI SDK tool format
expect(fullResponse).toContain('toolName":"getWeather"')
```

### Tool Call Flow

1. **User asks**: "What's the weather like?"
2. **AI decides**: Needs to call getWeather tool
3. **Stream emits**: Tool call in AI SDK format (`9:{"toolCallId":"call_123"}`)
4. **Tool executes**: Returns weather data
5. **Stream emits**: Tool result (`a:{"toolCallId":"call_123","result":"..."}`)
6. **AI responds**: "The weather in San Francisco is 72°F and sunny"

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

### Streaming Text Test
```javascript
test('should stream creative chat responses', async () => {
  const streamingMocks = {
    'creative story': {
      type: 'text',
      content: 'Once upon a time in a magical kingdom...'
    }
  }
  
  server.use(createStreamingOpenAIMock(streamingMocks))
  
  const response = await app.request('/chat', {
    method: 'POST',
    body: JSON.stringify({ message: 'Tell me a creative story' }),
    headers: { 'Content-Type': 'application/json' }
  })
  
  // Read streaming response
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let chunks = []

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(decoder.decode(value))
  }

  const fullResponse = chunks.join('')

  // Verify AI SDK streaming format
  expect(fullResponse).toContain('0:"Once')  // AI SDK chunk format
  expect(fullResponse).toContain('magical')
})
```

### Tool Calling Test  
```javascript
test('should handle tool calling with weather requests', async () => {
  const toolMocks = {
    'weather': {
      type: 'tool_call',
      tool_name: 'getWeather',
      tool_args: { location: 'San Francisco, CA' },
      final_response: 'The weather in San Francisco is 72°F and sunny.'
    }
  }
  
  server.use(createStreamingOpenAIMock(toolMocks))
  
  const response = await app.request('/chat-with-tools', {
    method: 'POST',
    body: JSON.stringify({ message: 'What is the weather like?' }),
    headers: { 'Content-Type': 'application/json' }
  })
  
  const fullResponse = await streamToText(response)

  // Verify tool call format in AI SDK stream
  expect(fullResponse).toContain('9:{"toolCallId"')  // AI SDK tool format
  expect(fullResponse).toContain('toolName":"getWeather"')
  expect(fullResponse).toContain('San Francisco')
})
```

## MSW Streaming Mock Format

### Text Streaming
```javascript
{
  'creative story': {
    type: 'text',
    content: 'Once upon a time in a magical kingdom there lived a brave knight'
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
    final_response: 'The weather in San Francisco is currently 72°F and sunny.'
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

## How Streaming Mocks Work

1. **Request Interception**: MSW intercepts OpenAI API calls
2. **Pattern Matching**: Analyzes prompt content to determine response type  
3. **Stream Generation**: Creates `ReadableStream` with proper OpenAI chunk format
4. **Realistic Delays**: Adds delays between chunks to simulate real streaming
5. **Tool Call Protocol**: Handles tool calling in proper streaming format
6. **AI SDK Conversion**: OpenAI format → AI SDK format → Your app

## AI SDK Stream Format

The AI SDK uses a different format than raw OpenAI responses:

```javascript
// AI SDK streaming format:
f:{"messageId":"msg-123"}     // Frame start
0:"Hello "                   // Text chunk
0:"world"                    // Text chunk
9:{"toolCallId":"call_123"}  // Tool call
a:{"toolCallId":"call_123"}  // Tool result
e:{"finishReason":"stop"}    // End frame
d:{"finishReason":"stop"}    // Done
```

**Important**: Test expectations must match AI SDK format, not OpenAI format.

## Key Technical Insights

1. **MSW is essential** for reliable AI testing - don't test against live APIs
2. **AI SDK format** differs from raw OpenAI responses - adjust test expectations
3. **Stream testing** requires proper chunk reading with `ReadableStream` API
4. **Tool calling** can be fully tested with mocks - no need for real tools
5. **Pattern matching** in mocks allows dynamic responses based on user input
6. **Global MSW setup** prevents test interference and improves performance

## Troubleshooting

### Tests expecting wrong format?
```javascript
// ❌ Wrong - OpenAI format
expect(response).toContain('data: {')
expect(response).toContain('tool_calls')

// ✅ Right - AI SDK format
expect(response).toContain('0:"Hello')
expect(response).toContain('9:{"toolCallId"')
```

### MSW not intercepting requests?
- Check `test/setup.js` is properly configured
- Verify `setupFiles` in `vitest.config.js`
- Ensure MSW server starts before tests run

### Stream reading issues?
```javascript
// Proper stream reading
const reader = response.body.getReader()
const decoder = new TextDecoder()
let chunks = []

while (true) {
  const { done, value } = await reader.read()
  if (done) break
  chunks.push(decoder.decode(value))
}

const fullResponse = chunks.join('')
```

---
name: architecture
description: System architecture, Edge functions, API design, and modularity patterns
version: 1.0.0
context: infrastructure
---

# Architecture Skill

This skill defines the system architecture, including component design, Edge function patterns, and API structure.

## System Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                         denali.health                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌───────────────┐         ┌───────────────┐         ┌───────────┐ │
│  │   PWA Client  │────────▶│ Edge Functions │────────▶│   Claude  │ │
│  │   (Frontend)  │◀────────│   (Backend)    │◀────────│   (AI)    │ │
│  └───────────────┘         └───────────────┘         └───────────┘ │
│                                   │                        │        │
│                                   ▼                        ▼        │
│                            ┌───────────────┐         ┌───────────┐ │
│                            │   Supabase    │         │   MCPs    │ │
│                            │   (Database)  │         │  (Tools)  │ │
│                            └───────────────┘         └───────────┘ │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Design Principles

### 1. Frontend is Dumb

The PWA client:
- Renders what Claude returns
- Sends user input to Edge functions
- Handles UI state only (theme, loading)
- No business logic
- No direct API calls to external services

### 2. Claude is the Brain

Claude:
- Drives the conversation flow
- Decides which tools to call
- Synthesizes information
- Generates all content
- Learns from feedback

### 3. Skills are Modular

Each skill:
- Has a single responsibility
- Can be loaded/unloaded dynamically
- Is testable in isolation
- Communicates through defined interfaces

### 4. Tools are Interchangeable

External APIs:
- Accessed through abstraction layers
- Can be swapped without frontend changes
- Have fallback behavior defined
- Are versioned independently

## Component Architecture

### PWA Client

```
/app
├── /components
│   ├── Chat.tsx           # Main chat interface
│   ├── Message.tsx        # Message bubble
│   ├── Input.tsx          # Text input + suggestions
│   ├── Suggestions.tsx    # Tappable chips
│   └── Feedback.tsx       # Thumbs up/down
├── /screens
│   ├── Welcome.tsx        # Landing/greeting
│   ├── Conversation.tsx   # Chat flow
│   ├── Guidance.tsx       # Coverage output
│   ├── Appeal.tsx         # Appeal letter view
│   ├── Settings.tsx       # User preferences
│   └── History.tsx        # Past conversations
├── /hooks
│   ├── useChat.ts         # Chat state management
│   ├── useAuth.ts         # Authentication
│   └── useTheme.ts        # Theme management
└── /lib
    ├── supabase.ts        # Supabase client
    └── api.ts             # Edge function calls
```

### Edge Functions

```
/supabase/functions
├── /chat
│   └── index.ts           # Main conversation handler
├── /coverage-check
│   └── index.ts           # NCD/LCD lookup
├── /generate-appeal
│   └── index.ts           # Appeal letter generation
├── /process-feedback
│   └── index.ts           # Handle thumbs up/down
├── /report-outcome
│   └── index.ts           # Appeal result tracking
├── /auth-otp
│   └── index.ts           # OTP send/verify
├── /stripe-webhook
│   └── index.ts           # Payment processing
└── /nightly-learning
    └── index.ts           # Scheduled learning jobs
```

## Edge Function Patterns

### Standard Request Handler

```typescript
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from '@supabase/supabase-js'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request
    const { message, conversationId } = await req.json()

    // Initialize Supabase
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Get user from auth header (optional)
    const authHeader = req.headers.get('Authorization')
    let user = null
    if (authHeader) {
      const { data } = await supabase.auth.getUser(
        authHeader.replace('Bearer ', '')
      )
      user = data.user
    }

    // Business logic here...
    const result = await processMessage(message, conversationId, user)

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

### Chat Function with Claude

```typescript
import Anthropic from '@anthropic-ai/sdk'

async function processMessage(
  message: string,
  conversationId: string,
  context: ConversationContext
): Promise<ChatResponse> {
  const anthropic = new Anthropic({
    apiKey: Deno.env.get('ANTHROPIC_API_KEY')!
  })

  // Load relevant skills
  const skills = await loadSkills(context)

  // Get learning context
  const learningContext = await getLearningContext(
    context.symptoms,
    context.procedures
  )

  // Build system prompt
  const systemPrompt = buildSystemPrompt(skills, learningContext)

  // Get conversation history
  const history = await getConversationHistory(conversationId)

  // Call Claude
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [
      ...history,
      { role: 'user', content: message }
    ],
    tools: getAvailableTools(context)
  })

  // Process tool calls if any
  if (response.stop_reason === 'tool_use') {
    const toolResults = await executeTools(response.content)
    // Continue conversation with tool results...
  }

  // Extract entities for learning
  const entities = extractEntities(response.content)

  // Store message and entities
  await storeMessage(conversationId, 'assistant', response.content, entities)

  // Queue learning updates
  await queueLearningUpdates(entities)

  return {
    content: response.content,
    suggestions: generateSuggestions(context),
    entities
  }
}
```

## API Design

### REST Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/chat` | POST | Optional | Send message, get response |
| `/coverage-check` | POST | Optional | Check Medicare coverage |
| `/generate-appeal` | POST | Required | Generate appeal letter |
| `/feedback` | POST | Required | Submit thumbs up/down |
| `/outcome` | POST | Required | Report appeal result |
| `/history` | GET | Required | Get conversation history |
| `/settings` | GET/PUT | Required | User preferences |

### Request/Response Patterns

**Chat Request**:
```typescript
interface ChatRequest {
  message: string
  conversationId?: string  // null for new conversation
  context?: {
    symptoms?: string[]
    procedures?: string[]
    provider?: {
      name: string
      npi?: string
    }
  }
}
```

**Chat Response**:
```typescript
interface ChatResponse {
  conversationId: string
  message: {
    id: string
    role: 'assistant'
    content: string
  }
  suggestions: string[]
  state: {
    stage: 'intake' | 'coverage' | 'guidance' | 'appeal'
    hasGuidance: boolean
    canPrint: boolean
  }
}
```

## Tool Integration

### MCP Tool Abstraction

```typescript
interface MCPTool {
  name: string
  description: string
  execute: (params: Record<string, any>) => Promise<any>
}

const tools: MCPTool[] = [
  {
    name: 'search_icd10',
    description: 'Search ICD-10 diagnosis codes',
    execute: async ({ query }) => {
      // Call ICD-10 MCP
      return await icd10MCP.search(query)
    }
  },
  {
    name: 'search_npi',
    description: 'Search NPI registry for providers',
    execute: async ({ name, state, specialty }) => {
      // Call NPI Registry MCP
      return await npiMCP.search({ name, state, specialty })
    }
  },
  {
    name: 'search_coverage',
    description: 'Search Medicare NCDs and LCDs',
    execute: async ({ icd10, cpt, state }) => {
      // Call CMS Coverage MCP
      return await cmsMCP.searchCoverage({ icd10, cpt, state })
    }
  }
]
```

### Tool Execution

```typescript
async function executeTools(
  toolCalls: ToolCall[]
): Promise<ToolResult[]> {
  const results: ToolResult[] = []

  for (const call of toolCalls) {
    const tool = tools.find(t => t.name === call.name)

    if (!tool) {
      results.push({
        id: call.id,
        error: `Unknown tool: ${call.name}`
      })
      continue
    }

    try {
      const result = await tool.execute(call.params)
      results.push({
        id: call.id,
        result
      })
    } catch (error) {
      results.push({
        id: call.id,
        error: error.message
      })
    }
  }

  return results
}
```

## Error Handling

### Error Categories

```typescript
enum ErrorCode {
  // Client errors
  INVALID_REQUEST = 'INVALID_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  PAYMENT_REQUIRED = 'PAYMENT_REQUIRED',

  // Server errors
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  CLAUDE_ERROR = 'CLAUDE_ERROR',
  TOOL_ERROR = 'TOOL_ERROR',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // Business errors
  APPEAL_LIMIT_REACHED = 'APPEAL_LIMIT_REACHED',
  SERVICE_NOT_COVERED = 'SERVICE_NOT_COVERED'
}
```

### Error Response

```typescript
interface ErrorResponse {
  error: {
    code: ErrorCode
    message: string
    details?: Record<string, any>
  }
}
```

## Caching Strategy

### Cache Layers

1. **CDN Cache**: Static assets (PWA shell, images)
2. **Edge Cache**: Policy lookups (NCDs/LCDs)
3. **Database Cache**: Learning context, mappings
4. **Client Cache**: Conversation state, user preferences

### Policy Cache

```typescript
// Cache NCDs/LCDs for 24 hours
const POLICY_CACHE_TTL = 24 * 60 * 60 * 1000

async function getCoveragePolicy(icd10: string, cpt: string, state: string) {
  const cacheKey = `policy:${icd10}:${cpt}:${state}`

  // Check cache
  const cached = await cache.get(cacheKey)
  if (cached && !isExpired(cached)) {
    return cached.data
  }

  // Fetch fresh
  const policy = await cmsMCP.searchCoverage({ icd10, cpt, state })

  // Update cache
  await cache.set(cacheKey, {
    data: policy,
    timestamp: Date.now()
  }, POLICY_CACHE_TTL)

  return policy
}
```

## Deployment

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=xxx
SUPABASE_SERVICE_ROLE_KEY=xxx

# Anthropic
ANTHROPIC_API_KEY=xxx

# Stripe
STRIPE_SECRET_KEY=xxx
STRIPE_WEBHOOK_SECRET=xxx

# MCPs
ICD10_MCP_URL=xxx
NPI_MCP_URL=xxx
CMS_MCP_URL=xxx
PUBMED_MCP_URL=xxx
```

### Deploy Commands

```bash
# Deploy all functions
supabase functions deploy

# Deploy specific function
supabase functions deploy chat

# Deploy database changes
supabase db push
```

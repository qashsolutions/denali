# Chunk 08: AI Chat Engine

> **BEFORE YOU START**: Read `AGENT.md` and follow ALL rules. Execute EVERY test below. No skipping.

**Total tests in this chunk: 20 (12 positive + 8 negative)**
**Prerequisites**: Chunks 02-03, 06 passed (auth + consent working)
**Account**: `ramanac@gmail.com` (admin — unlimited messages)
**Clean state**: Sign in fresh, navigate to chat

---

## Positive Tests

### 8.P1 — Chat page loads with 6 suggestion cards
**Steps**: Sign in as `ramanac@gmail.com`. Navigate to `BASE_URL/app/chat` (new conversation).
**Expected**: 6 empty-state suggestion cards visible: Check Coverage, Appeal a Denial, Understand My Bill, Preventive Care, Diabetes Care, Weight Management.
**Log**: List all card titles found, count.

### 8.P2 — Send message with SSE streaming
**Steps**: Type "What is Medicare Part B?" in chat input and send.
**Expected**: Response streams incrementally via SSE (text appears word-by-word or chunk-by-chunk, not all at once). Full response about Medicare Part B received.
**Log**: Streaming observed yes/no, response received yes/no, approximate response length.

### 8.P3 — Conversation created in sidebar
**Steps**: After sending first message, check the conversation sidebar/list.
**Expected**: New conversation appears with a title or preview.
**Log**: Conversation visible in sidebar yes/no, title/preview text.

### 8.P4 — Conversation history API
**Steps**: `curl -s BASE_URL/api/conversations -b "cookies"`
**Expected**: HTTP 200. Returns JSON array of conversations.
**Log**: HTTP status, count of conversations returned.

### 8.P5 — Single conversation retrieval
**Steps**: From 8.P4 response, take the first conversation ID. `curl -s BASE_URL/api/conversations/[ID] -b "cookies"`
**Expected**: HTTP 200. Returns conversation with messages array.
**Log**: HTTP status, message count in conversation.

### 8.P6 — Feedback — thumbs up
**Steps**: In browser, find a Claude response message and click the thumbs-up button.
**Expected**: `POST /api/feedback` succeeds. Visual indicator shows feedback recorded.
**Log**: Feedback POST status, UI update.

### 8.P7 — Feedback — thumbs down
**Steps**: Find another Claude response and click thumbs-down.
**Expected**: `POST /api/feedback` succeeds.
**Log**: Feedback POST status, UI update.

### 8.P8 — Suggestion card click sends message
**Steps**: Start a new conversation. Click the "Check Coverage" suggestion card.
**Expected**: Pre-filled message sent automatically. Claude responds with coverage-related content.
**Log**: Message sent automatically yes/no, response topic.

### 8.P9 — Session state tracks user info
**Steps**: In a conversation, say "My name is John and I live in 75019." Then ask about a procedure.
**Expected**: Claude remembers name and ZIP in subsequent messages. SessionState updated with name + ZIP.
**Log**: Claude references name/ZIP in follow-up yes/no.

### 8.P10 — Onboarding skill triggers for new conversation
**Steps**: Start a brand new conversation. Send just "Hi" or "Hello".
**Expected**: Claude asks for the user's name and/or ZIP code (ONBOARDING skill triggered).
**Log**: Claude asked for name/ZIP yes/no, what it asked.

### 8.P11 — Multi-turn conversation maintains context
**Steps**: In one conversation:
1. "I need help with Medicare coverage for a knee MRI"
2. "My doctor said I need it for a torn meniscus"  
3. "What codes would apply?"
4. "Are there any prior auth requirements?"
5. "What about the denial rate?"
**Expected**: Each response builds on prior context. Claude doesn't forget the procedure or diagnosis.
**Log**: Context maintained across turns yes/no, any context loss observed.

### 8.P12 — Attachment accepted (valid image)
**Steps**: Attach a small (<1MB) PNG or JPEG image to a chat message. Send with text "What do you see in this image?"
**Expected**: Attachment accepted. Claude processes and references the image in response.
**Log**: Attachment uploaded yes/no, Claude referenced it yes/no.

---

## Negative Tests

### 8.N1 — Chat without auth
**Steps**: Clear cookies. `curl -X POST BASE_URL/api/chat -H "Content-Type: application/json" -d '{"message":"test"}'`
**Expected**: HTTP 401 with `AUTH_REQUIRED`.
**Log**: HTTP status, error code.

### 8.N2 — Invalid attachment media type
**Steps**: Try to attach a `.exe` or `.sh` file to chat.
**Expected**: HTTP 400 — invalid media type rejected.
**Log**: HTTP status, error message.

### 8.N3 — Missing attachment base64
**Steps**: `curl -X POST BASE_URL/api/chat -H "Content-Type: application/json" -d '{"message":"test","attachment":{"name":"test.png","mediaType":"image/png"}}' -b "cookies"`
**Expected**: HTTP 400 — missing base64 data.
**Log**: HTTP status, error message.

### 8.N4 — Oversized attachment on trial plan
**Steps**: Sign in as a trial user (`ramanac+c@gmail.com`). Attach a file >2MB.
**Expected**: HTTP 413 — exceeds trial plan upload limit.
**Log**: HTTP status, error.

### 8.N5 — Empty message body
**Steps**: `curl -X POST BASE_URL/api/chat -H "Content-Type: application/json" -d '{"message":""}' -b "cookies"`
**Expected**: HTTP 400 or graceful handling — no crash.
**Log**: HTTP status, behavior.

### 8.N6 — XSS script tag in chat
**Steps**: Send this message in chat: `<script>alert('xss')</script>`
**Expected**: Script rendered as plain text in the chat UI. NOT executed. No alert dialog.
**Log**: Rendered as text yes/no, script executed yes/no.

### 8.N7 — Consent banner blocks health context
**Steps**: With Blue Button connected but `health_data_ai` consent OFF, navigate to chat.
**Expected**: Grey banner appears telling user to go to Settings to enable health data AI consent.
**Log**: Banner visible yes/no, text content. (Mark BLOCKED if BB not connected yet.)

### 8.N8 — Chat with expired trial
**Steps**: As an expired trial user, attempt to send a chat message.
**Expected**: HTTP 403 `TRIAL_EXPIRED`.
**Log**: HTTP status, error code. (Mark BLOCKED if no expired trial account available.)

---

## End of Chunk 08

**You must now**: Write `results/chunk-08-results.md` with every test result, then report summary to user and STOP.

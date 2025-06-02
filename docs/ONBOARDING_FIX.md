# Onboarding Context Bug Fix

## Problem Description

When users first message the bot, they experienced two main issues:
1. The bot's response ignored the user's actual message, giving a generic onboarding greeting
2. Sometimes users needed to send "Start onboarding" twice for it to work properly

These issues affected both individual and group chats.

## Root Causes

### 1. Missing Context in Initial Onboarding
The `StartOnboarding` function was called with an empty array of messages, meaning the AI had no context about what the user actually said:

```typescript
// Before: No context passed
const generatedMessage = await generateAgentResponse(
  [], // Empty array - no user context!
  "Hello!", // Generic prompt
  ...
);
```

### 2. Flawed State Detection
The system used a simple message count to determine if onboarding was in progress:
```typescript
// Before: Flawed logic
const isOnboardingInProgress = threadMessages.length > 1;
```

This meant the first message was always treated as "start fresh" without context.

## The Fix

### 1. Pass User Context to Onboarding
Updated `generateOnboardingMessage` to accept and use the actual thread messages and user's message:

```typescript
// After: Full context passed
async function generateOnboardingMessage(
  systemPrompt: string,
  threadMessages: ThreadMessage[],
  userMessage: string,
  service?: string
): Promise<string> {
  // Now uses actual user message and thread context
  const generatedMessage = await generateAgentResponse(
    threadMessages, // Pass actual messages
    userMessage || "Hello!", // Use real user message
    ...
  );
}
```

### 2. Improved State Detection
Changed to detect onboarding state based on agent participation:

```typescript
// After: Better logic
const hasAgentMessages = threadMessages.some(
  msg => msg.sender_number === process.env.A1BASE_AGENT_NUMBER
);
const isOnboardingInProgress = hasAgentMessages && threadMessages.length > 1;
```

### 3. Explicit Onboarding Request Handling
Added support for users who explicitly type "Start onboarding":

```typescript
// Check if user explicitly requested onboarding
const latestMessage = threadMessages[threadMessages.length - 1];
if (latestMessage?.content?.trim().toLowerCase() === "start onboarding") {
  return true; // Always trigger onboarding
}
```

### 4. Contextual Group Chat Welcome
Group chats now generate contextual welcome messages based on the first message:

```typescript
// Generate a contextual welcome that acknowledges what was said
if (payload.message_content?.text) {
  // AI generates welcome that references the user's actual message
  // Instead of generic "Welcome to the group!"
}
```

## Testing the Fix

We've created test scripts to verify the fix works correctly:

### 1. Test First Message Context
```bash
node scripts/test-messaging-webhook.js
```
This simulates a user's first message: "Hello, I need help setting up my new project for a mobile app"

**Expected**: The bot should respond with onboarding that acknowledges the project request.

### 2. Test "Start onboarding" Trigger
```bash
node scripts/test-onboarding-trigger.js
```
This simulates a user explicitly typing "Start onboarding"

**Expected**: Onboarding should start immediately, not require a second message.

### 3. Test Group Chat Onboarding
```bash
node scripts/test-group-onboarding.js
```
This simulates a first message in a group: "Hey everyone, let's organize our team project here!"

**Expected**: The bot should welcome the group while acknowledging the project organization request.

## Verification Steps

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Run each test script and check the server logs

3. Verify that:
   - First messages get contextual responses
   - "Start onboarding" works on the first try
   - Group chats get personalized welcome messages

## Code Changes Summary

- **lib/workflows/onboarding-workflow.ts**: Updated to pass user context
- **lib/ai-triage/handle-whatsapp-incoming.ts**: Improved state detection logic
- **lib/workflows/group-onboarding-workflow.ts**: Added contextual welcome generation

The fix ensures users get a natural, contextual onboarding experience from their very first message. 
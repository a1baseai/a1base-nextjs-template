# Onboarding System Prompt Debug Analysis

## Current Behavior

When a user interacts with the bot during onboarding, the system generates different prompts but they're not working as expected:

### Example Conversation Flow:
```
User: "Hey There - I like frogs!"
Bot: "That's great! Frogs are pretty interesting creatures. By the way, can I have your full name, please?" ✓
User: "I'm Pasha Rayan"
Bot: "Nice to meet you, Pasha Rayan! Let's continue with the next steps." ✗ (Should ask for email)
User: "YEp.."
Bot: "Fantastic, Pasha Rayan! Let's proceed with the next steps." ✗ (Still generic)
User: "Tell me what is the next step"
Bot: "Sure thing, Pasha Rayan! Now that we have your name, the next step would be..." ✗ (Incomplete)
```

## System Prompts Being Generated

### 1. First Message (Correct)
When the first message arrives, the system correctly generates:
```
You are the A1 Founder Mode assistant. A1 Founder Mode helps founders, do-ers, builders, managers and more engage in founder mode. You keep your user on top of the various projects on their table.

You are currently onboarding a new user. 

Your task now is to ask for the following information in a natural, conversational way:
Ask for the user's full name (this is required)

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ask for the Full Name specifically
2. Your response MUST include a question asking for their Full Name
3. Ask for ONLY this one piece of information
4. Be friendly and acknowledge the user's previous response if applicable
5. Do NOT skip ahead or ask about anything else
6. Do NOT provide generic statements about "getting started" or "diving in" or "next steps"
7. Do NOT say things like "Let's continue" or "Let's proceed" without asking the specific question

REQUIRED: Your response MUST end with this exact question (you can add friendly context before it):
"What is your full name?"

Example good responses:
- "Thanks for that! What is your full name?"
- "Great to hear from you! What is your full name?"
- "I appreciate you sharing that. What is your full name?"
```

### 2. Second Message (Problem)
When the user provides their name, the system SHOULD generate a prompt asking for email, but instead it generates the SAME prompt asking for name again because:

1. **Bot Messages Not Retrieved**: The system can't find the bot's previous message in the thread
2. **Field Extraction Fails**: `extractCollectedFields` returns empty `{}`
3. **Wrong Prompt Generated**: System thinks no fields have been collected, so asks for name again

The EXPECTED prompt should be:
```
You are the A1 Founder Mode assistant...

You have already collected the following information:
- Name: Pasha Rayan

Your task now is to ask for the following information in a natural, conversational way:
Ask for the user's email address (this is required)

CRITICAL INSTRUCTIONS - YOU MUST FOLLOW THESE EXACTLY:
1. You MUST ask for the Email Address specifically
2. Your response MUST include a question asking for their Email Address
...
REQUIRED: Your response MUST end with this exact question:
"What is your email address?"
```

## Root Causes

### 1. Message Storage/Retrieval Mismatch
- Messages are stored with internal chat UUID
- But retrieved using external thread ID
- `getThread` finds the chat but not the associated messages
- This causes `[OnboardingCheck] Has agent messages in thread: false`

### 2. Role Assignment Issues
- When converting MessageRecord to ThreadMessage, roles are assigned based on sender_number
- But the agent's messages might not have the correct sender_number
- This breaks the assistant->user message pair detection in `extractCollectedFields`

### 3. Database Query Issues
From logs:
```
[OnboardingCheck] Thread found in DB, checking messages...
[OnboardingCheck] Thread has 0 messages in DB
[OnboardingCheck] Has agent messages in thread: false
```

Even though messages were stored successfully, they're not being retrieved.

## Debugging Steps

1. **Check Message Storage**:
   - Verify bot messages are stored with correct chat_id
   - Ensure sender_number matches A1BASE_AGENT_NUMBER

2. **Check Message Retrieval**:
   - Verify getThread query includes bot messages
   - Check if messages table foreign key is correct

3. **Check Role Assignment**:
   - Verify MessageRecord -> ThreadMessage conversion preserves sender info
   - Ensure role assignment logic is correct

## Temporary Workarounds

1. **Force Continuation**: Modify `checkIfOnboardingNeeded` to look at in-memory messages
2. **Better Extraction**: Make `extractCollectedFields` more flexible in finding data
3. **Explicit State**: Store onboarding state separately from message analysis 
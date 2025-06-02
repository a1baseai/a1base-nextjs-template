# A1 Framework Onboarding System Architecture

## Overview

The A1 Framework implements a dynamic, configuration-driven onboarding system that collects user information through natural conversation. The system adapts to different contexts (individual vs group chats) and stores collected data for future personalization.

## Configuration Structure

### 1. Individual Onboarding (`data/onboarding-flow.json`)
```json
{
  "enabled": true,
  "mode": "agentic",
  "agenticSettings": {
    "systemPrompt": "You are the A1 Founder Mode assistant...",
    "userFields": [
      {
        "id": "name",
        "label": "Full Name",
        "required": true,
        "description": "Ask for the user's full name"
      },
      {
        "id": "email",
        "label": "Email Address",
        "required": true,
        "description": "Ask for the user's email address"
      },
      {
        "id": "big_dream",
        "label": "BigDream",
        "required": true,
        "description": "Ask the user for what their biggest dream for their project/startup is"
      }
    ],
    "finalMessage": "Thank you for sharing this information..."
  }
}
```

### 2. Group Onboarding (`data/group-onboarding-flow.json`)
```json
{
  "enabled": true,
  "mode": "agentic",
  "agenticSettings": {
    "systemPrompt": "Your name is FelicieGroup!...",
    "initialGroupMessage": "Hello everyone! I'm Felicie...",
    "userFields": [
      {
        "id": "group_purpose",
        "label": "Group Purpose",
        "required": true,
        "description": "Ask what the main purpose/goal of this group chat is"
      },
      {
        "id": "harshness",
        "label": "harshness",
        "required": true,
        "description": "The AI should ask how harsh and rude the AI should be..."
      }
    ],
    "finalMessage": "I've got everything I need to start working with you!..."
  }
}
```

## Logic Flow

### Phase 1: Configuration Loading
1. **On System Start**: Load configuration from JSON files
2. **Runtime Updates**: Configuration can be updated via UI at:
   - Individual: `/profile-editor/onboarding-flow`
   - Group: `/profile-editor/group-onboarding`

### Phase 2: Onboarding Trigger Detection

#### For Individual Chats:
1. **First Message**: When a new user sends their first message
2. **Explicit Request**: When user types "Start onboarding"
3. **Incomplete Onboarding**: When onboarding was started but not completed

#### For Group Chats:
1. **New Group Creation**: When bot is added to a new group
2. **Participant Threshold**: When group reaches configured participant count
3. **Reintroduction**: After configured period of inactivity

### Phase 3: Question Generation

1. **Extract Collected Data**: Check conversation history for already answered fields
2. **Identify Next Field**: Determine which required field to ask for next
3. **Generate Contextual Question**: 
   - Use the field's `description` to guide question generation
   - Acknowledge user's previous message
   - Ask for ONE field at a time

#### System Prompt and Personality During Onboarding

**Important**: During onboarding, the system uses the `systemPrompt` defined in the onboarding configuration files, NOT the base agent profile settings.

**Individual Onboarding System Prompt** (`data/onboarding-flow.json`):
```json
{
  "systemPrompt": "You are the A1 Founder Mode assistant. A1 Founder Mode helps founders, do-ers, builders, managers and more engage in founder mode. You keep your user on top of the various projects on their table."
}
```

**Group Onboarding System Prompt** (`data/group-onboarding-flow.json`):
```json
{
  "systemPrompt": "Your name is FelicieGroup! and you are the A1 Founder Mode assistant. A1 Founder Mode helps founders, do-ers, builders, managers and more engage in founder mode. You're now in a group chat context with multiple participants.\n\nYou are conducting an onboarding conversation..."
}
```

**Key Points:**
- The onboarding `systemPrompt` completely defines the bot's personality during onboarding
- Base agent profile settings (name, role, tone, etc.) are NOT automatically included
- Safety settings and formatting instructions ARE still applied
- To maintain consistent personality, include bot characteristics in the onboarding `systemPrompt`

**Example of including personality in onboarding prompt:**
```json
{
  "systemPrompt": "You are Amy, the A1 Founder Mode assistant. You're friendly, approachable, and excited to help founders. A1 Founder Mode helps founders, do-ers, builders, managers and more engage in founder mode. You keep your user on top of the various projects on their table. Be warm and conversational while collecting the required information."
}
```

### Phase 4: Response Processing

1. **Field Extraction**: Identify which field the user just provided
2. **Validation**: Check if response satisfies the field requirement
3. **Progress Tracking**: Update internal state with collected fields
4. **Next Action**: Either ask for next field or complete onboarding

### Phase 5: Data Storage

The system stores onboarding data in different locations based on chat type:

#### Individual Chat Storage (`conversation_users.metadata` JSONB field):
```json
{
  "name": "Pasha Rayan",
  "email": "pasha@a1base.com",
  "big_dream": "A1Base to become the critical communication and trust infrastructure between AI agents and humans",
  "a1_account_id": "2928f8b1-0a7a-4a94-882f-f255cbfab752",
  "onboarding_complete": true
}
```

**Key Points:**
- Stored in `conversation_users` table
- Uses `metadata` JSONB column
- All configured fields are stored at the root level
- `onboarding_complete: true` flag indicates completion
- Linked via normalized phone number

#### Group Chat Storage (`chats.metadata` JSONB field):
```json
{
  "group_info": {
    "harshness": "Very tough drill sergeant vibes. A1Base is terrible at following up with tasks so YOU NEED TO BE HARSH",
    "group_purpose": "Help manage a1base do great content with great business-winning reach",
    "onboarding_completed_at": "2025-05-27T05:33:41.884Z"
  },
  "onboarding": {
    "completed": true,
    "in_progress": false,
    "fields_pending": [],
    "completion_time": "2025-05-27T05:33:41.884Z",
    "fields_collected": {
      "harshness": "Very tough drill sergeant vibes. A1Base is terrible at following up with tasks so YOU NEED TO BE HARSH",
      "group_purpose": "Help manage a1base do great content with great business-winning reach"
    },
    "field_definitions": {
      "harshness": {
        "id": "harshness",
        "label": "harshness",
        "required": true,
        "description": "The AI should ask how harsh and rude the AI should be in managing these projects"
      },
      "group_purpose": {
        "id": "group_purpose",
        "label": "Group Purpose",
        "required": true,
        "description": "Ask what the main purpose/goal of this group chat is"
      }
    }
  },
  "a1_account_id": "2928f8b1-0a7a-4a94-882f-f255cbfab752"
}
```

**Key Points:**
- Stored in `chats` table
- Uses `metadata` JSONB column
- Nested structure with `group_info` and `onboarding` objects
- Tracks completion state and progress
- Stores field definitions for reference
- Linked via thread_id

### Phase 6: Context Enhancement

After onboarding completion, the collected data is:
1. **Loaded on Each Conversation**: Retrieved from database metadata
2. **Injected into System Prompt**: Added as context for AI responses
3. **Used for Personalization**: Influences how AI interacts with user/group

#### Implementation Details:

The system automatically loads onboarding data in `generateAgentResponse` (lib/services/openai.ts):

```typescript
// For Individual Users
if (threadType === "individual") {
  const userPhoneNumber = threadMessages.find(
    (msg) => msg.sender_number !== process.env.A1BASE_AGENT_NUMBER
  )?.sender_number;
  if (userPhoneNumber) {
    const adapter = await supabaseAdapter;
    if (adapter) {
      onboardingData = await adapter.getUserOnboardingData(userPhoneNumber);
    }
  }
}

// For Group Chats
if (threadType === "group" && service && threadMessages.length > 0 && threadMessages[0].thread_id) {
  const adapter = await supabaseAdapter;
  if (adapter) {
    onboardingData = await adapter.getChatOnboardingData(
      threadMessages[0].thread_id,
      service
    );
  }
}

// Inject into System Prompt
if (onboardingData && Object.keys(onboardingData).length > 0) {
  const onboardingContext = `\n\n--- Onboarding Data Context ---\n${JSON.stringify(
    onboardingData,
    null,
    2
  )}\n--- End Onboarding Data Context ---`;
  enhancedSystemPrompt += onboardingContext;
}
```

#### Example Injected Context:

For Individual User:
```
--- Onboarding Data Context ---
{
  "name": "Pasha Rayan",
  "email": "pasha@a1base.com",
  "big_dream": "A1Base to become the critical communication and trust infrastructure between AI agents and humans",
  "onboarding_complete": true
}
--- End Onboarding Data Context ---
```

For Group Chat:
```
--- Onboarding Data Context ---
{
  "group_purpose": "Help manage a1base do great content with great business-winning reach",
  "harshness": "Very tough drill sergeant vibes. A1Base is terrible at following up with tasks so YOU NEED TO BE HARSH"
}
--- End Onboarding Data Context ---
```

#### Personality and System Prompt After Onboarding

Once onboarding is complete, the system returns to using the full agent profile settings from:
- **Agent Profile**: Configured in `/profile-editor/agent-profile`
- **Base Information**: Configured in `/profile-editor/base-information`
- **Safety Settings**: Configured in `/profile-editor/safety-settings`

The full system prompt includes:
```
<YOUR PROFILE>
[AGENT PROFILE]
Name: Amy
Company: A1Base
Purpose: My purpose is to help developers understand...
Language: English (American)
Tone: You are friendly and approachable...
[/AGENT PROFILE]

<AGENT BASE INFORMATION>
[Base company/product information]
</AGENT BASE INFORMATION>

<SAFETY>
[Safety guidelines if enabled]
</SAFETY>

--- Onboarding Data Context ---
{
  "name": "Pasha Rayan",
  "email": "pasha@a1base.com",
  "big_dream": "..."
}
--- End Onboarding Data Context ---
```

This ensures the bot maintains its full personality and capabilities while also having access to the collected onboarding data for personalization.

## Expected Behavior

### First Message Experience

#### Scenario 1: New Individual User
```
User: "i want a1base to win!"
Bot: "That's the spirit! We're here to help make that happen. To start, could you please share your full name with us?"
User: "Pasha Rayan"
Bot: "Nice to meet you, Pasha Rayan! Could you please share your email address?"
User: "pasha@a1base.com"
Bot: "Thanks! Now, what's your biggest dream for your project or startup?"
User: "A1Base to become the critical communication infrastructure"
Bot: "Thank you for sharing this information. I've saved your details and I'm ready to help you achieve your goals. What would you like assistance with today?"
```

#### Scenario 2: Returning User (Onboarding Complete)
```
User: "Hey, I need help with my project"
Bot: "Hi Pasha! I'd be happy to help with your project. What specific aspect would you like to work on?"
```

#### Scenario 3: Group Chat Onboarding
```
Bot: "Hello everyone! I'm Felicie - your AI assistant for founder mode. We're going to make it. Let's go:"
Member: "Hey Felicie!"
Bot: "Great to be here! To help you all effectively, could you tell me what the main purpose or goal of this group chat is?"
Member: "Help manage a1base do great content with great business-winning reach"
Bot: "Excellent! Now, I need to know - how tough should I be in managing these projects? How harsh and direct should my follow-ups be?"
Member: "Very tough drill sergeant vibes. A1Base is terrible at following up"
Bot: "I've got everything I need to start working with you! Start by telling me what first project you want me to start tracking:"
```

## Key Implementation Details

### 1. State Management
- **In-Memory**: Track current onboarding progress during conversation
- **Database**: Persist completed fields and onboarding status
- **Thread Safety**: Handle concurrent messages appropriately

### 2. Field Extraction Logic
- Currently uses pattern matching for known fields
- Should be enhanced to use AI for dynamic field extraction
- Must handle variations in user responses

### 3. Error Handling
- **Missing Configuration**: Default to basic onboarding
- **Database Errors**: Fall back to in-memory storage
- **Invalid Responses**: Re-ask questions politely

### 4. Context Injection
The system automatically injects onboarding data into every conversation after completion.
See Phase 6 above for implementation details.

## Testing Scenarios

### 1. First Message Test
- Verify onboarding triggers on first contact
- Confirm context acknowledgment before first question
- Validate field-by-field collection

### 2. Interruption Handling
- User provides multiple fields at once
- User asks unrelated questions during onboarding
- User provides invalid data

### 3. Completion Verification
- All fields stored correctly in metadata
- Onboarding marked as complete
- Context properly loaded in subsequent conversations

### 4. Edge Cases
- Onboarding disabled mid-conversation
- Configuration changes during active onboarding
- Multiple concurrent messages
- Database connection issues

## Future Enhancements

### 1. Dynamic Field Extraction
Replace hardcoded field detection with AI-powered extraction that works with any configured fields.

### 2. Combined Personality During Onboarding
Enhance the system to combine base agent profile settings with onboarding-specific instructions, ensuring consistent personality throughout the user journey. This would involve:
- Loading base agent profile during onboarding
- Merging personality traits with onboarding instructions
- Maintaining tone consistency while collecting information

### 3. Multi-Language Support
Allow onboarding in different languages based on user preference.

### 4. Progressive Disclosure
Collect basic info first, then additional details over time based on interaction patterns.

### 5. Analytics Integration
Track onboarding completion rates, drop-off points, and user satisfaction.

## Troubleshooting Guide

### Common Issues:

1. **Onboarding Not Triggering**
   - Check if enabled in configuration
   - Verify no existing user metadata
   - Confirm thread detection logic

2. **Fields Not Progressing**
   - Verify field extraction logic
   - Check conversation history parsing
   - Validate state management

3. **Context Not Applied**
   - Confirm metadata storage
   - Verify context loading on conversation start
   - Check prompt enhancement logic

4. **Group vs Individual Confusion**
   - Ensure thread_type detection
   - Verify correct configuration loading
   - Check storage location (users vs chats)

## Summary

The A1 Framework onboarding system is a sophisticated, configuration-driven solution that:

1. **Adapts Dynamically**: Reads configuration files to determine what information to collect
2. **Maintains Context**: Tracks conversation state and collected fields across messages
3. **Stores Persistently**: Saves onboarding data in appropriate database tables
4. **Enhances Experience**: Automatically injects collected data into future conversations
5. **Handles Edge Cases**: Gracefully manages errors, interruptions, and configuration changes

The system ensures new users have a smooth, personalized onboarding experience while collecting essential information that enhances all future interactions.
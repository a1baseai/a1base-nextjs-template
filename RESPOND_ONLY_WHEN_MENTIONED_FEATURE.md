# Respond Only When Mentioned Feature (Group Chats)

## Overview

This feature allows users to configure their AI agent to respond only to WhatsApp **group messages** where the agent is explicitly mentioned, rather than responding to all group messages automatically. This is particularly useful in group chats where you want more control over when the agent engages in the conversation.

**Important:** This setting only affects group chats. Individual chats always receive responses since they are 1-on-1 conversations where mentioning doesn't apply.

**Architecture:** This feature is now integrated into the main agent profile system, making it part of the agent's core configuration alongside other settings like name, role, and personality traits.

## Implementation Details

### 1. Files Created/Modified

#### `lib/agent-profile/types.ts`
- **Added**: `GroupChatPreferences` interface
- **Modified**: Extended `AgentProfileSettings` to include `groupChatPreferences`
- **Purpose**: Type safety for group chat preferences as part of the agent profile

#### `lib/agent-profile/agent-profile-settings.ts`
- **Modified**: Added default `groupChatPreferences` to `defaultAgentProfileSettings`
- **Purpose**: Provides default value (`respond_only_when_mentioned: false`) for new agent profiles

#### `app/profile-editor/group-chat-settings/page.tsx`
- **Completely Rewritten**: Now uses agent profile system instead of Supabase user preferences
- **Features**: 
  - Loads settings from agent profile via `getAgentProfileSettings()`
  - Saves settings via `saveProfileSettings()` to the profile JSON file
  - Integrates with ProfileEditorLayout's unified save system
  - Displays agent name in the UI for better context
  - No longer requires phone number configuration

#### `lib/ai-triage/handle-whatsapp-incoming.ts`
- **Modified**: Replaced user-based preference checking with agent profile-based checking
- **Changes**: Uses `getAgentProfileSettings()` to check `groupChatPreferences.respond_only_when_mentioned`
- **Scope**: Still only applies to group chats (`thread_type === 'group'`)

#### `data/profile-settings.json`
- **Added**: `groupChatPreferences` section with default value
- **Purpose**: Persists the group chat preferences as part of the agent's profile

### 2. Removed Dependencies

- **Removed**: `app/api/settings/user-preferences/route.ts` is no longer used for group chat preferences
- **Removed**: Dependency on Supabase user metadata for this feature
- **Removed**: Phone number requirements for group chat settings

## How It Works

### 1. User Configuration
1. User navigates to the **Profile Editor** section.
2. In the sidebar, click on **"Group Chat Settings"**.
3. Toggle the "Respond Only When Mentioned (Group Chats)" setting.
4. Click "Save Group Chat Settings" or use the unified "Save Changes" button in the layout.
5. Setting is saved to `data/profile-settings.json` as part of the complete agent profile.

### 2. Message Processing Flow
1. Webhook receives message with `agent_mentioned` field
2. **If it's an individual chat:** Normal processing continues regardless of setting
3. **If it's a group chat:** System checks agent profile's `groupChatPreferences.respond_only_when_mentioned`
   - If enabled and `agent_mentioned` is false, message is stored but not processed
   - If enabled and `agent_mentioned` is true, normal processing continues
   - If disabled, normal processing continues

### 3. Mention Detection
- Handled by A1Base platform
- Detects patterns like "@agent", "hey agent", etc.
- Passed as `agent_mentioned: boolean` in webhook payload
- Only relevant for group chat processing

## Usage Examples

### Agent Profile Configuration
```json
{
  "name": "Felicie",
  "role": "A1 Founder Mode Assistant",
  "groupChatPreferences": {
    "respond_only_when_mentioned": false
  }
  // ... other agent settings
}
```

### Message Processing Examples
```typescript
// Individual chat - always processes regardless of setting
{
  "thread_type": "individual",
  "agent_mentioned": false,
  "message_content": { "text": "hello" }
}
// Result: Message processed normally (setting doesn't apply)

// Group chat with mention (setting enabled)
{
  "thread_type": "group",
  "agent_mentioned": true,
  "message_content": { "text": "@agent help me with this" }
}
// Result: Message processed normally

// Group chat without mention (setting enabled)
{
  "thread_type": "group", 
  "agent_mentioned": false,
  "message_content": { "text": "just a regular group message" }
}
// Result: Message stored but not processed
```

## API Reference

### Agent Profile System
The group chat preferences are now managed through the existing agent profile API endpoints:

### GET /api/profile-settings
Retrieve the complete agent profile including group chat preferences.

**Response:**
```json
{
  "settings": {
    "name": "Felicie",
    "role": "A1 Founder Mode Assistant",
    "groupChatPreferences": {
      "respond_only_when_mentioned": false
    }
    // ... other agent settings
  }
}
```

### POST /api/profile-settings
Update the complete agent profile including group chat preferences.

**Body:**
```json
{
  "settings": {
    "name": "Felicie",
    "role": "A1 Founder Mode Assistant",
    "groupChatPreferences": {
      "respond_only_when_mentioned": true
    }
    // ... other agent settings
  }
}
```

## Configuration

### File Storage
Agent profiles with group chat preferences are stored in:
- **File Path**: `data/profile-settings.json`
- **Format**: JSON file containing the complete `AgentProfileSettings` object
- **Persistence**: File-based storage that survives deployments and restarts

### Fallback System
The agent profile system supports multiple configuration sources:
1. **Server-side file storage** (primary): `data/profile-settings.json`
2. **Browser localStorage** (fallback)
3. **Environment variable**: `AGENT_PROFILE_SETTINGS`
4. **Default settings**: Hardcoded in `lib/agent-profile/agent-profile-settings.ts`

## Error Handling

### Profile Loading Errors
- Graceful fallback to default settings if profile file is corrupted
- User-friendly error messages in the UI
- Console logging for debugging

### Save Errors
- Toast notifications for success/error states
- Retry mechanism available through UI
- No data loss if save fails

## Security Considerations

1. **File-based Storage**: Settings are stored in server-side files, not exposed to client
2. **Type Safety**: Full TypeScript support prevents configuration errors
3. **Validation**: Settings are validated against TypeScript interfaces
4. **Error Isolation**: Profile loading errors don't affect other agent functionality

## Testing

### Manual Testing
1. Navigate to `/profile-editor/group-chat-settings`
2. Toggle the "Respond Only When Mentioned (Group Chats)" setting
3. Save settings using either the local save button or the unified layout save
4. **Test in group chats:** Send WhatsApp messages with and without mentions
5. **Verify group behavior:** Agent responds only when mentioned (if setting is enabled)
6. **Test in individual chats:** Verify agent always responds regardless of setting
7. **Check persistence:** Restart the dev server and verify settings are maintained

### Profile Integration Testing
1. Verify the setting appears correctly in the profile editor UI
2. Check that the unified save system works across all profile pages
3. Ensure the agent name is displayed correctly in the group chat settings
4. Confirm that profile loading fallbacks work if the file is missing

## Architectural Benefits

### Centralized Configuration
- All agent settings, including group chat preferences, are in one place
- Consistent with the "Profile Editor" concept
- Version-controllable agent configurations

### Type Safety
- Full TypeScript support for all settings
- Compile-time validation of configuration changes
- IDE autocomplete and error detection

### Unified Save Experience
- Group chat settings integrate with the profile editor's save system
- Consistent user experience across all agent configuration pages
- Atomic saves ensure configuration consistency

## Future Enhancements

1. **Per-Group Settings**: Different mention preferences for different groups
2. **Custom Mention Patterns**: User-defined mention triggers beyond default detection
3. **Time-based Rules**: Different behavior based on time of day
4. **Advanced Group Behaviors**: More sophisticated group chat interaction rules
5. **Import/Export**: Backup and restore complete agent profiles

## Troubleshooting

### Common Issues

1. **Setting not persisting**: Check if `data/profile-settings.json` is writable
2. **Agent still responding in groups**: Verify `agent_mentioned` field in webhook logs
3. **UI not loading**: Check browser console for profile loading errors
4. **Changes not taking effect**: Ensure you're saving the settings and the profile system is loading the file

### Debug Logs
Look for these log patterns:
- `[MENTION_CHECK]`: Agent preference checking (only for group chats)
- `[PROFILE-API]`: Profile loading and saving operations
- `[SupabaseConfig]`: Database configuration (no longer needed for this feature)

## Compatibility

- **Next.js**: 14+
- **TypeScript**: 5+
- **A1Framework**: Current version
- **A1Base**: Requires webhook support for `agent_mentioned` field
- **File System**: Requires write access to `data/` directory
- **Browsers**: Modern browsers with ES2020+ support
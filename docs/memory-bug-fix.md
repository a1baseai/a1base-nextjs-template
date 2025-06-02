# Group Chat Memory Bug Fix

## Issue Description

When sending messages in group chats, the system was encountering the following error:

```
[SupabaseAdapter] Error fetching chat for memory update e28cb176-0c79-46ba-b7d5-019b06766cd1: {
  code: 'PGRST116',
  details: 'The result contains 25 rows',
  hint: null,
  message: 'JSON object requested, multiple (or no) rows returned'
}
```

This error was preventing the chat memory feature from working properly, causing the system to respond with a generic error message.

## Root Causes

### 1. Data Integrity Issue
- Multiple chat records in the database have the same `external_id`
- The `external_id` field should be unique but currently has duplicates
- In your case, there are 25 chat records with the same external_id

### 2. Code Issue
- The memory processor was passing the `thread_id` (which is the external_id) instead of the internal chat ID
- The `upsertChatThreadMemoryValue` method was expecting the internal chat ID but was using `external_id` to query

## Applied Fixes

### Code Changes

1. **Updated `upsertChatThreadMemoryValue` method** (`lib/supabase/adapter.ts`):
   - Now detects if the provided chatId is a UUID (likely an external_id)
   - If it's a UUID, it looks up the internal chat ID first
   - Uses `maybeSingle()` instead of `single()` to handle multiple rows gracefully
   - All subsequent operations use the internal ID

2. **Updated `getAllChatMemoryValues` method** (`lib/supabase/adapter.ts`):
   - Added the same UUID detection and internal ID lookup logic
   - Ensures consistency across all memory operations

3. **Updated `getChatFromWebhook` method** (`lib/supabase/adapter.ts`):
   - Changed from `single()` to `maybeSingle()` to prevent errors when duplicates exist
   - This prevents new duplicates from being created due to query failures

## Database Cleanup Required

To fully resolve the issue, you need to clean up the duplicate `external_id` values in your database.

### Option 1: Run the SQL Script

Execute the queries in `scripts/fix-duplicate-external-ids.sql`:

1. First, identify which external_ids have duplicates
2. Review the duplicate records to decide which to keep (usually the one with the most messages/participants)
3. Update the external_ids of duplicate records to make them unique
4. Add a unique constraint to prevent future duplicates

### Option 2: Manual Cleanup

If you prefer a more controlled approach:

```sql
-- Find duplicates
SELECT external_id, COUNT(*) 
FROM chats 
GROUP BY external_id 
HAVING COUNT(*) > 1;

-- For each duplicate, keep the oldest one and rename others
UPDATE chats 
SET external_id = external_id || '-dup-1' 
WHERE id = 'specific-chat-id-to-update';
```

## Prevention

After cleaning up the duplicates, add a unique constraint:

```sql
ALTER TABLE chats ADD CONSTRAINT unique_external_id UNIQUE (external_id);
```

This will prevent the same issue from occurring in the future.

## Testing

After applying the fixes:

1. Try sending a message in a group chat
2. Check the logs - you should no longer see the PGRST116 error
3. The chat memory features should work as expected
4. Messages should be processed normally without the generic error response 
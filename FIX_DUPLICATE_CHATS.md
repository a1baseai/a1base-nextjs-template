# Fix for Duplicate Group Chats Issue

## Problem Summary
Every message in a group chat was creating a new `chats` entry in the database due to:
1. A race condition in the message processing
2. Improper error handling when checking for existing chats
3. Missing unique constraint on the `external_id` column

This resulted in 47-48 duplicate chat entries for a single WhatsApp group thread.

## Root Cause
The issue occurred in two places:

### 1. `processWebhookPayload` method
- Used `.single()` which throws an error when multiple rows exist
- The error wasn't properly handled, causing the logic to proceed to create another duplicate

### 2. Race Condition
- Multiple messages arriving simultaneously would each check if a chat exists
- Before the first one could create the chat, others would also find no chat and try to create one
- Without a unique constraint, all insertions would succeed

## Solution Implemented

### Code Changes

#### 1. Fixed `processWebhookPayload` in `lib/supabase/adapter.ts`
- Changed `.single()` to `.maybeSingle()` to handle duplicates gracefully
- Added proper error handling
- Use existing chat ID if found instead of always calling `getChatFromWebhook`

#### 2. Enhanced `getChatFromWebhook` in `lib/supabase/adapter.ts`
- Added handling for duplicate key errors (PostgreSQL error code 23505)
- When a concurrent insert is detected, the method now fetches the existing chat instead of failing

### Database Changes

#### 1. Clean Up Existing Duplicates
The migration script (`fix-duplicate-chats.sql`) will:
- Identify all duplicate chats with the same `external_id`
- Keep the oldest chat (preserving history)
- Migrate all messages, participants, and projects to the kept chat
- Delete the duplicate chats

#### 2. Add Unique Constraint
- Adds a unique constraint on the `external_id` column
- This prevents future duplicates at the database level

## How to Apply the Fix

### Step 1: Deploy Code Changes
The code changes in `lib/supabase/adapter.ts` should be deployed first. These changes will prevent new duplicates from being created.

### Step 2: Run Database Migration
1. Go to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `fix-duplicate-chats.sql`
4. Run the migration

**⚠️ Important**: This migration will modify your data. It's recommended to:
- Create a backup first
- Run during a maintenance window
- Test in a staging environment if available

### Step 3: Verify the Fix
After running the migration, the script will output:
- Total number of chats
- Number of chats with external_id
- Number of unique external_ids

The last two numbers should be equal, confirming no duplicates remain.

## Testing the Fix

### Manual Testing
1. Send multiple messages rapidly to a group chat
2. Check the database to ensure only one chat entry exists for the group
3. Verify all messages are properly associated with the single chat

### Query to Monitor
```sql
-- Check for any duplicate external_ids
SELECT external_id, COUNT(*) as count
FROM public.chats
WHERE external_id IS NOT NULL
GROUP BY external_id
HAVING COUNT(*) > 1;
```

This query should return no results after the fix is applied.

## Prevention
The combination of:
1. Unique constraint at the database level
2. Proper duplicate handling in the code
3. Race condition mitigation

Will prevent this issue from recurring in the future.

## Rollback Plan
If issues arise:
1. The code changes are backward compatible and don't need rollback
2. For the database constraint, you can remove it with:
   ```sql
   ALTER TABLE public.chats DROP CONSTRAINT chats_external_id_unique;
   ```

However, this would allow the duplicate issue to return, so it's not recommended unless absolutely necessary. 
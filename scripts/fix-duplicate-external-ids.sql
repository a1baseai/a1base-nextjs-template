-- Script to identify and fix duplicate external_id values in the chats table

-- 1. First, let's identify which external_ids have duplicates
SELECT 
    external_id,
    COUNT(*) as duplicate_count,
    MIN(created_at) as earliest_created,
    MAX(created_at) as latest_created
FROM chats
WHERE external_id IS NOT NULL
GROUP BY external_id
HAVING COUNT(*) > 1
ORDER BY duplicate_count DESC;

-- 2. View all duplicate records with their details
-- This will help you decide which ones to keep
SELECT 
    c.id,
    c.external_id,
    c.created_at,
    c.type,
    c.name,
    c.service,
    c.metadata,
    (SELECT COUNT(*) FROM messages m WHERE m.chat_id = c.id) as message_count,
    (SELECT COUNT(*) FROM chat_participants cp WHERE cp.chat_id = c.id) as participant_count,
    (SELECT COUNT(*) FROM projects p WHERE p.chat_id = c.id) as project_count
FROM chats c
WHERE c.external_id IN (
    SELECT external_id
    FROM chats
    WHERE external_id IS NOT NULL
    GROUP BY external_id
    HAVING COUNT(*) > 1
)
ORDER BY c.external_id, c.created_at;

-- 3. Strategy to fix duplicates:
-- Option A: Keep the oldest chat (with the most history) and update external_id for others
-- This query will generate UPDATE statements to make external_ids unique
WITH duplicate_chats AS (
    SELECT 
        id,
        external_id,
        ROW_NUMBER() OVER (PARTITION BY external_id ORDER BY created_at) as rn
    FROM chats
    WHERE external_id IS NOT NULL
)
SELECT 
    'UPDATE chats SET external_id = ''' || external_id || '-dup-' || (rn-1) || ''' WHERE id = ''' || id || ''';' as update_statement
FROM duplicate_chats
WHERE rn > 1;

-- 4. After fixing duplicates, add a unique constraint to prevent future duplicates
-- ALTER TABLE chats ADD CONSTRAINT unique_external_id UNIQUE (external_id);

-- Note: Before running any UPDATE statements, make sure to:
-- 1. Backup your database
-- 2. Review which chats have actual messages/participants/projects
-- 3. Consider merging data from duplicate chats if needed 
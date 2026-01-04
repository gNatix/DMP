-- Migration: Add unique constraint and clean up duplicates in deleted_items
-- Date: 2026-01-04
-- Run this AFTER create-deleted-items-table.sql if table already exists

-- First, remove duplicate entries (keep the newest one)
DELETE FROM deleted_items a
USING deleted_items b
WHERE a.deleted_at < b.deleted_at
  AND a.user_id = b.user_id
  AND a.original_id = b.original_id;

-- Add unique constraint if not already exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'deleted_items_user_id_original_id_key'
  ) THEN
    ALTER TABLE deleted_items 
    ADD CONSTRAINT deleted_items_user_id_original_id_key 
    UNIQUE (user_id, original_id);
  END IF;
END $$;

-- Verify duplicates are removed
SELECT user_id, original_id, COUNT(*) as count
FROM deleted_items
GROUP BY user_id, original_id
HAVING COUNT(*) > 1;

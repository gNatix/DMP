-- Migration: Create deleted_items table (trash/recycle bin)
-- Date: 2026-01-04
-- Description: Stores deleted scenes and collections for potential recovery

-- Create deleted_items table
CREATE TABLE IF NOT EXISTS deleted_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('scene', 'collection')),
  original_id text NOT NULL,
  name text NOT NULL,
  data jsonb NOT NULL,
  deleted_at timestamptz DEFAULT now() NOT NULL,
  
  -- Optional: auto-delete after 30 days
  expires_at timestamptz DEFAULT (now() + interval '30 days'),
  
  -- Prevent duplicate entries for the same item
  UNIQUE(user_id, original_id)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_deleted_items_user_id ON deleted_items(user_id);
CREATE INDEX IF NOT EXISTS idx_deleted_items_type ON deleted_items(item_type);
CREATE INDEX IF NOT EXISTS idx_deleted_items_deleted_at ON deleted_items(deleted_at);

-- Enable Row Level Security
ALTER TABLE deleted_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own deleted items
CREATE POLICY "Users can view own deleted items"
  ON deleted_items FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own deleted items"
  ON deleted_items FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own deleted items"
  ON deleted_items FOR DELETE
  USING (auth.uid() = user_id);

-- Add comment to table
COMMENT ON TABLE deleted_items IS 'Trash/recycle bin for deleted scenes and collections. Items auto-expire after 30 days.';
COMMENT ON COLUMN deleted_items.item_type IS 'Type of deleted item: scene or collection';
COMMENT ON COLUMN deleted_items.original_id IS 'Original ID of the item before deletion';
COMMENT ON COLUMN deleted_items.data IS 'Full JSON backup of the deleted item';
COMMENT ON COLUMN deleted_items.expires_at IS 'When this item will be permanently deleted (30 days after deletion)';

-- Verify table was created
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'deleted_items'
ORDER BY ordinal_position;

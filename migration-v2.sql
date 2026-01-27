-- Migration: Add position column to playlists table
-- Run this in Neon SQL Editor if you haven't already

-- Add position column to playlists if it doesn't exist
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- Update existing playlists to have sequential positions
WITH numbered AS (
  SELECT id, room_id, ROW_NUMBER() OVER (PARTITION BY room_id ORDER BY created_at) - 1 as new_pos
  FROM playlists
)
UPDATE playlists p
SET position = n.new_pos
FROM numbered n
WHERE p.id = n.id;

-- Verify the sync columns exist on rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_title TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_playlist_id UUID;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Verify room_visitors table exists
CREATE TABLE IF NOT EXISTS room_visitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  guest_id VARCHAR(100),
  display_name VARCHAR(100) NOT NULL,
  color VARCHAR(20),
  status VARCHAR(20) DEFAULT 'online',
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create unique indexes if they don't exist
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_visitors_user ON room_visitors(room_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_room_visitors_guest ON room_visitors(room_id, guest_id) WHERE guest_id IS NOT NULL;

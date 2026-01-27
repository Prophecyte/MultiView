-- =============================================
-- MULTIVIEW SYNC MIGRATION
-- Run this in your Neon SQL Editor
-- =============================================

-- 1. Add sync columns to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_title TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_playlist_id UUID;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_state VARCHAR(20) DEFAULT 'paused';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_time FLOAT DEFAULT 0;

-- 2. Add position column to playlists
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS position INTEGER DEFAULT 0;

-- 3. Ensure room_visitors table exists for presence
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

-- 4. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_room_visitors_room ON room_visitors(room_id);
CREATE INDEX IF NOT EXISTS idx_room_visitors_last_seen ON room_visitors(last_seen);

-- Create unique indexes for upsert operations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_room_visitors_user') THEN
    CREATE UNIQUE INDEX idx_room_visitors_user ON room_visitors(room_id, user_id) WHERE user_id IS NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'idx_room_visitors_guest') THEN
    CREATE UNIQUE INDEX idx_room_visitors_guest ON room_visitors(room_id, guest_id) WHERE guest_id IS NOT NULL;
  END IF;
END $$;

-- 5. Verify the columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'rooms' 
AND column_name IN ('current_video_url', 'current_video_title', 'playback_state', 'playback_time', 'playback_updated_at');

-- You should see 5 rows if successful

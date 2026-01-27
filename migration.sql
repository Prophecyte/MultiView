-- Migration: Add real-time sync support
-- Run this in your Neon database console

-- Add playback state columns to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_url TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_video_title TEXT;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS current_playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create room_visitors table if it doesn't exist (unified presence/members)
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

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_room_visitors_room ON room_visitors(room_id);
CREATE INDEX IF NOT EXISTS idx_room_visitors_last_seen ON room_visitors(last_seen);

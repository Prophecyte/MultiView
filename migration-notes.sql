-- Migration: Add video notes feature
-- Run this migration if you're upgrading from an older version

-- Add notes column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add tracking for who last edited the notes
ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes_updated_by VARCHAR(255);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMP WITH TIME ZONE;

-- Add per-video notes visibility (owner can hide notes for specific videos)
ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes_hidden BOOLEAN DEFAULT false;

-- Note: If you had the old room-level hide_notes, you can remove it:
-- ALTER TABLE rooms DROP COLUMN IF EXISTS hide_notes;

-- ============================================
-- Migration: Add file upload support
-- ============================================

-- Drop old table if exists (structure changed)
DROP TABLE IF EXISTS uploaded_files;

-- Table for storing uploaded audio/video files directly in database
-- Note: Files are stored as base64 encoded text
-- Maximum recommended file size: 25MB
CREATE TABLE IF NOT EXISTS uploaded_files (
  id VARCHAR(100) PRIMARY KEY, -- Format: timestamp_randomstring
  room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
  filename VARCHAR(255) NOT NULL,
  content_type VARCHAR(100) NOT NULL,
  category VARCHAR(20) NOT NULL, -- 'audio' or 'video'
  data TEXT NOT NULL, -- Base64 encoded file data
  size INTEGER NOT NULL, -- File size in bytes (before encoding)
  uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for faster room-based lookups
CREATE INDEX IF NOT EXISTS idx_uploaded_files_room ON uploaded_files(room_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_created ON uploaded_files(created_at);

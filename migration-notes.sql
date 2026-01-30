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

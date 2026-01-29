-- Migration: Add video notes feature
-- Run this migration to add notes support

-- Add notes column to videos table
ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes TEXT;

-- Add tracking for who last edited the notes
ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes_updated_by VARCHAR(255);
ALTER TABLE videos ADD COLUMN IF NOT EXISTS notes_updated_at TIMESTAMP WITH TIME ZONE;

-- Add hide_notes setting to rooms table (owner can hide notes from guests/viewers)
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS hide_notes BOOLEAN DEFAULT false;

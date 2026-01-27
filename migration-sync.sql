-- Add playback state columns to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_state VARCHAR(20) DEFAULT 'paused';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_time FLOAT DEFAULT 0;

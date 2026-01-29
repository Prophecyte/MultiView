-- Add playback state columns to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_state VARCHAR(20) DEFAULT 'paused';
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS playback_time FLOAT DEFAULT 0;

-- Add playback options columns to rooms table
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS autoplay BOOLEAN DEFAULT true;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS shuffle BOOLEAN DEFAULT false;
ALTER TABLE rooms ADD COLUMN IF NOT EXISTS loop_mode BOOLEAN DEFAULT false;

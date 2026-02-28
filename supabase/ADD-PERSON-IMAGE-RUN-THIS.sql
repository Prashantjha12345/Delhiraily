-- Run in Supabase SQL Editor
-- Har person ke saath unki photo store karne ke liye

ALTER TABLE people
  ADD COLUMN IF NOT EXISTS image_url text;

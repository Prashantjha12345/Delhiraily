-- Add latitude and longitude (saved even when address fetch fails)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;

-- Add location fields to submissions (place name, city, state from Google Maps)
ALTER TABLE submissions
  ADD COLUMN IF NOT EXISTS location_place_name text,
  ADD COLUMN IF NOT EXISTS location_city text,
  ADD COLUMN IF NOT EXISTS location_state text;

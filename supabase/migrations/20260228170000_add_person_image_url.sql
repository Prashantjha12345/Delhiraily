-- Each person can have their photo (base64 data URL)
ALTER TABLE people
  ADD COLUMN IF NOT EXISTS image_url text;

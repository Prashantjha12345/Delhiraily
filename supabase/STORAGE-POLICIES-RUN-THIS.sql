-- Run this in Supabase Dashboard → SQL Editor
-- Fix: Images not uploading (bucket has 0 policies)

-- Allow upload (insert) to visitor-images bucket
CREATE POLICY "Allow insert visitor-images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'visitor-images');

-- Allow public read (display images in admin)
CREATE POLICY "Allow public read visitor-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'visitor-images');

-- Run this in Supabase Dashboard → SQL Editor
-- Fix: Images not uploading (bucket has 0 policies)
-- Safe to run multiple times (drops first if exists)

DROP POLICY IF EXISTS "Allow insert visitor-images" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read visitor-images" ON storage.objects;

CREATE POLICY "Allow insert visitor-images"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'visitor-images');

CREATE POLICY "Allow public read visitor-images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'visitor-images');

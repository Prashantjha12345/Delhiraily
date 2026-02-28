-- Storage policies for visitor-images bucket
-- Without these, image upload fails (anon role cannot insert)

-- Allow anyone to upload (insert) to visitor-images bucket
CREATE POLICY "Allow insert visitor-images"
ON storage.objects FOR INSERT
TO anon
WITH CHECK (bucket_id = 'visitor-images');

-- Allow public read (for displaying images in admin)
CREATE POLICY "Allow public read visitor-images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'visitor-images');

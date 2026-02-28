/*
  # Visitor Tracking System

  1. New Tables
    - `submissions`
      - `id` (uuid, primary key)
      - `name` (text) - Submitter name
      - `mobile_number` (text) - Submitter mobile number
      - `assembly_name` (text) - Selected assembly constituency
      - `total_people` (integer) - Total number of people
      - `vehicle_number` (text) - Vehicle number
      - `created_at` (timestamptz) - Submission timestamp
    
    - `people`
      - `id` (uuid, primary key)
      - `submission_id` (uuid, foreign key) - Links to submissions table
      - `name` (text) - Person name
      - `mobile_number` (text) - Person mobile number
      - `created_at` (timestamptz)
    
    - `images`
      - `id` (uuid, primary key)
      - `submission_id` (uuid, foreign key) - Links to submissions table
      - `image_type` (text) - Either 'vehicle' or 'person'
      - `image_url` (text) - URL to stored image
      - `created_at` (timestamptz)
  
  2. Security
    - Enable RLS on all tables
    - Add policies for public insert access (since no authentication required)
    - Add policies for public read access
*/

CREATE TABLE IF NOT EXISTS submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mobile_number text NOT NULL,
  assembly_name text NOT NULL,
  total_people integer NOT NULL DEFAULT 0,
  vehicle_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS people (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  name text NOT NULL,
  mobile_number text NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES submissions(id) ON DELETE CASCADE,
  image_type text NOT NULL CHECK (image_type IN ('vehicle', 'person')),
  image_url text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can insert submissions"
  ON submissions FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view submissions"
  ON submissions FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert people"
  ON people FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view people"
  ON people FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Anyone can insert images"
  ON images FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Anyone can view images"
  ON images FOR SELECT
  TO anon
  USING (true);
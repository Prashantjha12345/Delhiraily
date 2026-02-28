const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Content-Type': 'application/json',
};

function getSupabase() {
  const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key);
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: corsHeaders, body: '' };
  }
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const supabase = getSupabase();

    const { data: submissionsData, error: submissionsError } = await supabase
      .from('submissions')
      .select('*')
      .order('created_at', { ascending: false });

    if (submissionsError) throw submissionsError;

    const submissionsWithDetails = await Promise.all(
      (submissionsData || []).map(async (submission) => {
        const { data: people } = await supabase
          .from('people')
          .select('*')
          .eq('submission_id', submission.id);
        const { data: images } = await supabase
          .from('images')
          .select('*')
          .eq('submission_id', submission.id);
        return {
          ...submission,
          people: people || [],
          images: images || [],
        };
      })
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify(submissionsWithDetails),
    };
  } catch (err) {
    console.error('Submissions function error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Failed to fetch' }),
    };
  }
};

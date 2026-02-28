const { createClient } = require('@supabase/supabase-js');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
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
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const {
      name,
      mobile_number,
      assembly_name,
      total_people,
      vehicle_number,
      location_place_name,
      location_city,
      location_state,
      latitude,
      longitude,
      people = [],
      vehicleImageDataUrl,
    } = body;

    if (!name || !mobile_number || !assembly_name || total_people == null || !vehicle_number) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({ error: 'Missing required fields' }),
      };
    }

    const supabase = getSupabase();

    const { data: submission, error: submissionError } = await supabase
      .from('submissions')
      .insert({
        name,
        mobile_number,
        assembly_name,
        total_people: Number(total_people),
        vehicle_number,
        location_place_name: location_place_name || null,
        location_city: location_city || null,
        location_state: location_state || null,
        latitude: latitude != null ? Number(latitude) : null,
        longitude: longitude != null ? Number(longitude) : null,
      })
      .select()
      .single();

    if (submissionError) throw submissionError;

    if (people.length > 0) {
      const peopleRows = people.map((p) => ({
        submission_id: submission.id,
        name: p.name || '',
        mobile_number: p.mobile_number || p.mobile || '',
        image_url: p.imageDataUrl || null,
      }));
      const { error: peopleError } = await supabase.from('people').insert(peopleRows);
      if (peopleError) throw peopleError;
    }

    if (vehicleImageDataUrl) {
      await supabase.from('images').insert({
        submission_id: submission.id,
        image_type: 'vehicle',
        image_url: vehicleImageDataUrl,
      });
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, id: submission.id }),
    };
  } catch (err) {
    console.error('Submit function error:', err);
    const msg = err?.message || err?.error_description || err?.error || (err && String(err)) || 'Submission failed';
    const hint = err?.hint || err?.details || '';
    const fullMsg = hint ? `${msg} (${hint})` : msg;
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: fullMsg }),
    };
  }
};

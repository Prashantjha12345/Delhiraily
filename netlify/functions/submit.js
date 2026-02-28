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

async function uploadFromBase64(supabase, base64, submissionId, imageType, fileName) {
  const fileExt = fileName?.split('.').pop() || 'jpg';
  const path = `${submissionId}_${imageType}_${Date.now()}.${fileExt}`;
  const buf = Buffer.from(base64, 'base64');
  const { error } = await supabase.storage
    .from('visitor-images')
    .upload(path, buf, { contentType: `image/${fileExt}` });
  if (error) throw error;
  const { data: { publicUrl } } = supabase.storage.from('visitor-images').getPublicUrl(path);
  return publicUrl;
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
      people = [],
      vehicleImageBase64,
      vehicleImageName,
      personImages = [],
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
      })
      .select()
      .single();

    if (submissionError) throw submissionError;

    if (people.length > 0) {
      const peopleRows = people.map((p) => ({
        submission_id: submission.id,
        name: p.name,
        mobile_number: p.mobile,
      }));
      const { error: peopleError } = await supabase.from('people').insert(peopleRows);
      if (peopleError) throw peopleError;
    }

    if (vehicleImageBase64) {
      const vehicleUrl = await uploadFromBase64(
        supabase,
        vehicleImageBase64,
        submission.id,
        'vehicle',
        vehicleImageName || 'vehicle.jpg'
      );
      await supabase.from('images').insert({
        submission_id: submission.id,
        image_type: 'vehicle',
        image_url: vehicleUrl,
      });
    }

    for (const img of personImages) {
      if (img.base64) {
        const personUrl = await uploadFromBase64(
          supabase,
          img.base64,
          submission.id,
          'person',
          img.fileName || 'person.jpg'
        );
        await supabase.from('images').insert({
          submission_id: submission.id,
          image_type: 'person',
          image_url: personUrl,
        });
      }
    }

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({ success: true, id: submission.id }),
    };
  } catch (err) {
    console.error('Submit function error:', err);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: err.message || 'Submission failed' }),
    };
  }
};

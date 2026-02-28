/**
 * Proxy API - use Netlify functions so requests go via Netlify (works on Jio etc.)
 * when Supabase is blocked or slow on certain networks.
 */

function getBase() {
  if (typeof window === 'undefined') return '';
  return window.location.origin;
}

/** Returns true if proxy is available (for Jio / blocked networks) */
export async function isProxyAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${getBase()}/.netlify/functions/submissions`, { method: 'HEAD' });
    return res.ok || res.status === 405;
  } catch {
    return false;
  }
}

export async function submitViaProxy(payload: {
  name: string;
  mobile_number: string;
  assembly_name: string;
  total_people: number;
  vehicle_number: string;
  location_place_name?: string | null;
  location_city?: string | null;
  location_state?: string | null;
  people: Array<{ name: string; mobile: string }>;
  vehicleImageBase64?: string;
  vehicleImageName?: string;
  personImages: Array<{ base64: string; fileName: string }>;
}): Promise<{ success: boolean; id: string }> {
  const res = await fetch(`${getBase()}/.netlify/functions/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      people: payload.people.map((p) => ({ name: p.name, mobile_number: p.mobile })),
    }),
  });
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
  if (!res.ok) throw new Error(data.error || `Submit failed (${res.status})`);
  return data;
}

export async function fetchSubmissionsViaProxy(): Promise<unknown[]> {
  const res = await fetch(`${getBase()}/.netlify/functions/submissions`);
  const text = await res.text();
  const data = text ? (() => { try { return JSON.parse(text); } catch { return {}; } })() : {};
  if (!res.ok) throw new Error(data.error || `Fetch failed (${res.status})`);
  return Array.isArray(data) ? data : [];
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || result;
      resolve(base64);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

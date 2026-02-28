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
  latitude?: number | null;
  longitude?: number | null;
  people: Array<{ name: string; mobile: string; imageDataUrl?: string }>;
  vehicleImageDataUrl?: string;
}): Promise<{ success: boolean; id: string }> {
  const res = await fetch(`${getBase()}/.netlify/functions/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...payload,
      people: payload.people.map((p) => ({
        name: p.name,
        mobile_number: p.mobile,
        imageDataUrl: p.imageDataUrl,
      })),
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

const MAX_DATAURL_LENGTH = 280000;   // ~210KB vehicle
const MAX_DATAURL_LENGTH_PERSON = 160000; // ~120KB per person - smaller so vehicle+persons fit in one request

/** Compress image and return data URL. Use forPerson:true for person photos (smaller size). */
export function compressImageToDataUrl(
  file: File,
  maxWidth = 520,
  quality = 0.6,
  options?: { forPerson?: boolean }
): Promise<string> {
  const isPerson = options?.forPerson === true;
  const maxLen = isPerson ? MAX_DATAURL_LENGTH_PERSON : MAX_DATAURL_LENGTH;
  const w = isPerson ? 360 : maxWidth;
  const q = isPerson ? 0.5 : quality;

  return new Promise((resolve, reject) => {
    const img = new Image();
    const tryQuality = (qualityVal: number, width: number) => {
      const canvas = document.createElement('canvas');
      let { width: tw, height: th } = img;
      if (tw > width) {
        th = (th * width) / tw;
        tw = width;
      }
      canvas.width = tw;
      canvas.height = th;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, tw, th);
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Image compress failed'));
            return;
          }
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            if (dataUrl.length > maxLen && qualityVal > 0.35) {
              tryQuality(qualityVal - 0.15, Math.floor(width * 0.85));
            } else {
              resolve(dataUrl);
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        qualityVal
      );
    };
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      tryQuality(q, w);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Image load failed'));
    };
    img.src = URL.createObjectURL(file);
  });
}

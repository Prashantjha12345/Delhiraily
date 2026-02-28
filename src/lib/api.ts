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

const MAX_DATAURL_LENGTH = 280000; // ~210KB base64 to stay under limits

/** Compress image and return data URL - small size for DB, no bucket */
export function compressImageToDataUrl(file: File, maxWidth = 520, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const tryQuality = (q: number, w: number) => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > w) {
        height = (height * w) / width;
        width = w;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas not supported'));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            if (dataUrl.length > MAX_DATAURL_LENGTH && q > 0.35) {
              tryQuality(q - 0.15, Math.floor(w * 0.85));
            } else {
              resolve(dataUrl);
            }
          };
          reader.onerror = () => reject(reader.error);
          reader.readAsDataURL(blob);
        },
        'image/jpeg',
        q
      );
    };
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      tryQuality(quality, maxWidth);
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error('Image load failed'));
    };
    img.src = URL.createObjectURL(file);
  });
}

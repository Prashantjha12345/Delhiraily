# Submit nahi ho raha – kya check karein

## 1. Netlify Environment Variables

**Site → Site configuration → Environment variables** mein ye **zaroor** add karein:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://yxpgyysyhrequmcorcqy.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Apna Supabase anon key (Supabase Dashboard → Settings → API) |

**Important:** "Scopes" mein **Build** aur **Functions** dono select karein (ya "All" choose karein).

Save ke baad **Trigger deploy** karein (naya deploy chalao).

---

## 2. Netlify Functions deploy ho rahi hain?

**Deploys** → latest deploy → **Functions** tab check karein.

Agar "No functions detected" dikhe to:

- `netlify.toml` mein `functions = "netlify/functions"` hai ya nahi check karein
- Repo mein `netlify/functions/submit.js` aur `netlify/functions/submissions.js` dono files honi chahiye

---

## 3. Browser Console error

Submit pe click karte waqt:

1. **F12** ya **Right-click → Inspect** → **Console** tab
2. Koi **red error** dikhe to uska message note karein
3. Agar "Proxy failed" ya "404" dikhe to functions sahi se deploy nahi hui
4. Agar "Failed to fetch" / "NetworkError" dikhe to network / Jio block ho sakta hai

---

## 4. Network test

- **WiFi** par try karein – agar WiFi par chal jaye aur Jio par na chale to network-specific issue hai
- **Jio par** chalane ke liye Git deploy zaroori hai (manual dist upload se functions deploy nahi hoti)

---

## 5. Images ka size

Agar bahut badi images (5MB+) capture kar rahe hain to request fail ho sakti hai (Netlify limit ~6MB).

**Quick fix:** Kam resolution wali camera use karein ya kam images add karein.

---

## 6. Supabase Storage – images upload nahi ho rahe (images table empty)

**Problem:** Submissions table mein data aa raha hai lekin images table empty, bucket mein 0 policies.

**Fix:** Supabase Dashboard → **SQL Editor** → naya query → ye SQL chalao:

```sql
CREATE POLICY "Allow insert visitor-images"
ON storage.objects FOR INSERT TO anon
WITH CHECK (bucket_id = 'visitor-images');

CREATE POLICY "Allow public read visitor-images"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'visitor-images');
```

Save/Run karein. Iske baad image upload kaam karega.

(File: `supabase/STORAGE-POLICIES-RUN-THIS.sql`)

---

## Checklist

- [ ] Netlify env vars set (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Env vars ka scope "Functions" par bhi hai
- [ ] Deploy ke baad naya deploy trigger kiya
- [ ] Netlify Deploys → Functions tab mein functions dikh rahi hain
- [ ] Supabase mein `visitor-images` bucket bana hua hai
- [ ] Browser console mein exact error check kiya

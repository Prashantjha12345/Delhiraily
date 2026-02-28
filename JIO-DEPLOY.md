# Jio / slow network par form submit kaise chalayein

Jio (ya koi bhi network jahan Supabase block/slow hai) par submit tabhi kaam karega jab **request browser se direct Supabase ko nahi jayegi**, balki **Netlify server** se jayegi. Iske liye **Netlify Functions** deploy honi zaroori hain.

## Manual dist upload se Jio par nahi chalega

Agar aap sirf **dist** folder upload karte hain to Netlify par sirf static files jati hain. **Functions deploy nahi hoti**, isliye Jio par form submit fail ho sakta hai (direct Supabase block/timeout).

## Jio par chalane ka tarika (Git deploy)

1. **Code GitHub par push karo**  
   (ya GitLab / Bitbucket – Netlify in sabse connect ho sakta hai.)

2. **Netlify par site banao**
   - [app.netlify.com](https://app.netlify.com) → **Add new site** → **Import an existing project**
   - GitHub choose karo, repo select karo
   - **Build settings** ye rakho:
     - **Build command:** `npm run build`
     - **Publish directory:** `dist`
     - **Functions directory:** `netlify/functions` (ya Netlify auto-detect karega)

3. **Environment variables** (Site → Site configuration → Environment variables):
   - `VITE_SUPABASE_URL` = apna Supabase project URL
   - `VITE_SUPABASE_ANON_KEY` = apna Supabase anon key

4. **Deploy** run karo (trigger deploy / push karo).

Is setup ke baad:
- **Netlify Functions** (`submit`, `submissions`) bhi deploy ho jayengi.
- Production app pehle **proxy** try karega; proxy mili to **Jio par bhi submit/list kaam karega**.
- Agar kisi wajah se proxy na mile (purana deploy, etc.) to app **direct Supabase** use karega (fallback).

## Summary

| Deploy type        | Jio par submit      | Kaaran                    |
|--------------------|---------------------|---------------------------|
| Manual dist upload | ❌ Usually fail     | Functions deploy nahi hoti |
| Git deploy         | ✅ Work karta hai   | Proxy (functions) use hoti |

Database change ya Firebase ki zaroorat nahi – **same Supabase** use karo, bas deploy **Git se** karo taaki proxy functions live rahein.

/* ─── ClientChatLog — supabaseClient.js ──────────────────────
   Initializes the Supabase client. This key is the PUBLISHABLE
   key — it is safe to expose in client-side code as long as
   Row Level Security (RLS) policies are enabled on every table
   (which they are — see the SQL setup in the project notes).
   NEVER put the secret key here or anywhere in this app.
──────────────────────────────────────────────────────────────*/

const SUPABASE_URL = 'https://pcuoepbxpsiploeyqvte.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_qzaxcoAvtWGIbqsOlfw38A_BZ17kxf2';

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      detectSessionInUrl: true,  // parse #access_token=... from OAuth redirects
      persistSession: true,
      autoRefreshToken: true
    }
  }
);
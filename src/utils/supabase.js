import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const globalKey = "__supabase_singleton__";

if (!window[globalKey]) {
  window[globalKey] = createClient(supabaseUrl, supabaseKey, {
    auth: {
      // Mantém a sessão entre acessos ao navegador sem armazenar a senha.
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = window[globalKey];

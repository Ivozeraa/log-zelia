import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

const globalKey = "__supabase_singleton__";

if (!window[globalKey]) {
  window[globalKey] = createClient(supabaseUrl, supabaseKey);
}

export const supabase = window[globalKey];
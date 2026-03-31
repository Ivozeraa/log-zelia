import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

async function teste(){

  const { data } = await supabase.auth.getUser()

  console.log(data.user)

}

export const supabase = createClient(supabaseUrl, supabaseKey);


        
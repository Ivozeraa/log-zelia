import { supabase } from "../utils/supabase";

export async function getPerfil() {

  const { data: userData } = await supabase.auth.getUser()

  const { data, error } = await supabase
    .from("usuarios")
    .select("id, nome, role_id, escola_id")
    .eq("id", userData.user.id)
    .single()

  if (error) {
    throw error
  }

  return data
}
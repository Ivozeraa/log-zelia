import { supabase } from "../utils/supabase";

export async function studentEmailAction(action, payload = {}) {
  const { data, error } = await supabase.functions.invoke("student-email", {
    body: { action, ...payload },
  });
  if (error) {
    let detail = "";
    try { detail = (await error.context?.json())?.error || ""; } catch { /* connection error */ }
    throw new Error(detail || "Não foi possível acessar o serviço de e-mail. Tente novamente.");
  }
  if (data?.error) throw new Error(data.error);
  return data || {};
}

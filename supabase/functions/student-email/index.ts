import { createClient } from "npm:@supabase/supabase-js@2.99.1";
const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const resendKey = Deno.env.get("RESEND_API_KEY") || "";
// Configure this secret with a sender on a verified Resend domain.
const from = Deno.env.get("RESEND_FROM_EMAIL") || "";
const canSend = Boolean(resendKey && from && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(from) && !from.toLowerCase().endsWith("@resend.dev"));
const db = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Cache-Control": "no-store" };
const response = (body: object, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json; charset=utf-8" } });
const trimmed = (value: unknown, limit: number) => typeof value === "string" ? value.trim().slice(0, limit) : "";
const normalizedEmail = (value: unknown) => trimmed(value, 255).toLowerCase();
const validEmail = (email: string) => email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const maskEmail = (email: string) => {
  const [local, domain] = email.split("@");
  return local.slice(0, 2) + "*".repeat(Math.min(8, Math.max(2, local.length - 2))) + "@" + domain;
};
async function hmac(message: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(serviceKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(bytes), (v) => v.toString(16).padStart(2, "0")).join("");
}
const hashCode = (id: string, purpose: string, email: string, code: string) =>
  hmac("logview-student-email:v1:" + id + ":" + purpose + ":" + email + ":" + code);
async function gate(ip: string) {
  const key = await hmac("ip:" + ip);
  const { data, error } = await db.rpc("aluno_email_gate_internal", { p_chave_ip: key });
  if (error) throw error;
  return { allowed: data === true, key };
}
async function authStudent(matricula: string, password: string) {
  if (!matricula || !password || password.length > 512) return null;
  const { data, error } = await db.rpc("consultar_aluno_publico", { p_matricula: matricula, p_senha: password });
  if (error) throw error;
  return Array.isArray(data) ? data[0] || null : null;
}
async function getStudent(id: string) {
  const { data, error } = await db.from("alunos").select("id,email,email_verificado_em").eq("id", id).maybeSingle();
  if (error) throw error;
  return data;
}
async function issueCode(id: string, purpose: "confirmar" | "recuperar", email: string, ipKey: string) {
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
  const digest = await hashCode(id, purpose, email, code);
  const { data: codeId, error } = await db.rpc("aluno_email_emitir_internal", {
    p_aluno_id: id, p_finalidade: purpose, p_email: email,
    p_codigo_hash: digest, p_chave_ip: ipKey,
  });
  if (error) throw error;
  if (!codeId) return { sent: false, limited: true };
  let delivered = false;
  try {
    const text = purpose === "confirmar"
      ? "Seu código de confirmação do LogView: " + code + ". Válido por 10 minutos. Se não foi você, ignore."
      : "Seu código de recuperação de senha do LogView: " + code + ". Válido por 10 minutos. Nunca compartilhe.";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [email],
        subject: purpose === "confirmar" ? "LogView - confirme seu e-mail" : "LogView - recuperação de senha",
        text,
      }),
    });
    delivered = res.ok;
    if (!delivered) console.error("[student-email] Delivery rejected", res.status);
  } catch (err) {
    console.error("[student-email] Delivery failed", err instanceof Error ? err.name : "unknown");
  } finally {
    const { error: markError } = await db.rpc("aluno_email_marcar_envio_internal", { p_id: codeId, p_enviado: delivered });
    if (markError) { delivered = false; console.error("[student-email] Failed to finalize token state"); }
  }
  return { sent: delivered, limited: false };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "POST") return response({ error: "Método não permitido." }, 405);
  if (!url || !serviceKey) return response({ error: "Serviço indisponível." }, 503);
  if (Number(req.headers.get("content-length") || 0) > 4096) return response({ error: "Requisição inválida." }, 413);
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return response({ error: "Requisição inválida." }, 400);
    const action = body.action;
    if (!["status", "confirmar_solicitar", "confirmar_codigo", "recuperar_solicitar", "recuperar_codigo"].includes(action)) {
      return response({ error: "Operação desconhecida." }, 400);
    }
    const ip = (req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0] || "unknown").trim().slice(0, 120);
    const { allowed, key } = await gate(ip);
    if (!allowed) return response({ error: "Muitas tentativas. Tente novamente mais tarde." }, 429);
    const matricula = trimmed(body.matricula, 60);
    const email = normalizedEmail(body.email);
    const password = typeof body.senha === "string" ? body.senha : "";
    const code = trimmed(body.codigo, 20);
    const newPassword = typeof body.nova_senha === "string" ? body.nova_senha : "";
    if (!matricula) return response({ error: "Informe a matrícula." }, 400);

    if (["status", "confirmar_solicitar", "confirmar_codigo"].includes(action)) {
      const info = await authStudent(matricula, password);
      if (!info) return response({ error: "Credenciais inválidas. Entre novamente no portal." }, 401);
      const student = await getStudent(info.aluno_id);
      if (!student) return response({ error: "Conta indisponível." }, 404);
      if (action === "status") return response({
        email_mascarado: student.email && student.email_verificado_em ? maskEmail(student.email) : null,
        verificado: Boolean(student.email && student.email_verificado_em),
        envio_disponivel: canSend,
      });
      if (!validEmail(email)) return response({ error: "Informe um e-mail válido." }, 400);
      if (action === "confirmar_solicitar") {
        if (!canSend) return response({ error: "Envio de e-mails não configurado. Procure a coordenação." }, 503);
        if (student.email_verificado_em && student.email?.trim().toLowerCase() === email) {
          return response({ message: "Este e-mail já está confirmado." });
        }
        const created = await issueCode(student.id, "confirmar", email, key);
        if (created.limited) return response({ error: "Aguarde antes de solicitar outro código." }, 429);
        if (!created.sent) return response({ error: "Falha ao enviar código. Tente mais tarde." }, 503);
        return response({ message: "Código enviado. Confira a caixa de entrada e o spam." });
      }
      if (!/^\d{6}$/.test(code)) return response({ error: "Digite o código de seis números." }, 400);
      const digest = await hashCode(student.id, "confirmar", email, code);
      const { data: verified, error } = await db.rpc("aluno_email_concluir_internal", {
        p_aluno_id: student.id, p_finalidade: "confirmar", p_email: email, p_codigo_hash: digest,
      });
      if (error) throw error;
      if (!verified) return response({ error: "Código incorreto, expirado ou bloqueado." }, 400);
      return response({ message: "E-mail confirmado! Ele poderá ser usado para recuperar sua senha." });
    }

    if (!validEmail(email)) return response({ error: "Informe matrícula e e-mail válidos." }, 400);
    if (action === "recuperar_solicitar") {
      if (!canSend) return response({ error: "Recuperação por e-mail indisponível. Procure a coordenação." }, 503);
      const { data: student, error } = await db.from("alunos").select("id,email,email_verificado_em").eq("matricula", matricula).maybeSingle();
      if (error) throw error;
      if (student?.email_verificado_em && student.email?.trim().toLowerCase() === email) {
        await issueCode(student.id, "recuperar", email, key);
      }
      return response({ message: "Se houver um e-mail confirmado para esses dados, você receberá um código de recuperação." });
    }
    if (!/^\d{6}$/.test(code) || newPassword.length < 8 || newPassword.length > 128) {
      return response({ error: "Informe o código e uma senha entre 8 e 128 caracteres." }, 400);
    }
    const { data: student, error: lookupError } = await db.from("alunos")
      .select("id,email,email_verificado_em").eq("matricula", matricula).maybeSingle();
    if (lookupError) throw lookupError;
    if (!student?.email_verificado_em || student.email?.trim().toLowerCase() !== email) {
      return response({ error: "Código incorreto ou expirado." }, 400);
    }
    const digest = await hashCode(student.id, "recuperar", email, code);
    const { data: success, error: resetError } = await db.rpc("aluno_email_concluir_internal", {
      p_aluno_id: student.id, p_finalidade: "recuperar",
      p_email: email, p_codigo_hash: digest, p_nova_senha: newPassword,
    });
    if (resetError) throw resetError;
    if (!success) return response({ error: "Código incorreto ou expirado." }, 400);
    return response({ message: "Senha redefinida! Entre no portal com sua nova senha." });
  } catch (error) {
    console.error("[student-email] Request failed", error instanceof Error ? error.name : "unknown");
    return response({ error: "Não foi possível concluir a operação. Tente novamente." }, 500);
  }
});

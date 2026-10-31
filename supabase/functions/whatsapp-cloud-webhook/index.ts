// LogView - official Meta WhatsApp webhook with signature verification.
import { createClient } from "npm:@supabase/supabase-js@2.99.1";
const url = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const secret = Deno.env.get("META_APP_SECRET") || "";
const verifyToken = Deno.env.get("META_WEBHOOK_VERIFY_TOKEN") || "";
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a), y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] || 0) ^ (y[i] || 0);
  return diff === 0;
}
async function validSignature(payload: string, signature: string) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const bytes = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  const actual = "sha256=" + Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, "0")).join("");
  return safeEqual(actual, signature);
}

Deno.serve(async (req: Request) => {
  if (req.method === "GET") {
    const params = new URL(req.url).searchParams;
    const candidate = params.get("hub.verify_token") || "";
    const challenge = params.get("hub.challenge") || "";
    if (params.get("hub.mode") === "subscribe" && verifyToken && safeEqual(candidate, verifyToken)
      && /^[a-zA-Z0-9_-]{1,300}$/.test(challenge)) {
      return new Response(challenge, { headers: { "Content-Type": "text/plain" } });
    }
    return new Response("Não autorizado", { status: 403 });
  }
  if (req.method !== "POST") return new Response("Método inválido", { status: 405 });
  if (!url || !key || !secret || Number(req.headers.get("content-length") || 0) > 1024 * 1024) {
    return new Response("Indisponível", { status: 503 });
  }
  try {
    const raw = await req.text();
    if (raw.length > 1024 * 1024 ||
      !(await validSignature(raw, req.headers.get("x-hub-signature-256") || ""))) {
      return new Response("Assinatura inválida", { status: 403 });
    }
    const payload = JSON.parse(raw);
    if (payload?.object !== "whatsapp_business_account") return Response.json({ ok: true });
    for (const entry of payload.entry || []) {
      for (const change of entry.changes || []) {
        if (change.field !== "messages") continue;
        const value = change.value || {};
        for (const event of value.statuses || []) {
          if (!["sent", "delivered", "read", "failed"].includes(event.status)) continue;
          if (typeof event.id !== "string") continue;
          const { error } = await db.rpc("whatsapp_cloud_status_internal", {
            p_message_id: event.id,
            p_status: event.status,
          });
          if (error) throw error;
        }
        for (const message of value.messages || []) {
          const body = typeof message.text?.body === "string" ? message.text.body.trim().toUpperCase() : "";
          if (message.type === "text" && ["SAIR", "PARAR", "CANCELAR", "STOP"].includes(body)) {
            const { error } = await db.rpc("whatsapp_cloud_optout_internal", {
              p_phone: String(message.from || ""),
            });
            if (error) throw error;
          }
        }
      }
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("[WhatsApp] Webhook processing failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: "Falha no processamento." }, { status: 500 });
  }
});

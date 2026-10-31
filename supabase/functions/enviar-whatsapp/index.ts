// LogView - official WhatsApp Cloud API dispatcher.
// No token or phone number is ever exposed to the browser.
import { createClient } from "npm:@supabase/supabase-js@2.99.1";

const url = Deno.env.get("SUPABASE_URL") || "";
const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const workerKey = Deno.env.get("WHATSAPP_DISPATCH_KEY") || "";
const token = Deno.env.get("META_WHATSAPP_ACCESS_TOKEN") || "";
const phoneId = Deno.env.get("META_WHATSAPP_PHONE_NUMBER_ID") || "";
const templateName = Deno.env.get("META_WHATSAPP_TEMPLATE_NAME") || "";
const graphVersion = Deno.env.get("META_GRAPH_VERSION") || "";
const configured = Boolean(url && key && workerKey && token && /^[0-9]+$/.test(phoneId) &&
  /^[a-z][a-z0-9_]*$/.test(templateName) && /^v[0-9]+\.[0-9]+$/.test(graphVersion));
const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

function constantCompare(a: string, b: string) {
  const encoder = new TextEncoder();
  const first = encoder.encode(a);
  const second = encoder.encode(b);
  let diff = first.length ^ second.length;
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    diff |= (first[i] || 0) ^ (second[i] || 0);
  }
  return diff === 0;
}
const json = (data: object, status = 200) => Response.json(data, {
  status, headers: { "Cache-Control": "no-store" },
});

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return json({ error: "Método não permitido." }, 405);
  // Never expose whether a real number or particular occurrence exists.
  if (!workerKey || !constantCompare(req.headers.get("x-dispatch-key") || "", workerKey)) {
    return json({ error: "Não autorizado." }, 401);
  }
  if (!configured) return json({ error: "WhatsApp Cloud API ainda não configurada." }, 503);
  try {
    const { error: stuckError } = await db.rpc("whatsapp_cloud_reconcile_stuck_internal");
    if (stuckError) throw stuckError;
    const { data: jobs, error } = await db.rpc("whatsapp_cloud_claim_internal", { p_batch: 10 });
    if (error) throw error;
    let accepted = 0;
    let failed = 0;
    for (const job of jobs || []) {
      const number = String(job.phone || "");
      if (!/^55[1-9][0-9]{9,10}$/.test(number)) {
        await db.rpc("whatsapp_cloud_mark_internal", { p_id: job.queue_id, p_status: "ignorado", p_error: "Telefone brasileiro inválido." });
        failed++;
        continue;
      }
      let status = "revisar";
      let errorCode: string | null = null;
      let metaMessageId: string | null = null;
      try {
        const response = await fetch("https://graph.facebook.com/" + graphVersion + "/" + phoneId + "/messages", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + token,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: number,
            type: "template",
            template: { name: templateName, language: { code: "pt_BR" } },
          }),
          signal: AbortSignal.timeout(15000),
        });
        const responseBody = await response.json().catch(() => ({}));
        if (response.ok && typeof responseBody.messages?.[0]?.id === "string") {
          metaMessageId = responseBody.messages[0].id;
          status = "aceito"; // accepted by Meta, NOT proof of delivery
          accepted++;
        } else if (response.ok) {
          // Unknown Meta response: don't risk duplicate by retrying.
          errorCode = "Resposta sem ID da Meta";
          failed++;
        } else {
          errorCode = "Meta HTTP " + response.status;
          // A 4xx rejection is known not to have been accepted; 5xx might be ambiguous.
          status = response.status >= 500 ? "revisar" : "erro";
          failed++;
        }
      } catch {
        // A timeout may happen AFTER Meta accepts the send: never auto-retry.
        errorCode = "Resultado de envio desconhecido";
        failed++;
      }
      const { error: markError } = await db.rpc("whatsapp_cloud_mark_internal", {
        p_id: job.queue_id, p_status: status, p_message_id: metaMessageId, p_error: errorCode,
      });
      if (markError) console.error("[WhatsApp] Failed to update queue status");
    }
    return json({ scanned: (jobs || []).length, accepted, notAccepted: failed });
  } catch (err) {
    console.error("[WhatsApp] Dispatch error", err instanceof Error ? err.name : "unknown");
    return json({ error: "Falha no processamento." }, 500);
  }
});

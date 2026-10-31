import { useEffect, useState } from "react";
import { FaCheckCircle, FaEnvelope, FaExclamationCircle, FaLock } from "react-icons/fa";

const inputStyle = "student-soft-input h-11 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base text-slate-900 outline-none dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const buttonStyle = "inline-flex items-center justify-center rounded-xl bg-green-700 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-green-800 disabled:cursor-wait disabled:opacity-60";

export function StudentEmailSettings({ onEmailAction }) {
  const [status, setStatus] = useState(null);
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [failed, setFailed] = useState(false);

  const statusRefresh = async () => {
    const next = await onEmailAction("status");
    setStatus(next);
  };

  useEffect(() => {
    let active = true;
    onEmailAction("status").then(next => { if (active) setStatus(next); })
      .catch(err => { if (active) { setNotice(err.message); setFailed(true); setStatus({ envio_disponivel: false }); } });
    return () => { active = false; };
  }, [onEmailAction]);

  const sendCode = async (event) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    setFailed(false);
    setNotice("");
    try {
      const result = await onEmailAction("confirmar_solicitar", { email: email.trim() });
      setNotice(result.message || "Código solicitado.");
      setPending(!result.ja_confirmado && !String(result.message || "").includes("já está confirmado"));
    } catch (err) { setNotice(err.message); setFailed(true); }
    finally { setBusy(false); }
  };

  const confirm = async (event) => {
    event.preventDefault();
    if (!/^\d{6}$/.test(code.trim())) { setNotice("Digite o código de seis números."); setFailed(true); return; }
    setBusy(true);
    setFailed(false);
    setNotice("");
    try {
      const result = await onEmailAction("confirmar_codigo", { email: email.trim(), codigo: code.trim() });
      setNotice(result.message || "E-mail confirmado.");
      setPending(false);
      setCode("");
      setEmail("");
      await statusRefresh();
    } catch (err) { setNotice(err.message); setFailed(true); }
    finally { setBusy(false); }
  };

  return (
    <section id="student-email" className="mt-6 scroll-mt-20 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7 print:hidden">
      <h2 className="flex items-center gap-2 text-xl font-bold"><FaEnvelope aria-hidden="true" className="text-green-600" /> E-mail de recuperação</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
        Cadastre e confirme um endereço que você utiliza. Somente após a confirmação ele poderá ajudar a recuperar sua senha.
      </p>
      {status === null ? <p className="mt-4 text-sm text-slate-500">Consultando seu e-mail...</p> : (
        <>
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm dark:border-slate-700 dark:bg-slate-950">
            {status.verificado
              ? <FaCheckCircle className="mt-0.5 shrink-0 text-green-600" aria-hidden="true" />
              : <FaLock className="mt-0.5 shrink-0 text-slate-400" aria-hidden="true" />}
            <span>{status.verificado ? "E-mail confirmado: " + status.email_mascarado : "Nenhum e-mail confirmado nesta conta."}</span>
          </div>
          {!status.envio_disponivel && (
            <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-200">
              A escola ainda precisa configurar o serviço de envio. O cadastro será liberado assim que estiver disponível.
            </p>
          )}
          {status.envio_disponivel && !pending && (
            <form onSubmit={sendCode} className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
              <label className="min-w-0 flex-1">
                <span className="mb-1.5 block text-sm font-semibold">{status.verificado ? "Alterar e-mail" : "Seu e-mail"}</span>
                <input type="email" required autoComplete="email" maxLength={254} value={email} onChange={event => setEmail(event.target.value)}
                  placeholder="seunome@exemplo.com" className={inputStyle} disabled={busy}/>
              </label>
              <button type="submit" disabled={busy} className={buttonStyle}>{busy ? "Enviando..." : "Enviar confirmação"}</button>
            </form>
          )}
          {pending && (
            <form onSubmit={confirm} className="mt-5 space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">Enviamos um código para <strong>{email}</strong>. Ele vale por 10 minutos e pode ser usado uma única vez.</p>
              <label className="block max-w-sm">
                <span className="mb-1.5 block text-sm font-semibold">Código de confirmação</span>
                <input required inputMode="numeric" autoComplete="one-time-code" minLength={6} maxLength={6} pattern="[0-9]{6}" value={code}
                  onChange={event => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} className={inputStyle} />
              </label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={busy} className={buttonStyle}>{busy ? "Verificando..." : "Confirmar e-mail"}</button>
                <button type="button" disabled={busy} onClick={() => { setPending(false); setCode(""); setNotice(""); }} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold dark:border-slate-700">Cancelar</button>
              </div>
            </form>
          )}
        </>
      )}
      {notice && <p role={failed ? "alert" : "status"} className={"mt-4 flex items-start gap-2 rounded-xl p-3 text-sm " + (failed
        ? "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"
        : "bg-green-50 text-green-800 dark:bg-green-950/30 dark:text-green-300")}>
        {failed && <FaExclamationCircle aria-hidden="true" className="mt-0.5 shrink-0"/>}{notice}
      </p>}
    </section>
  );
}

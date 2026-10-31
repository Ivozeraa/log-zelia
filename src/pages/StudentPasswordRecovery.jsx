import { useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowLeft, FaEnvelope, FaKey } from "react-icons/fa";
import { PublicThemeToggle } from "../components/ui/PublicThemeToggle";
import { studentEmailAction } from "../services/studentEmail";
import logo from "../assets/images/logo.png";
const inputStyle = "student-soft-input h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-3 text-base outline-none dark:border-slate-700 dark:bg-slate-950";
export function StudentPasswordRecovery({ onBack }) {
  const [matricula, setMatricula] = useState("");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [phase, setPhase] = useState("request");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const submit = async (event) => {
    event.preventDefault();
    setError("");
    setMessage("");
    if (phase === "code" && newPassword !== confirmation) { setError("As senhas não coincidem."); return; }
    if (phase === "code" && (newPassword.length < 8 || newPassword.length > 128)) { setError("A senha deve ter de 8 a 128 caracteres."); return; }
    setBusy(true);
    try {
      const data = await studentEmailAction(phase === "request" ? "recuperar_solicitar" : "recuperar_codigo", {
        matricula: matricula.trim(), email: email.trim(), codigo: code, nova_senha: newPassword,
      });
      setMessage(data.message || "Solicitação recebida.");
      if (phase === "request") setPhase("code");
      else { setPhase("done"); setCode(""); setNewPassword(""); setConfirmation(""); }
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };
  return (
    <main className="student-portal min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white/90 dark:border-slate-800 dark:bg-slate-950/90 print:hidden">
        <div className="mx-auto flex h-16 max-w-5xl items-center justify-between gap-3 px-4">
          <Link to="/" className="flex items-center gap-2.5"><img src={logo} alt="LogView" width="40" height="40" className="h-9 w-9 object-contain"/><strong>LOG <span className="text-orange-500">VIEW</span></strong></Link>
          <PublicThemeToggle compact />
        </div>
      </header>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-xl items-center px-4 py-10">
        <section className="w-full rounded-3xl border border-slate-200 bg-white p-6 shadow-lg dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"><FaKey aria-hidden="true" /></div>
          <h1 className="mt-5 text-2xl font-black">Recuperação de senha</h1>
          <p className="mt-2 text-sm leading-6 text-slate-600 dark:text-slate-300">Para recuperar a senha, o e-mail precisa ter sido confirmado anteriormente no Portal do Aluno. Se ainda não foi cadastrado, solicite ajuda à coordenação.</p>
          {phase !== "done" ? (
            <form onSubmit={submit} className="mt-6 space-y-4">
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">Matrícula</span><input required autoComplete="username" value={matricula} onChange={e => setMatricula(e.target.value)} className={inputStyle} disabled={phase === "code"} /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-semibold">E-mail confirmado</span><input required type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} className={inputStyle} disabled={phase === "code"} /></label>
              {phase === "code" && <>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold">Código recebido</span><input required inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" minLength={6} maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))} className={inputStyle}/></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold">Nova senha</span><input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={newPassword} onChange={e => setNewPassword(e.target.value)} className={inputStyle}/></label>
                <label className="block"><span className="mb-1.5 block text-sm font-semibold">Confirmar nova senha</span><input required type="password" autoComplete="new-password" minLength={8} maxLength={128} value={confirmation} onChange={e => setConfirmation(e.target.value)} className={inputStyle}/></label>
              </>}
              <button type="submit" disabled={busy} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60"><FaEnvelope aria-hidden="true" />{busy ? "Verificando..." : phase === "request" ? "Enviar código" : "Redefinir senha"}</button>
              {phase === "code" && <button type="button" onClick={() => { setPhase("request"); setCode(""); setMessage(""); setError(""); }} className="w-full py-2 text-sm font-semibold text-slate-600 dark:text-slate-300">Voltar e solicitar outro código</button>}
            </form>
          ) : <button type="button" onClick={onBack} className="mt-6 w-full rounded-xl bg-green-700 py-3 text-sm font-bold text-white">Entrar no Portal do Aluno</button>}
          {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}
          {message && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-sm text-green-800 dark:bg-green-950/30 dark:text-green-300">{message}</p>}
          {phase !== "done" && <button type="button" onClick={onBack} className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-green-700"><FaArrowLeft aria-hidden="true"/> Voltar ao login</button>}
        </section>
      </div>
    </main>
  );
}

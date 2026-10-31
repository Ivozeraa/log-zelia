import { useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaCheckCircle, FaEye, FaEyeSlash, FaExclamationTriangle, FaGraduationCap, FaSearch, FaUserTie } from "react-icons/fa";
import { supabase } from "../utils/supabase";
import "../utils/studentPortal.css";
import { PublicThemeToggle } from "../components/ui/PublicThemeToggle";
import { StudentDashboard } from "./StudentDashboard";
import logo from "../assets/images/logo.png";

const categoryLabels = { ocorrencia: "Ocorrência", suspensao: "Suspensão" };
const typeLabels = { indisciplina: "Indisciplina", infrequencia: "Infrequência", atraso: "Atraso", desrespeito: "Desrespeito", outro: "Outro" };
const formatDate = (value) => { if (!value) return "—"; const [year, month, day] = String(value).split("-").map(Number); return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day)); };
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const fieldClass = "student-soft-input h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-base outline-none transition-colors focus:border-green-600 dark:border-slate-700 dark:bg-slate-950";

const PasswordField = ({ label, value, onChange, placeholder, show, setShow, autoComplete }) => (
  <label className="block">
    <span className="mb-2 block text-sm font-semibold">{label}</span>
    <div className="relative">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} placeholder={placeholder} autoComplete={autoComplete} className={`${fieldClass} pr-12`} />
      <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => setShow((current) => !current)} aria-label={show ? "Ocultar senha" : "Mostrar senha"} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200">
        {show ? <FaEyeSlash size={16} /> : <FaEye size={16} />}
      </button>
    </div>
  </label>
);

export const StudentOccurrenceLookup = () => {
  const [matricula, setMatricula] = useState(""); const [senha, setSenha] = useState(""); const [novaSenha, setNovaSenha] = useState(""); const [confirmarSenha, setConfirmarSenha] = useState("");
  const [showPassword, setShowPassword] = useState(false); const [showNewPassword, setShowNewPassword] = useState(false); const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false); const [alterandoSenha, setAlterandoSenha] = useState(false); const [mustChangePassword, setMustChangePassword] = useState(false); const [result, setResult] = useState(null); const [errorMessage, setErrorMessage] = useState("");
  const carregarOcorrencias = async (cleanMatricula, currentPassword) => { const { data, error } = await supabase.rpc("consultar_ocorrencias_aluno", { p_matricula: cleanMatricula, p_senha: currentPassword }); if (error) throw error; setResult((current) => ({ ...current, ocorrencias: data || [] })); };
  const handleSubmit = async (event) => { event.preventDefault(); const cleanMatricula = matricula.trim(); if (!cleanMatricula || !senha) { setErrorMessage("Informe a matrícula e a senha."); return; } setLoading(true); setErrorMessage(""); setResult(null); setMustChangePassword(false); try { const { data, error } = await supabase.rpc("consultar_aluno_publico", { p_matricula: cleanMatricula, p_senha: senha }); if (error) throw error; const aluno = Array.isArray(data) ? data[0] : null; if (!aluno) { setErrorMessage("Não encontramos um aluno com a matrícula e senha informadas."); return; } setResult({ aluno, ocorrencias: [] }); if (aluno.primeiro_acesso) { setMustChangePassword(true); return; } await carregarOcorrencias(cleanMatricula, senha); } catch (error) { console.error("Erro na consulta pública:", error); setErrorMessage("Não foi possível realizar a consulta agora. Tente novamente em alguns instantes."); } finally { setLoading(false); } };
  const handleChangePassword = async (event) => { event.preventDefault(); setErrorMessage(""); if (novaSenha.length < 8) { setErrorMessage("A nova senha deve ter pelo menos 8 caracteres."); return; } if (novaSenha !== confirmarSenha) { setErrorMessage("As senhas não coincidem."); return; } setAlterandoSenha(true); try { const { data, error } = await supabase.rpc("alterar_senha_aluno_publico", { p_matricula: matricula.trim(), p_senha_atual: senha, p_nova_senha: novaSenha }); if (error) throw error; const response = Array.isArray(data) ? data[0] : data; if (!response?.sucesso) { setErrorMessage(response?.mensagem || "Não foi possível alterar sua senha."); return; } setSenha(novaSenha); setNovaSenha(""); setConfirmarSenha(""); setMustChangePassword(false); await carregarOcorrencias(matricula.trim(), novaSenha); } catch (error) { console.error("Erro ao alterar senha:", error); setErrorMessage("Não foi possível alterar sua senha agora. Tente novamente."); } finally { setAlterandoSenha(false); } };
  const resetPortal = () => {
    setResult(null);
    setMustChangePassword(false);
    setMatricula("");
    setSenha("");
    setNovaSenha("");
    setConfirmarSenha("");
    setErrorMessage("");
  };
  const refreshDashboard = async () => {
    await carregarOcorrencias(matricula.trim(), senha);
  };
  const changeDashboardPassword = async (currentPassword, newPassword) => {
    const { data, error } = await supabase.rpc("alterar_senha_aluno_publico", {
      p_matricula: matricula.trim(), p_senha_atual: currentPassword, p_nova_senha: newPassword
    });
    if (error) throw error;
    const response = Array.isArray(data) ? data[0] : data;
    if (response?.sucesso) setSenha(newPassword);
    return response || { sucesso: false, mensagem: "Não foi possível alterar sua senha." };
  };
  if (result && !mustChangePassword) {
    return <StudentDashboard result={result} onNewConsultation={resetPortal} onRefresh={refreshDashboard} onChangePassword={changeDashboardPassword} />;
  }
  return <main className="student-portal min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white"><header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90"><div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-3 px-4 sm:px-6"><Link to="/" className="flex items-center gap-2.5"><img src={logo} alt="Log Zélia" width="40" height="40" className="h-9 w-9 rounded-xl object-contain" /><span className="font-montserrat text-base font-extrabold">LOG <span className="text-orange-500">VIEW</span></span></Link><PublicThemeToggle compact /></div></header><div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center px-4 py-10 sm:px-6 sm:py-14"><section className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 sm:p-8"><div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"><FaGraduationCap className="text-xl" /></div><p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400">Portal do aluno</p>{!mustChangePassword ? <><h1 className="mt-2 text-3xl font-black tracking-tight">Consultar ocorrências</h1><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Informe sua matrícula e senha para visualizar seu histórico escolar.</p><form onSubmit={handleSubmit} className="mt-7 space-y-4"><label className="block"><span className="mb-2 block text-sm font-semibold">Matrícula</span><input value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ex.: 2026001234" inputMode="numeric" autoComplete="username" className={fieldClass} /></label><PasswordField label="Senha" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha de acesso" show={showPassword} setShow={setShowPassword} autoComplete="current-password" />{errorMessage && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"><div className="flex gap-2"><FaExclamationTriangle className="mt-1 shrink-0" /><span>{errorMessage}</span></div></div>}<button type="submit" disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-bold text-white transition hover:bg-green-800 disabled:opacity-60">{loading ? "Consultando..." : "Consultar ocorrências"}<FaSearch className="text-xs" /></button></form></> : <><h1 className="mt-2 text-3xl font-black tracking-tight">Primeiro acesso</h1><p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Crie uma senha pessoal antes de consultar suas ocorrências.</p><form onSubmit={handleChangePassword} className="mt-7 space-y-4"><PasswordField label="Nova senha" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" show={showNewPassword} setShow={setShowNewPassword} autoComplete="new-password" /><PasswordField label="Confirmar nova senha" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="Digite novamente" show={showConfirmPassword} setShow={setShowConfirmPassword} autoComplete="new-password" />{errorMessage && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700"><div className="flex gap-2"><FaExclamationTriangle className="mt-1 shrink-0" /><span>{errorMessage}</span></div></div>}<button type="submit" disabled={alterandoSenha} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-bold text-white transition hover:bg-green-800 disabled:opacity-60">{alterandoSenha ? "Salvando..." : "Salvar nova senha"}</button></form></>}</section></div></main>;
};
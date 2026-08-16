import { useState } from "react";
import { Link } from "react-router-dom";
import { FaArrowLeft, FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaGraduationCap, FaLock, FaSearch, FaUserTie } from "react-icons/fa";
import { supabase } from "../utils/supabase";
import logo from "../assets/images/logo.png";

const categoryLabels = { ocorrencia: "Ocorrência", suspensao: "Suspensão" };
const typeLabels = { indisciplina: "Indisciplina", infrequencia: "Infrequência", atraso: "Atraso", desrespeito: "Desrespeito", outro: "Outro" };
const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).split("-").map(Number);
  return new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day));
};
const formatDateTime = (value) => value ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const fieldClass = "h-12 w-full rounded-xl border border-slate-300 bg-slate-50 px-4 text-base outline-none transition focus:border-green-600 focus:ring-4 focus:ring-green-600/10 dark:border-slate-700 dark:bg-slate-950";

export const StudentOccurrenceLookup = () => {
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const [alterandoSenha, setAlterandoSenha] = useState(false);
  const [mustChangePassword, setMustChangePassword] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState("");

  const carregarOcorrencias = async (cleanMatricula, currentPassword) => {
    const { data, error } = await supabase.rpc("consultar_ocorrencias_aluno", { p_matricula: cleanMatricula, p_senha: currentPassword });
    if (error) throw error;
    setResult((current) => ({ ...current, ocorrencias: data || [] }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const cleanMatricula = matricula.trim();
    if (!cleanMatricula || !senha) { setErrorMessage("Informe a matrícula e a senha."); return; }
    setLoading(true); setErrorMessage(""); setResult(null); setMustChangePassword(false);
    try {
      const { data, error } = await supabase.rpc("consultar_aluno_publico", { p_matricula: cleanMatricula, p_senha: senha });
      if (error) throw error;
      const aluno = Array.isArray(data) ? data[0] : null;
      if (!aluno) { setErrorMessage("Não encontramos um aluno com a matrícula e senha informadas."); return; }
      setResult({ aluno, ocorrencias: [] });
      if (aluno.primeiro_acesso) { setMustChangePassword(true); return; }
      await carregarOcorrencias(cleanMatricula, senha);
    } catch (error) {
      console.error("Erro na consulta pública:", error);
      setErrorMessage("Não foi possível realizar a consulta agora. Tente novamente em alguns instantes.");
    } finally { setLoading(false); }
  };

  const handleChangePassword = async (event) => {
    event.preventDefault(); setErrorMessage("");
    if (novaSenha.length < 8) { setErrorMessage("A nova senha deve ter pelo menos 8 caracteres."); return; }
    if (novaSenha !== confirmarSenha) { setErrorMessage("As senhas não coincidem."); return; }
    setAlterandoSenha(true);
    try {
      const { data, error } = await supabase.rpc("alterar_senha_aluno_publico", { p_matricula: matricula.trim(), p_senha_atual: senha, p_nova_senha: novaSenha });
      if (error) throw error;
      const response = Array.isArray(data) ? data[0] : data;
      if (!response?.sucesso) { setErrorMessage(response?.mensagem || "Não foi possível alterar sua senha."); return; }
      setSenha(novaSenha); setNovaSenha(""); setConfirmarSenha(""); setMustChangePassword(false);
      await carregarOcorrencias(matricula.trim(), novaSenha);
    } catch (error) {
      console.error("Erro ao alterar senha:", error);
      setErrorMessage("Não foi possível alterar sua senha agora. Tente novamente.");
    } finally { setAlterandoSenha(false); }
  };

  if (result && !mustChangePassword) {
    return (
      <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
        <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90">
          <div className="mx-auto flex h-16 w-full max-w-5xl items-center justify-between gap-4 px-4 sm:px-6">
            <Link to="/" className="flex min-w-0 items-center gap-2.5"><img src={logo} alt="Log Zélia" width="40" height="40" className="h-9 w-9 rounded-xl object-contain" /><span className="truncate font-montserrat text-base font-extrabold">LOG <span className="text-orange-500">ZÉLIA</span></span></Link>
            <button type="button" onClick={() => setResult(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-green-300 hover:text-green-700 dark:border-slate-700 dark:text-slate-300 dark:hover:border-green-700 dark:hover:text-green-300">Nova consulta</button>
          </div>
        </header>
        <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
          <Link to="/" className="mb-8 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-green-700 dark:text-slate-400 dark:hover:text-green-300"><FaArrowLeft /> Voltar para o início</Link>
          <section className="rounded-[2rem] border border-green-200 bg-gradient-to-br from-green-50 via-white to-white p-6 shadow-sm dark:border-green-900/50 dark:from-green-950/30 dark:via-slate-900 dark:to-slate-900 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700 dark:text-green-400">Consulta realizada</p><h1 className="mt-2 text-2xl font-black sm:text-3xl">{result.aluno.aluno_nome}</h1><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{result.aluno.turma_nome || "Turma não informada"} · {result.aluno.escola_nome}</p></div>
              <div className="rounded-2xl border border-green-200 bg-white px-5 py-4 text-center dark:border-green-900/50 dark:bg-slate-950"><p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Ocorrências</p><p className="mt-1 text-3xl font-black text-green-700 dark:text-green-300">{result.aluno.total_ocorrencias}</p></div>
            </div>
          </section>
          <section className="mt-8 space-y-4">
            <div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-bold">Histórico de ocorrências</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Detalhes registrados pela equipe escolar.</p></div><FaCalendarAlt className="text-slate-400" /></div>
            {result.ocorrencias.length === 0 ? (
              <div className="rounded-3xl border border-green-200 bg-white p-10 text-center shadow-sm dark:border-green-900/50 dark:bg-slate-900"><FaCheckCircle className="mx-auto text-4xl text-green-600" /><p className="mt-4 font-bold">Nenhuma ocorrência registrada.</p><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">O histórico está limpo no momento.</p></div>
            ) : result.ocorrencias.map((occurrence) => (
              <article key={occurrence.ocorrencia_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${occurrence.categoria === "suspensao" ? "bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"}`}>{categoryLabels[occurrence.categoria] || occurrence.categoria || "Registro"}</span>{occurrence.tipo && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{typeLabels[occurrence.tipo] || occurrence.tipo}</span>}</div><p className="mt-3 text-sm font-semibold">Data do ocorrido: {formatDate(occurrence.data_ocorrido)}</p></div>
                  {occurrence.categoria === "suspensao" && occurrence.data_inicio && occurrence.data_fim && <div className="rounded-2xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">Suspensão: {formatDate(occurrence.data_inicio)} a {formatDate(occurrence.data_fim)}</div>}
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><FaUserTie /> Professor responsável</div><p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{occurrence.professor_nome || "Professor não informado"}</p></div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400"><FaCalendarAlt /> Aplicada em</div><p className="mt-2 text-sm font-semibold text-slate-800 dark:text-slate-100">{formatDateTime(occurrence.data_aplicacao)}</p></div>
                </div>
                <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950"><p className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">Motivo / descrição</p><p className="mt-2 text-sm leading-6 text-slate-700 dark:text-slate-300">{occurrence.descricao || "Não informado."}</p></div>
              </article>
            ))}
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90"><div className="mx-auto flex h-16 w-full max-w-5xl items-center px-4 sm:px-6"><Link to="/" className="flex items-center gap-2.5"><img src={logo} alt="Log Zélia" width="40" height="40" className="h-9 w-9 rounded-xl object-contain" /><span className="font-montserrat text-base font-extrabold">LOG <span className="text-orange-500">ZÉLIA</span></span></Link></div></header>
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-xl items-center px-4 py-10 sm:px-6 sm:py-14">
        <section className="w-full rounded-[2rem] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-900/5 dark:border-slate-800 dark:bg-slate-900 sm:p-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-300"><FaGraduationCap className="text-xl" /></div>
          <p className="mt-6 text-sm font-bold uppercase tracking-[0.18em] text-green-700 dark:text-green-400">Portal do aluno</p>
          {!mustChangePassword ? <>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Consultar ocorrências</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Informe sua matrícula e senha para visualizar seu histórico escolar.</p>
            <form onSubmit={handleSubmit} className="mt-7 space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-semibold">Matrícula</span><input value={matricula} onChange={e => setMatricula(e.target.value)} placeholder="Ex.: 2026001234" inputMode="numeric" autoComplete="username" className={fieldClass} /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold">Senha</span><input type="password" value={senha} onChange={e => setSenha(e.target.value)} placeholder="Senha de acesso" autoComplete="current-password" className={fieldClass} /></label>
              {errorMessage && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700 dark:border-red-950/60 dark:bg-red-950/30 dark:text-red-300"><div className="flex gap-2"><FaExclamationTriangle className="mt-1 shrink-0" /><span>{errorMessage}</span></div></div>}
              <button type="submit" disabled={loading} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Consultando..." : "Consultar ocorrências"}<FaSearch className="text-xs" /></button>
            </form>
          </> : <>
            <h1 className="mt-2 text-3xl font-black tracking-tight">Primeiro acesso</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300">Crie uma senha pessoal antes de consultar suas ocorrências.</p>
            <form onSubmit={handleChangePassword} className="mt-7 space-y-4">
              <label className="block"><span className="mb-2 block text-sm font-semibold">Nova senha</span><input type="password" value={novaSenha} onChange={e => setNovaSenha(e.target.value)} placeholder="Mínimo de 8 caracteres" autoComplete="new-password" className={fieldClass} /></label>
              <label className="block"><span className="mb-2 block text-sm font-semibold">Confirmar nova senha</span><input type="password" value={confirmarSenha} onChange={e => setConfirmarSenha(e.target.value)} placeholder="Digite novamente" autoComplete="new-password" className={fieldClass} /></label>
              {errorMessage && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700 dark:border-red-950/60 dark:bg-red-950/30 dark:text-red-300"><div className="flex gap-2"><FaExclamationTriangle className="mt-1 shrink-0" /><span>{errorMessage}</span></div></div>}
              <button type="submit" disabled={alterandoSenha} className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-700 px-4 text-sm font-bold text-white transition hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-60">{alterandoSenha ? "Salvando..." : "Salvar nova senha"}</button>
            </form>
          </>}
        </section>
      </div>
    </main>
  );
};
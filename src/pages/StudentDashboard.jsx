import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FaArrowLeft, FaBookOpen, FaCalendarAlt, FaCheckCircle,
  FaExclamationCircle, FaFilter, FaGraduationCap,
  FaLock, FaPrint, FaSearch, FaSyncAlt, FaUserTie
} from "react-icons/fa";
import logo from "../assets/images/logo.png";
import { PublicThemeToggle } from "../components/ui/PublicThemeToggle";
import { CustomSelect } from "../components/ui/CustomSelect";
import { StudentActionsMenu } from "../components/student/StudentActionsMenu";

const categoryLabels = { ocorrencia: "Ocorrência", suspensao: "Suspensão" };
const typeLabels = {
  indisciplina: "Indisciplina", infrequencia: "Infrequência",
  atraso: "Atraso", desrespeito: "Desrespeito", outro: "Outro"
};
const formatDate = (value) => {
  if (!value) return "—";
  const [year, month, day] = String(value).slice(0, 10).split("-").map(Number);
  return year && month && day ? new Intl.DateTimeFormat("pt-BR").format(new Date(year, month - 1, day)) : "—";
};
const formatDateTime = (value) => value
  ? new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value))
  : "—";
const fieldStyle = "student-soft-input h-12 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-green-600 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const buttonStyle = "inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-green-600/50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white";
const categoryOptions = [
  { value: "all", label: "Todos os tipos" },
  { value: "ocorrencia", label: "Ocorrências" },
  { value: "suspensao", label: "Suspensões" },
];
const periodOptions = [
  { value: "all", label: "Todo o período" },
  { value: "30", label: "Últimos 30 dias" },
  { value: "90", label: "Últimos 90 dias" },
  { value: "year", label: "Este ano" },
];

function matchesPeriod(item, period) {
  if (period === "all") return true;
  const date = item.data_ocorrido ? new Date(String(item.data_ocorrido).slice(0, 10) + "T12:00:00") : null;
  if (!date || Number.isNaN(date.getTime())) return false;
  const now = new Date();
  if (period === "year") return date.getFullYear() === now.getFullYear();
  const limit = new Date(now.getFullYear(), now.getMonth(), now.getDate() - Number(period), 0, 0, 0);
  return date >= limit;
}

function PasswordSettings({ onChangePassword }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);

  const changePassword = async (event) => {
    event.preventDefault();
    setMessage("");
    setSuccess(false);
    if (next.length < 8) { setMessage("Use uma nova senha com pelo menos 8 caracteres."); return; }
    if (next !== confirmation) { setMessage("As novas senhas não coincidem."); return; }
    if (current === next) { setMessage("A nova senha precisa ser diferente da atual."); return; }
    setSaving(true);
    try {
      const response = await onChangePassword(current, next);
      setMessage(response.mensagem || (response.sucesso ? "Senha alterada." : "Não foi possível alterar a senha."));
      setSuccess(Boolean(response.sucesso));
      if (response.sucesso) { setCurrent(""); setNext(""); setConfirmation(""); }
    } catch {
      setMessage("Não foi possível alterar sua senha. Tente novamente.");
    } finally { setSaving(false); }
  };

  return (
    <section id="student-security" className="mt-6 scroll-mt-20 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-7 print:hidden">
      <h2 className="flex items-center gap-2 text-xl font-bold"><FaLock className="text-green-600" /> Segurança da conta</h2>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Altere sua senha sem precisar sair do portal. Não compartilhe suas credenciais.</p>
      <form onSubmit={changePassword} className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="block sm:col-span-2"><span className="mb-1.5 block text-sm font-semibold">Senha atual</span><input type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} className={fieldStyle} /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Nova senha</span><input type="password" autoComplete="new-password" minLength={8} required value={next} onChange={e => setNext(e.target.value)} className={fieldStyle} /></label>
        <label className="block"><span className="mb-1.5 block text-sm font-semibold">Confirmar senha</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmation} onChange={e => setConfirmation(e.target.value)} className={fieldStyle} /></label>
        {message && <p role="status" className={`sm:col-span-2 rounded-xl p-3 text-sm ${success ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300"}`}>{message}</p>}
        <button type="submit" disabled={saving} className="rounded-xl bg-green-700 px-5 py-3 text-sm font-bold text-white hover:bg-green-800 disabled:opacity-60 sm:col-span-2 sm:justify-self-start">{saving ? "Alterando..." : "Salvar nova senha"}</button>
      </form>
    </section>
  );
}

export function StudentDashboard({ result, onNewConsultation, onRefresh, onChangePassword }) {
  const [category, setCategory] = useState("all");
  const [period, setPeriod] = useState("all");
  const [query, setQuery] = useState("");
  const [showPasswordSettings, setShowPasswordSettings] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState("");

  const registros = useMemo(() => [...(result.ocorrencias || [])].sort((a, b) =>
    String(b.data_ocorrido || "").localeCompare(String(a.data_ocorrido || "")) ||
    String(b.data_aplicacao || "").localeCompare(String(a.data_aplicacao || ""))
  ), [result.ocorrencias]);
  const totalOcorrencias = registros.filter(item => item.categoria === "ocorrencia").length;
  const totalSuspensoes = registros.filter(item => item.categoria === "suspensao").length;
  const latest = registros[0]?.data_ocorrido;
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("pt-BR");
    return registros.filter(item => {
      if (category !== "all" && item.categoria !== category) return false;
      if (!matchesPeriod(item, period)) return false;
      if (!search) return true;
      return [item.descricao, item.professor_nome, item.tipo, item.categoria, typeLabels[item.tipo], categoryLabels[item.categoria]]
        .some(text => String(text || "").toLocaleLowerCase("pt-BR").includes(search));
    });
  }, [registros, category, period, query]);

  const refresh = async () => {
    setRefreshing(true);
    setRefreshError("");
    try { await onRefresh(); } catch { setRefreshError("Não foi possível atualizar o histórico. Seus registros anteriores continuam disponíveis."); }
    finally { setRefreshing(false); }
  };

  return (
    <main className="student-portal min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-white">
      <style>{`@media print {
        @page { margin: 14mm; }
        body, html, #root { background: #fff !important; color: #000 !important; }
        .student-dashboard { max-width: 100% !important; padding: 0 !important; }
        .student-dashboard article { break-inside: avoid; box-shadow: none !important; border: 1px solid #ddd !important; margin-bottom: 12px; }
        .student-dashboard .print\\:hidden { display: none !important; }
      }`}</style>
      <header className="border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 print:hidden">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" className="flex min-w-0 items-center gap-2.5"><img src={logo} alt="LogView" width="40" height="40" className="h-9 w-9 rounded-xl object-contain" /><span className="font-montserrat text-base font-extrabold">LOG <span className="text-orange-500">VIEW</span></span></Link>
          <div className="flex items-center gap-2">
            <PublicThemeToggle compact />
            <StudentActionsMenu
              onOverview={() => document.getElementById("student-overview")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              onHistory={() => document.getElementById("student-history")?.scrollIntoView({ behavior: "smooth", block: "start" })}
              onRefresh={refresh}
              onPrint={() => window.print()}
              onSecurity={() => {
                setShowPasswordSettings(true);
                window.setTimeout(() => document.getElementById("student-security")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              }}
              onHelp={() => {
                setShowGuide(true);
                window.setTimeout(() => document.getElementById("student-guide")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
              }}
              onExit={onNewConsultation}
              refreshing={refreshing}
            />
          </div>
        </div>
      </header>
      <div className="student-dashboard mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 sm:py-10">
        <Link to="/" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-green-700 dark:text-slate-400 print:hidden"><FaArrowLeft /> Página inicial</Link>
        <section id="student-overview" className="scroll-mt-20 rounded-3xl border border-green-200 bg-gradient-to-br from-green-50 via-white to-white p-6 shadow-sm dark:border-green-900/50 dark:from-green-950/30 dark:via-slate-900 dark:to-slate-900 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-green-700 dark:text-green-400">Portal do aluno · Visão geral</p>
          <h1 className="mt-2 break-words text-2xl font-black sm:text-3xl">{result.aluno.aluno_nome}</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{result.aluno.turma_nome || "Turma não informada"} · {result.aluno.escola_nome || "Escola não informada"}</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Matrícula: {result.aluno.matricula}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ["Registros", registros.length, FaBookOpen],
              ["Ocorrências", totalOcorrencias, FaExclamationCircle],
              ["Suspensões", totalSuspensoes, FaCalendarAlt],
              ["Mais recente", formatDate(latest), FaGraduationCap],
            ].map(([label, value, Icon]) => (
              <div key={label} className="rounded-2xl border border-slate-200/80 bg-white/85 p-3 dark:border-slate-700 dark:bg-slate-950/70">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 dark:text-slate-400"><Icon aria-hidden="true" /> {label}</div>
                <p className="mt-2 text-lg font-black text-slate-900 dark:text-white sm:text-xl">{value}</p>
              </div>
            ))}
          </div>
        </section>
        <div className="mt-5 flex flex-wrap gap-2 print:hidden">
          <button className={buttonStyle} type="button" disabled={refreshing} onClick={refresh}><FaSyncAlt aria-hidden="true" className={refreshing ? "animate-spin" : ""} /> {refreshing ? "Atualizando..." : "Atualizar histórico"}</button>
          <button className={buttonStyle} type="button" onClick={() => window.print()}><FaPrint /> Imprimir / salvar PDF</button>
          <button className={buttonStyle} type="button" aria-expanded={showPasswordSettings} onClick={() => setShowPasswordSettings(value => !value)}><FaLock /> Alterar senha</button>
        </div>
        {refreshError && <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300 print:hidden">{refreshError}</p>}
        {showPasswordSettings && <PasswordSettings onChangePassword={onChangePassword} />}
        <section id="student-history" className="mt-9 scroll-mt-20">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h2 className="text-xl font-bold">Histórico de registros</h2><p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Consulte seus registros, tipos e datas.</p></div>
            <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200 print:hidden">{filtered.length} de {registros.length}</span>
          </div>
          <div className="mt-5 grid items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-[minmax(0,1fr)_minmax(0,195px)_minmax(0,185px)] print:hidden">
            <label className="relative block min-w-0">
              <span className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Pesquisar registro</span>
              <span className="relative block">
                <FaSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-4 text-slate-400" />
                <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Tipo, motivo ou professor" className={`${fieldStyle} pl-9`} />
              </span>
            </label>
            <CustomSelect label="Categoria" value={category} onChange={setCategory} options={categoryOptions} placeholder="Todos os tipos" className="min-w-0" />
            <CustomSelect label="Período" value={period} onChange={setPeriod} options={periodOptions} placeholder="Todo o período" className="min-w-0" />
          </div>
          <div className="mt-4 space-y-4">
            {filtered.length === 0 ? (
              <div className="rounded-3xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
                {registros.length === 0 ? <FaCheckCircle className="mx-auto text-4xl text-green-600" /> : <FaFilter className="mx-auto text-3xl text-slate-400" />}
                <p className="mt-3 font-bold">{registros.length === 0 ? "Nenhum registro no histórico." : "Nenhum registro corresponde aos filtros."}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{registros.length === 0 ? "Não há ocorrências ou suspensões cadastradas para esta matrícula." : "Altere a busca, o tipo ou o período para visualizar outros registros."}</p>
                {registros.length > 0 && <button type="button" onClick={() => { setQuery(""); setCategory("all"); setPeriod("all"); }} className="mt-4 text-sm font-bold text-green-700 hover:underline print:hidden">Limpar filtros</button>}
              </div>
            ) : filtered.map(item => (
              <article key={item.ocorrencia_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-bold ${item.categoria === "suspensao" ? "bg-red-100 text-red-800" : "bg-amber-100 text-amber-800"}`}>{categoryLabels[item.categoria] || item.categoria || "Registro"}</span>
                    {item.tipo && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{typeLabels[item.tipo] || item.tipo}</span>}
                  </div>
                  <span className="text-sm font-semibold text-slate-500 dark:text-slate-300"><FaCalendarAlt className="mr-1 inline" /> {formatDate(item.data_ocorrido)}</span>
                </div>
                {item.categoria === "suspensao" && item.data_inicio && item.data_fim && <p className="mt-3 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700 dark:bg-red-950/30 dark:text-red-300">Período de suspensão: {formatDate(item.data_inicio)} a {formatDate(item.data_fim)}</p>}
                <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500"><FaUserTie className="mr-1 inline" /> Professor responsável</p><p className="mt-2 font-semibold">{item.professor_nome || "Não informado"}</p></div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500"><FaCalendarAlt className="mr-1 inline" /> Registrado em</p><p className="mt-2 font-semibold">{formatDateTime(item.data_aplicacao)}</p></div>
                </div>
                <div className="mt-3 rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-xs font-bold uppercase text-slate-500">Motivo / descrição</p><p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6">{item.descricao || "Não informado."}</p></div>
              </article>
            ))}
          </div>
        </section>
        <section id="student-guide" className="mt-8 scroll-mt-20 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 print:hidden">
          <button type="button" onClick={() => setShowGuide(value => !value)} aria-expanded={showGuide} className="flex w-full items-center justify-between gap-4 rounded-xl text-left text-sm font-bold focus-visible:outline-2 focus-visible:outline-green-600/50"><span className="flex items-center gap-2"><FaBookOpen className="text-green-600" /> Entenda seu histórico</span><span className="text-green-700">{showGuide ? "Ocultar" : "Ver orientações"}</span></button>
          {showGuide && <div className="mt-4 space-y-2 text-sm leading-6 text-slate-600 dark:text-slate-300"><p><strong>Ocorrência:</strong> registro de uma situação informada pela escola.</p><p><strong>Suspensão:</strong> medida disciplinar registrada com período de aplicação quando informado.</p><p>Encontrou alguma informação incorreta? Procure a coordenação da sua escola para solicitar a revisão. O portal não altera registros.</p><p>Evite imprimir ou compartilhar seu histórico em dispositivos de outras pessoas.</p></div>}
        </section>
      </div>
    </main>
  );
}

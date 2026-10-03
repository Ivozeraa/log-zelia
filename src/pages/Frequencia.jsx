import { useEffect, useState } from "react";
import { FaCamera, FaCheckCircle, FaChevronLeft, FaChevronRight, FaClock, FaHistory, FaSignOutAlt, FaUsers } from "react-icons/fa";
import { Link } from "react-router-dom";
import { PageTitle } from "../components/ui/PageTitle";
import { CustomSelect } from "../components/ui/CustomSelect";
import { supabase } from "../utils/supabase";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const LAST_TURMA_KEY = "logzelia:frequencia:ultima-turma";

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("pt-BR", {
        timeZone: "America/Fortaleza",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
};

export const Frequencia = () => {
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [date, setDate] = useState(today());
  const [turmas, setTurmas] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState(() => {
    try { return window.localStorage.getItem(LAST_TURMA_KEY) || ""; } catch { return ""; }
  });
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 300);
  const [rows, setRows] = useState([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({ total: 0, presentes: 0, com_saida: 0, nao_registrados: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (featureLoading || !hasFeature("frequencia")) return;
    supabase.rpc("get_frequencia_turmas").then(({ data, error: queryError }) => {
      if (queryError) {
        console.error(queryError);
        setError("Não foi possível carregar as turmas.");
        return;
      }
      setTurmas(data || []);
    });
  }, [featureLoading, hasFeature]);

  useEffect(() => {
    setPage(1);
  }, [date, selectedTurma, search, pageSize]);

  const load = async (isRefresh = false) => {
    if (featureLoading || !hasFeature("frequencia")) return;
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError("");

    try {
      const [listRes, summaryRes] = await Promise.all([
        supabase.rpc("get_frequencia_professor_paginada", {
          p_data: date,
          p_turma_id: selectedTurma || null,
          p_search: search || null,
          p_limit: pageSize,
          p_offset: (page - 1) * pageSize,
        }),
        supabase.rpc("get_frequencia_professor_resumo", {
          p_data: date,
          p_turma_id: selectedTurma || null,
        }),
      ]);

      if (listRes.error) throw listRes.error;
      if (summaryRes.error) throw summaryRes.error;

      const nextRows = listRes.data || [];
      const nextSummary = summaryRes.data?.[0];

      setRows(nextRows);
      setTotalCount(Number(nextRows[0]?.total_count ?? 0));
      setSummary({
        total: Number(nextSummary?.total ?? 0),
        presentes: Number(nextSummary?.presentes ?? 0),
        com_saida: Number(nextSummary?.com_saida ?? 0),
        nao_registrados: Number(nextSummary?.nao_registrados ?? 0),
      });
    } catch (queryError) {
      console.error(queryError);
      setError("Não foi possível carregar a frequência.");
      if (!isRefresh) {
        setRows([]);
        setTotalCount(0);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedTurma, search, page, pageSize, featureLoading]);

  useEffect(() => {
    if (featureLoading || !hasFeature("frequencia")) return undefined;
    const interval = window.setInterval(() => void load(true), 30000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, selectedTurma, search, page, pageSize, featureLoading]);

  const handleTurmaChange = (value) => {
    setSelectedTurma(value);
    try {
      if (value) window.localStorage.setItem(LAST_TURMA_KEY, value);
      else window.localStorage.removeItem(LAST_TURMA_KEY);
    } catch { /* localStorage indisponível */ }
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, page * pageSize);

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <PageTitle title="Frequência" subtitle="Acompanhe quem já registrou entrada e saída hoje." />
        <div className="flex flex-wrap gap-2">
          <Link to="/app/frequencia/registros" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
            <FaHistory /> Ver registros
          </Link>
          <Link to="/app/frequencia/ponto" className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700">
            <FaCamera /> Terminal
          </Link>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,320px)_auto] lg:items-end">
          <label className="text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">
            Buscar aluno
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nome ou matrícula..." className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 h-12 text-base font-normal text-slate-900 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
          </label>
          <CustomSelect
            label="Turma"
            value={selectedTurma}
            onChange={handleTurmaChange}
            options={[
              { value: "", label: "Todas as turmas" },
              ...turmas.map((turma) => ({ value: turma.id, label: turma.nome })),
            ]}
            placeholder="Todas as turmas"
            showSearch
          />
          <label className="text-sm font-semibold leading-5 text-slate-600 dark:text-slate-300">
            Data
            <input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 h-12 text-base font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
          </label>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><FaUsers className="text-slate-400" /><p className="mt-2 text-xs text-slate-500">Alunos</p><p className="text-2xl font-black text-slate-900 dark:text-white">{summary.total}</p></div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20"><FaCheckCircle className="text-green-600" /><p className="mt-2 text-xs text-green-700 dark:text-green-300">Presentes</p><p className="text-2xl font-black text-green-800 dark:text-green-200">{summary.presentes}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><FaSignOutAlt className="text-slate-400" /><p className="mt-2 text-xs text-slate-500">Com saída</p><p className="text-2xl font-black text-slate-900 dark:text-white">{summary.com_saida}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><FaClock className="text-amber-600" /><p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Não registrados</p><p className="text-2xl font-black text-amber-800 dark:text-amber-200">{summary.nao_registrados}</p></div>
      </section>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
              <tr><th className="px-4 py-3 font-semibold">Aluno</th><th className="px-4 py-3 font-semibold">Turma</th><th className="px-4 py-3 font-semibold">Entrada</th><th className="px-4 py-3 font-semibold">Saída</th><th className="px-4 py-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">Carregando...</td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-10 text-center text-slate-500">{search ? "Nenhum aluno encontrado." : "Nenhum aluno disponível para esta seleção."}</td></tr>
              ) : rows.map((row) => {
                const presente = row.entrada && (!row.saida || new Date(row.entrada) > new Date(row.saida));
                const status = presente ? "Presente" : row.saida ? "Fora da escola" : "Não registrado";
                const className = presente
                  ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700"
                  : row.saida
                    ? "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700";
                return (
                  <tr key={row.aluno_id}>
                    <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{row.aluno_nome}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.turma_nome}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTime(row.entrada)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTime(row.saida)}</td>
                    <td className="px-4 py-3"><span className={className}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="space-y-2 p-3 md:hidden">
          {loading ? <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500">Carregando...</div> : rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Nenhum aluno encontrado.</div> : rows.map((row) => {
            const presente = row.entrada && (!row.saida || new Date(row.entrada) > new Date(row.saida));
            const status = presente ? "Presente" : row.saida ? "Fora da escola" : "Não registrado";
            return (
              <div key={row.aluno_id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-white">{row.aluno_nome}</p><p className="mt-1 text-xs text-slate-500">{row.turma_nome}</p></div>
                  <span className={presente ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700" : row.saida ? "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"}>{status}</span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-xs"><div><p className="text-slate-400">Entrada</p><p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{formatTime(row.entrada)}</p></div><div><p className="text-slate-400">Saída</p><p className="mt-1 font-semibold text-slate-700 dark:text-slate-200">{formatTime(row.saida)}</p></div></div>
              </div>
            );
          })}
        </div>
      </section>

      {totalCount > 0 && (
        <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <span>{rangeStart}–{rangeEnd} de {totalCount}</span>
            <CustomSelect
              label=""
              value={String(pageSize)}
              onChange={(value) => setPageSize(Number(value))}
              options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: `${size} por página` }))}
              placeholder="Itens"
              className="min-w-32"
            />
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200"><FaChevronLeft /> Anterior</button>
            <span className="min-w-16 text-center text-xs font-semibold text-slate-500">Página {page} de {totalPages}</span>
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">Próxima <FaChevronRight /></button>
          </div>
        </div>
      )}

      {refreshing && <p className="mt-3 text-center text-[11px] text-slate-400">Atualizando dados...</p>}
    </main>
  );
};

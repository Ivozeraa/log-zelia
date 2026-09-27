import { useEffect, useMemo, useState } from "react";
import {
  FaCamera,
  FaCalendarAlt,
  FaCalendarCheck,
  FaCheckCircle,
  FaChevronLeft,
  FaChevronRight,
  FaClock,
  FaFilter,
  FaList,
  FaSearch,
  FaTimes,
  FaUserCheck,
  FaUsers,
} from "react-icons/fa";
import { Link } from "react-router-dom";
import { PageTitle } from "../components/ui/PageTitle";
import { Pagination } from "../components/ui/Pagination";
import { CustomSelect } from "../components/ui/CustomSelect";
import { supabase } from "../utils/supabase";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const today = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());

const monthStart = (dateValue) => {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(1);
  return date.toLocaleDateString("en-CA");
};

const formatDate = (value) =>
  value
    ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      })
    : "—";

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("pt-BR", {
        timeZone: "America/Fortaleza",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

const formatMonth = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR", {
    month: "long",
    year: "numeric",
  });

const methodLabel = (value) => {
  if (value === "facial") return "Facial";
  if (value === "manual") return "Manual";
  if (value === "automatico") return "Automático";
  return value || "—";
};

const useCurrentMonthRange = () => {
  const current = today();
  return { start: monthStart(current), end: current };
};

export const FrequenciaRegistros = () => {
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const currentMonth = useMemo(() => useCurrentMonthRange(), []);
  const [startDate, setStartDate] = useState(currentMonth.start);
  const [endDate, setEndDate] = useState(currentMonth.end);
  const [selectedTurma, setSelectedTurma] = useState("");
  const [selectedAlunoId, setSelectedAlunoId] = useState("");
  const [selectedAlunoNome, setSelectedAlunoNome] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [tipoFilter, setTipoFilter] = useState("");
  const [metodoFilter, setMetodoFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [view, setView] = useState("registros");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [turmas, setTurmas] = useState([]);
  const [rows, setRows] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [summary, setSummary] = useState({
    total_registros: 0,
    entradas: 0,
    saidas: 0,
    faciais: 0,
    manuais: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [details, setDetails] = useState(null);
  const [calendarRows, setCalendarRows] = useState([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

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
  }, [startDate, endDate, selectedTurma, selectedAlunoId, searchInput, statusFilter, tipoFilter, metodoFilter, view, pageSize]);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (featureLoading || !hasFeature("frequencia")) return;
      if (!startDate || !endDate || startDate > endDate) {
        setRows([]);
        setTotalCount(0);
        return;
      }

      setLoading(true);
      setError("");

      try {
        if (view === "calendario") {
          if (!selectedAlunoId) {
            setCalendarRows([]);
            setCalendarLoading(false);
            setLoading(false);
            return;
          }

          setCalendarLoading(true);
          const { data, error: queryError } = await supabase.rpc("get_frequencia_calendario_aluno", {
            p_aluno_id: selectedAlunoId,
            p_data_inicio: startDate,
            p_data_fim: endDate,
          });
          if (queryError) throw queryError;
          if (cancelled) return;
          setCalendarRows(data || []);
          setCalendarLoading(false);
          setRows([]);
          setTotalCount(0);
        } else if (view === "registros") {
          const [listRes, summaryRes] = await Promise.all([
            supabase.rpc("get_frequencia_registros", {
              p_data_inicio: startDate,
              p_data_fim: endDate,
              p_turma_id: selectedTurma || null,
              p_aluno_id: selectedAlunoId || null,
              p_search: searchInput.trim() || null,
              p_status: statusFilter || null,
              p_tipo: tipoFilter || null,
              p_metodo: metodoFilter || null,
              p_limit: pageSize,
              p_offset: (page - 1) * pageSize,
            }),
            supabase.rpc("get_frequencia_registros_resumo", {
              p_data_inicio: startDate,
              p_data_fim: endDate,
              p_turma_id: selectedTurma || null,
              p_search: searchInput.trim() || null,
              p_status: statusFilter || null,
              p_tipo: tipoFilter || null,
              p_metodo: metodoFilter || null,
            }),
          ]);

          if (listRes.error) throw listRes.error;
          if (summaryRes.error) throw summaryRes.error;
          if (cancelled) return;

          const nextRows = listRes.data || [];
          setRows(nextRows);
          setTotalCount(Number(nextRows[0]?.total_count ?? 0));
          setSummary(summaryRes.data?.[0] || {
            total_registros: 0,
            entradas: 0,
            saidas: 0,
            faciais: 0,
            manuais: 0,
          });
        } else if (view === "alunos") {
          const { data, error: queryError } = await supabase.rpc("get_frequencia_resumo_alunos", {
            p_data_inicio: startDate,
            p_data_fim: endDate,
            p_turma_id: selectedTurma || null,
            p_search: searchInput.trim() || null,
            p_limit: pageSize,
            p_offset: (page - 1) * pageSize,
          });
          if (queryError) throw queryError;
          if (cancelled) return;
          const nextRows = data || [];
          setRows(nextRows);
          setTotalCount(Number(nextRows[0]?.total_count ?? 0));
        } else {
          const { data, error: queryError } = await supabase.rpc("get_frequencia_resumo_turmas", {
            p_data_inicio: startDate,
            p_data_fim: endDate,
            p_limit: pageSize,
            p_offset: (page - 1) * pageSize,
          });
          if (queryError) throw queryError;
          if (cancelled) return;
          const nextRows = data || [];
          setRows(nextRows);
          setTotalCount(Number(nextRows[0]?.total_count ?? 0));
        }
      } catch (queryError) {
        console.error(queryError);
        if (!cancelled) {
          setRows([]);
          setTotalCount(0);
          setError("Não foi possível carregar os registros de frequência.");
        }
      } finally {
        if (!cancelled) {
          setCalendarLoading(false);
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [
    featureLoading,
    hasFeature,
    startDate,
    endDate,
    selectedTurma,
    selectedAlunoId,
    searchInput,
    statusFilter,
    tipoFilter,
    metodoFilter,
    view,
    page,
    pageSize,
  ]);

  const activeTurmaName = useMemo(
    () => turmas.find((item) => String(item.id) === String(selectedTurma))?.nome || "",
    [selectedTurma, turmas],
  );

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, page * pageSize);

  const hasActiveFilters =
    Boolean(selectedTurma) ||
    Boolean(selectedAlunoId) ||
    Boolean(searchInput.trim()) ||
    Boolean(statusFilter) ||
    Boolean(tipoFilter) ||
    Boolean(metodoFilter);

  const clearFilters = () => {
    setSelectedTurma("");
    setSelectedAlunoId("");
    setSelectedAlunoNome("");
    setSearchInput("");
    setStatusFilter("");
    setTipoFilter("");
    setMetodoFilter("");
    setPage(1);
  };

  const applyPreset = (preset) => {
    const current = today();
    if (preset === "hoje") {
      setStartDate(current);
      setEndDate(current);
    } else if (preset === "7dias") {
      const start = new Date(`${current}T12:00:00`);
      start.setDate(start.getDate() - 6);
      setStartDate(start.toLocaleDateString("en-CA"));
      setEndDate(current);
    } else if (preset === "mes_anterior") {
      const start = new Date(`${current}T12:00:00`);
      start.setMonth(start.getMonth() - 1, 1);
      const end = new Date(`${current}T12:00:00`);
      end.setDate(0);
      setStartDate(start.toLocaleDateString("en-CA"));
      setEndDate(end.toLocaleDateString("en-CA"));
    } else {
      setStartDate(monthStart(current));
      setEndDate(current);
    }
    setPage(1);
  };

  const moveMonth = (delta) => {
    const date = new Date(`${startDate}T12:00:00`);
    date.setMonth(date.getMonth() + delta, 1);
    const nextStart = date.toLocaleDateString("en-CA");
    const nextMonthEnd = new Date(date);
    nextMonthEnd.setMonth(nextMonthEnd.getMonth() + 1, 0);
    const current = today();
    const nextEnd = nextMonthEnd.toLocaleDateString("en-CA");
    setStartDate(nextStart);
    setEndDate(nextEnd > current ? current : nextEnd);
    setPage(1);
  };

  const openStudent = (row) => {
    setSelectedAlunoId(row.aluno_id);
    setSelectedAlunoNome(row.aluno_nome);
    if (row.turma_id) setSelectedTurma(row.turma_id);

    const selectedMonth = monthStart(startDate);
    const selectedMonthEnd = new Date(`${selectedMonth}T12:00:00`);
    selectedMonthEnd.setMonth(selectedMonthEnd.getMonth() + 1, 0);
    const current = today();

    setStartDate(selectedMonth);
    setEndDate(selectedMonthEnd.toLocaleDateString("en-CA") > current ? current : selectedMonthEnd.toLocaleDateString("en-CA"));
    setView("calendario");
    setPage(1);
  };

  const openTurma = (row) => {
    setSelectedTurma(row.turma_id);
    setSelectedAlunoId("");
    setSelectedAlunoNome("");
    setView("registros");
    setPage(1);
  };

  const calendarMonthStart = useMemo(() => monthStart(startDate), [startDate]);
  const calendarCells = useMemo(() => {
    const month = new Date(`${calendarMonthStart}T12:00:00`);
    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = (month.getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cells = Array.from({ length: firstWeekday }, (_, index) => ({ key: `empty-${index}`, empty: true }));
    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, monthIndex, day, 12);
      const value = date.toLocaleDateString("en-CA");
      const record = calendarRows.find((item) => item.data === value);
      const status = record?.status || (value > today() ? "futuro" : date.getDay() === 0 || date.getDay() === 6 ? "fim_de_semana" : "falta");
      cells.push({ key: value, value, day, record, status });
    }
    return cells;
  }, [calendarMonthStart, calendarRows]);

  const calendarStats = useMemo(() => {
    const uteis = calendarRows.filter((item) => item.eh_dia_util && item.status !== "futuro");
    const presentes = uteis.filter((item) => item.status === "presente").length;
    const faltas = uteis.filter((item) => item.status === "falta").length;
    return {
      uteis: uteis.length,
      presentes,
      faltas,
      percentual: uteis.length ? Math.round((presentes / uteis.length) * 100) : 0,
    };
  }, [calendarRows]);

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageTitle
          title="Registros de frequência"
          subtitle="Consulte entradas e saídas por período, turma ou aluno."
        />
        <div className="flex flex-wrap gap-2">
          <Link
            to="/app/frequencia"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <FaUserCheck /> Frequência de hoje
          </Link>
          <Link
            to="/app/frequencia/ponto"
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-green-600 px-3 text-xs font-semibold text-white hover:bg-green-700"
          >
            <FaCamera /> Terminal
          </Link>
        </div>
      </div>

      <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => applyPreset("hoje")} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Hoje</button>
          <button type="button" onClick={() => applyPreset("7dias")} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">7 dias</button>
          <button type="button" onClick={() => applyPreset("mes")} className="rounded-full bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700">Este mês</button>
          <button type="button" onClick={() => applyPreset("mes_anterior")} className="rounded-full border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Mês anterior</button>
        </div>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end">
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            De
            <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
          </label>
          <label className="min-w-0 flex-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
            Até
            <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
          </label>
          <button type="button" onClick={() => moveMonth(-1)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Mês anterior"><FaChevronLeft /></button>
          <div className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-center dark:border-slate-700 dark:bg-slate-950">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Período</p>
            <p className="truncate text-sm font-bold capitalize text-slate-800 dark:text-slate-100">{formatMonth(startDate)}</p>
          </div>
          <button type="button" onClick={() => moveMonth(1)} className="min-h-11 rounded-xl border border-slate-300 px-3 text-slate-600 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" aria-label="Próximo mês"><FaChevronRight /></button>
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,220px)_auto]">
          <div className="relative">
            <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar aluno por nome ou matrícula..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
          </div>
          <CustomSelect
            label="Turma"
            value={selectedTurma}
            onChange={(value) => { setSelectedTurma(value); setSelectedAlunoId(""); setSelectedAlunoNome(""); }}
            options={[
              { value: "", label: "Todas as turmas" },
              ...turmas.map((turma) => ({ value: turma.id, label: turma.nome })),
            ]}
            placeholder="Todas as turmas"
            showSearch
          />
          <button type="button" onClick={() => setShowFilters((current) => !current)} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold ${showFilters || hasActiveFilters ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950/20 dark:text-green-300" : "border-slate-300 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"}`}>
            <FaFilter /> Filtros {hasActiveFilters ? "•" : ""}
          </button>
        </div>

        {selectedAlunoId && (
          <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-green-200 bg-green-50 px-3 py-2.5 text-xs text-green-800 dark:border-green-900/50 dark:bg-green-950/20 dark:text-green-200">
            <span>Aluno: <strong>{selectedAlunoNome || "selecionado"}</strong></span>
            <button type="button" onClick={() => { setSelectedAlunoId(""); setSelectedAlunoNome(""); }} className="rounded-lg p-1 hover:bg-green-100 dark:hover:bg-green-900/30" aria-label="Remover filtro de aluno"><FaTimes /></button>
          </div>
        )}

        {showFilters && (
          <div className="mt-3 grid gap-3 border-t border-slate-100 pt-3 dark:border-slate-800 md:grid-cols-3">
            <CustomSelect
              label="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: "", label: "Todos os status" },
                { value: "registrado", label: "Registrado" },
              ]}
              placeholder="Todos os status"
            />
            <CustomSelect
              label="Tipo"
              value={tipoFilter}
              onChange={setTipoFilter}
              options={[
                { value: "", label: "Entrada e saída" },
                { value: "entrada", label: "Entradas" },
                { value: "saida", label: "Saídas" },
              ]}
              placeholder="Entrada e saída"
            />
            <CustomSelect
              label="Método"
              value={metodoFilter}
              onChange={setMetodoFilter}
              options={[
                { value: "", label: "Todos os métodos" },
                { value: "facial", label: "Facial" },
                { value: "manual", label: "Manual" },
                { value: "automatico", label: "Automático" },
              ]}
              placeholder="Todos os métodos"
            />
            <div className="md:col-span-3 flex justify-end">
              <button type="button" onClick={clearFilters} className="rounded-xl border border-slate-300 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Limpar filtros</button>
            </div>
          </div>
        )}
      </section>

      {view === "registros" && (
      <section className="mt-5 grid gap-3 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <FaList className="text-slate-400" />
          <p className="mt-2 text-xs text-slate-500">Registros</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{Number(summary.total_registros || 0)}</p>
        </div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20">
          <FaUserCheck className="text-green-600" />
          <p className="mt-2 text-xs text-green-700 dark:text-green-300">Entradas</p>
          <p className="text-2xl font-black text-green-800 dark:text-green-200">{Number(summary.entradas || 0)}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900">
          <FaClock className="text-slate-400" />
          <p className="mt-2 text-xs text-slate-500">Saídas</p>
          <p className="text-2xl font-black text-slate-900 dark:text-white">{Number(summary.saidas || 0)}</p>
        </div>
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-900/50 dark:bg-indigo-950/20">
          <FaCamera className="text-indigo-500" />
          <p className="mt-2 text-xs text-indigo-700 dark:text-indigo-300">Faciais</p>
          <p className="text-2xl font-black text-indigo-800 dark:text-indigo-200">{Number(summary.faciais || 0)}</p>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20">
          <FaUsers className="text-amber-600" />
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Manuais</p>
          <p className="text-2xl font-black text-amber-800 dark:text-amber-200">{Number(summary.manuais || 0)}</p>
        </div>
      </section>

      )}

      <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
        {[
          ["registros", "Registros"],
          ["alunos", "Por aluno"],
          ["calendario", "Calendário"],
          ["turmas", "Por turma"],
        ].map(([value, label]) => (
          <button key={value} type="button" onClick={() => { setView(value); setPage(1); }} className={`rounded-xl px-4 py-2.5 text-xs font-semibold ${view === value ? "bg-green-600 text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"}`}>
            {label}
          </button>
        ))}
        <span className="ml-auto px-2 text-xs text-slate-400">
          {view === "registros"
            ? activeTurmaName || "Todas as turmas"
            : view === "alunos"
              ? "Resumo por aluno"
              : view === "calendario"
                ? selectedAlunoNome || "Selecione um aluno"
                : "Resumo por turma"}
        </span>
      </div>

      {error && <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}

      {view === "calendario" && (
        <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-5">
          {!selectedAlunoId ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
              <FaCalendarAlt className="mx-auto text-3xl text-slate-300" />
              <p className="mt-3 font-semibold text-slate-800 dark:text-slate-100">Selecione um aluno para visualizar o calendário</p>
              <p className="mt-1 text-sm text-slate-500">Use a visão “Por aluno” e toque no nome do aluno.</p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Calendário de frequência</p>
                  <h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{selectedAlunoNome || "Aluno selecionado"}</h2>
                  <p className="mt-1 text-sm text-slate-500">Dias úteis sem registro são indicados como falta. Feriados e recessos ainda não estão cadastrados no calendário escolar.</p>
                </div>
                <CustomSelect
                  label="Período"
                  value={calendarMonthStart}
                  onChange={(value) => {
                    const next = new Date(`${value}T12:00:00`);
                    const nextEnd = new Date(next);
                    nextEnd.setMonth(nextEnd.getMonth() + 1, 0);
                    const current = today();
                    setStartDate(value);
                    setEndDate(nextEnd.toLocaleDateString("en-CA") > current ? current : nextEnd.toLocaleDateString("en-CA"));
                  }}
                  options={[
                    { value: monthStart(today()), label: "Este mês" },
                    ...Array.from({ length: 11 }, (_, index) => {
                      const date = new Date(`${monthStart(today())}T12:00:00`);
                      date.setMonth(date.getMonth() - index - 1, 1);
                      const value = date.toLocaleDateString("en-CA");
                      return { value, label: formatMonth(value) };
                    }),
                  ]}
                  placeholder="Selecione o mês"
                />
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950"><p className="text-xs text-slate-500">Dias úteis</p><p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{calendarStats.uteis}</p></div>
                <div className="rounded-2xl border border-green-200 bg-green-50 p-3 dark:border-green-900/50 dark:bg-green-950/20"><p className="text-xs text-green-700 dark:text-green-300">Presenças</p><p className="mt-1 text-2xl font-black text-green-800 dark:text-green-200">{calendarStats.presentes}</p></div>
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 dark:border-red-900/50 dark:bg-red-950/20"><p className="text-xs text-red-700 dark:text-red-300">Faltas</p><p className="mt-1 text-2xl font-black text-red-800 dark:text-red-200">{calendarStats.faltas}</p></div>
                <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-900/50 dark:bg-indigo-950/20"><p className="text-xs text-indigo-700 dark:text-indigo-300">Frequência</p><p className="mt-1 text-2xl font-black text-indigo-800 dark:text-indigo-200">{calendarStats.percentual}%</p></div>
              </div>

              {calendarLoading ? (
                <div className="mt-5 rounded-2xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700">Carregando calendário...</div>
              ) : (
                <div className="mt-5">
                  <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-400 sm:gap-2 sm:text-xs">
                    {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((day) => <div key={day} className="py-2">{day}</div>)}
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                    {calendarCells.map((cell) => cell.empty ? (
                      <div key={cell.key} />
                    ) : (
                      <div
                        key={cell.key}
                        title={cell.status === "presente" ? `Presente · ${formatTime(cell.record?.entrada)}` : cell.status === "falta" ? "Falta" : cell.status === "fim_de_semana" ? "Fim de semana" : "Ainda não ocorrido"}
                        className={`min-h-14 rounded-xl border p-1.5 text-left transition sm:min-h-20 sm:p-2 ${
                          cell.status === "presente"
                            ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-950/20"
                            : cell.status === "falta"
                              ? "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20"
                              : cell.status === "fim_de_semana"
                                ? "border-slate-100 bg-slate-50 dark:border-slate-800 dark:bg-slate-950"
                                : "border-slate-100 bg-white dark:border-slate-800 dark:bg-slate-900"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{cell.day}</span>
                          {cell.status === "presente" && <FaCalendarCheck className="text-[10px] text-green-600" />}
                          {cell.status === "falta" && <span className="text-[9px] font-black text-red-600">F</span>}
                        </div>
                        <p className="mt-1 hidden text-[10px] font-semibold sm:block">
                          {cell.status === "presente" ? `Entrada ${formatTime(cell.record?.entrada)}` : cell.status === "falta" ? "Falta" : cell.status === "fim_de_semana" ? "Fim de semana" : "—"}
                        </p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-3 text-[11px] text-slate-500">
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-green-100" /> Presente</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-red-100" /> Falta</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-slate-100" /> Fim de semana</span>
                    <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded border border-slate-200 bg-white" /> Futuro</span>
                  </div>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        {view === "registros" && (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[920px] text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Data</th>
                    <th className="px-4 py-3 font-semibold">Aluno</th>
                    <th className="px-4 py-3 font-semibold">Turma</th>
                    <th className="px-4 py-3 font-semibold">Tipo</th>
                    <th className="px-4 py-3 font-semibold">Horário</th>
                    <th className="px-4 py-3 font-semibold">Método</th>
                    <th className="px-4 py-3 font-semibold">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-500">Carregando registros...</td></tr>
                  ) : rows.length === 0 ? (
                    <tr><td colSpan="7" className="px-4 py-10 text-center text-slate-500">Nenhum registro encontrado neste período.</td></tr>
                  ) : rows.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatDate(row.data)}</td>
                      <td className="px-4 py-3"><button type="button" onClick={() => openStudent(row)} className="font-semibold text-slate-900 hover:text-green-700 dark:text-white dark:hover:text-green-300">{row.aluno_nome}</button><p className="text-xs text-slate-400">{row.matricula || "Sem matrícula"}</p></td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.turma_nome}</td>
                      <td className="px-4 py-3"><span className={row.tipo === "entrada" ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"}>{row.tipo === "entrada" ? "Entrada" : "Saída"}</span></td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTime(row.registrado_em)}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{methodLabel(row.metodo)}</td>
                      <td className="px-4 py-3"><button type="button" onClick={() => setDetails(row)} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">Ver</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-2 p-3 md:hidden">
              {loading ? <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Carregando registros...</div> : rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum registro encontrado.</div> : rows.map((row) => (
                <button key={row.id} type="button" onClick={() => setDetails(row)} className="w-full rounded-2xl border border-slate-200 p-4 text-left dark:border-slate-700">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="truncate font-semibold text-slate-900 dark:text-white">{row.aluno_nome}</p><p className="mt-1 text-xs text-slate-500">{row.turma_nome} · {formatDate(row.data)}</p></div>
                    <span className={row.tipo === "entrada" ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700" : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"}>{row.tipo === "entrada" ? "Entrada" : "Saída"}</span>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500"><span>{formatTime(row.registrado_em)}</span><span>{methodLabel(row.metodo)}</span></div>
                </button>
              ))}
            </div>
          </>
        )}

        {view === "alunos" && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
                <tr><th className="px-4 py-3 font-semibold">Aluno</th><th className="px-4 py-3 font-semibold">Turma</th><th className="px-4 py-3 font-semibold">Dias com entrada</th><th className="px-4 py-3 font-semibold">Entradas</th><th className="px-4 py-3 font-semibold">Saídas</th><th className="px-4 py-3 font-semibold">Último registro</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {loading ? <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">Carregando resumo...</td></tr> : rows.length === 0 ? <tr><td colSpan="6" className="px-4 py-10 text-center text-slate-500">Nenhum aluno encontrado.</td></tr> : rows.map((row) => (
                  <tr key={row.aluno_id}>
                    <td className="px-4 py-3"><button type="button" onClick={() => openStudent(row)} className="font-semibold text-slate-900 hover:text-green-700 dark:text-white dark:hover:text-green-300">{row.aluno_nome}</button><p className="text-xs text-slate-400">{row.matricula || "Sem matrícula"}</p></td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.turma_nome}</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{row.dias_com_entrada}</td>
                    <td className="px-4 py-3 text-green-700 dark:text-green-300">{row.entradas}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.saidas}</td>
                    <td className="px-4 py-3 text-slate-500">{row.ultimo_registro ? new Date(row.ultimo_registro).toLocaleString("pt-BR", { timeZone: "America/Fortaleza", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {view === "turmas" && (
          <div className="space-y-2 p-3">
            {loading ? <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Carregando turmas...</div> : rows.length === 0 ? <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhuma turma encontrada.</div> : rows.map((row) => (
              <div key={row.turma_id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div><button type="button" onClick={() => openTurma(row)} className="font-semibold text-slate-900 hover:text-green-700 dark:text-white dark:hover:text-green-300">{row.turma_nome}</button><p className="mt-1 text-xs text-slate-500">{row.total_alunos} alunos</p></div>
                <div className="grid grid-cols-3 gap-3 text-center text-xs"><div><p className="text-slate-400">Entradas</p><p className="font-bold text-green-700 dark:text-green-300">{row.entradas}</p></div><div><p className="text-slate-400">Saídas</p><p className="font-bold text-slate-700 dark:text-slate-200">{row.saidas}</p></div><div><p className="text-slate-400">Alunos c/ entrada</p><p className="font-bold text-slate-800 dark:text-white">{row.alunos_com_entrada}</p></div></div>
              </div>
            ))}
          </div>
        )}
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
            <button type="button" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page === 1} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">‹ Anterior</button>
            <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            <button type="button" onClick={() => setPage((value) => Math.min(totalPages, value + 1))} disabled={page === totalPages} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">Próxima ›</button>
          </div>
        </div>
      )}

      {details && (
        <div className="fixed inset-0 z-[100000] flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Detalhes do registro</p><h2 className="mt-1 text-xl font-black text-slate-900 dark:text-white">{details.aluno_nome}</h2><p className="mt-1 text-sm text-slate-500">{details.turma_nome}</p></div>
              <button type="button" onClick={() => setDetails(null)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Fechar"><FaTimes /></button>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] uppercase text-slate-400">Data</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{formatDate(details.data)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] uppercase text-slate-400">Horário</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{formatTime(details.registrado_em)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] uppercase text-slate-400">Tipo</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{details.tipo === "entrada" ? "Entrada" : "Saída"}</p></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] uppercase text-slate-400">Método</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{methodLabel(details.metodo)}</p></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] uppercase text-slate-400">Ponto</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{details.ponto_nome || "Não informado"}</p></div>
              <div className="rounded-xl bg-slate-50 p-3 dark:bg-slate-950"><p className="text-[10px] uppercase text-slate-400">Status</p><p className="mt-1 font-semibold text-slate-800 dark:text-white">{details.status || "—"}</p></div>
            </div>
            <button type="button" onClick={() => setDetails(null)} className="mt-5 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-semibold text-white hover:bg-green-700"><FaCheckCircle /> Fechar</button>
          </div>
        </div>
      )}
    </main>
  );
};

import { useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaClock, FaSignOutAlt, FaUsers } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";

const formatTime = (value) =>
  value
    ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : "—";

const today = () => new Date().toISOString().slice(0, 10);

export const Frequencia = () => {
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [date, setDate] = useState(today());
  const [rows, setRows] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (featureLoading || !hasFeature("frequencia")) return;

    const load = async () => {
      setLoading(true);
      setError("");

      const { data, error: queryError } = await supabase.rpc("get_frequencia_professor", {
        p_data: date,
      });

      if (queryError) {
        console.error(queryError);
        setError("Não foi possível carregar a frequência das suas turmas.");
        setRows([]);
        setLoading(false);
        return;
      }

      const nextRows = data || [];
      const nextTurmas = [...new Map(
        nextRows.map((row) => [row.turma_id, { id: row.turma_id, nome: row.turma_nome }]),
      ).values()].sort((a, b) => a.nome.localeCompare(b.nome));

      setTurmas(nextTurmas);
      setRows(nextRows);
      setLoading(false);
    };

    void load();
  }, [date, featureLoading, hasFeature]);

  const visibleRows = useMemo(
    () => selectedTurma ? rows.filter((row) => row.turma_id === selectedTurma) : rows,
    [rows, selectedTurma],
  );

  const stats = useMemo(() => {
    const presentes = visibleRows.filter((row) => row.entrada && (!row.saida || new Date(row.entrada) > new Date(row.saida))).length;
    const saidas = visibleRows.filter((row) => row.saida && (!row.entrada || new Date(row.saida) >= new Date(row.entrada))).length;
    return {
      total: visibleRows.length,
      presentes,
      saidas,
      naoRegistrados: visibleRows.filter((row) => !row.entrada && !row.saida).length,
    };
  }, [visibleRows]);

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <PageTitle title="Frequência" subtitle="Acompanhe os registros de entrada e saída das suas turmas." />

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Data
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          />
        </label>

        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">
          Turma
          <select
            value={selectedTurma}
            onChange={(event) => setSelectedTurma(event.target.value)}
            className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"
          >
            <option value="">Todas as minhas turmas</option>
            {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
          </select>
        </label>
      </div>

      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><FaUsers className="text-slate-500" /><p className="mt-2 text-sm text-slate-500">Alunos</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p></div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20"><FaCheckCircle className="text-green-600" /><p className="mt-2 text-sm text-green-700 dark:text-green-300">Presentes</p><p className="text-2xl font-black text-green-800 dark:text-green-200">{stats.presentes}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><FaSignOutAlt className="text-slate-500" /><p className="mt-2 text-sm text-slate-500">Com saída registrada</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.saidas}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><FaClock className="text-amber-600" /><p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Não registrados</p><p className="text-2xl font-black text-amber-800 dark:text-amber-200">{stats.naoRegistrados}</p></div>
      </section>

      {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}

      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950">
              <tr><th className="px-4 py-3 font-semibold">Aluno</th><th className="px-4 py-3 font-semibold">Turma</th><th className="px-4 py-3 font-semibold">Entrada</th><th className="px-4 py-3 font-semibold">Saída</th><th className="px-4 py-3 font-semibold">Status</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr>
              ) : visibleRows.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">Nenhum aluno encontrado para este filtro.</td></tr>
              ) : visibleRows.map((row) => {
                const presente = row.entrada && (!row.saida || new Date(row.entrada) > new Date(row.saida));
                const status = presente ? "Presente" : row.saida ? "Fora da escola" : "Não registrado";
                const statusClass = presente
                  ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700"
                  : row.saida
                    ? "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                    : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700";

                return (
                  <tr key={row.aluno_id}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.aluno_nome}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{row.turma_nome}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTime(row.entrada)}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTime(row.saida)}</td>
                    <td className="px-4 py-3"><span className={statusClass}>{status}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
};

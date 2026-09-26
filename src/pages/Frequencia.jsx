import { useEffect, useMemo, useState } from "react";
import { FaCheckCircle, FaClock, FaSignOutAlt, FaUsers } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";

const formatTime = (value) => value ? new Date(value).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—";
const today = () => new Date().toISOString().slice(0, 10);

export const Frequencia = () => {
  const { user } = useAuth();
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [date, setDate] = useState(today());
  const [turmas, setTurmas] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    if (!user?.id || !hasFeature("frequencia")) return;
    setLoading(true);
    setError("");
    try {
      const { data: professor, error: professorError } = await supabase.from("horario_professores").select("id").eq("usuario_id", user.id).limit(1).maybeSingle();
      if (professorError) throw professorError;
      if (!professor?.id) { setTurmas([]); setRows([]); return; }

      const { data: grade, error: gradeError } = await supabase.from("horario_grade_gerada").select("config_turma_id, horario_config_turmas(turma_id)").eq("professor_id", professor.id);
      if (gradeError) throw gradeError;

      const turmaIds = [...new Set((grade || []).map((item) => item.horario_config_turmas?.turma_id).filter(Boolean))];
      if (!turmaIds.length) { setTurmas([]); setRows([]); return; }

      const { data: turmaData, error: turmaError } = await supabase.from("turmas").select("id, nome").in("id", turmaIds).order("nome");
      if (turmaError) throw turmaError;
      setTurmas(turmaData || []);

      const allowedIds = selectedTurma ? turmaIds.filter((id) => id === selectedTurma) : turmaIds;
      const { data: students, error: studentsError } = await supabase.from("alunos").select("id, nome, turma_id").in("turma_id", allowedIds).order("nome");
      if (studentsError) throw studentsError;

      const { data: access, error: accessError } = await supabase.from("registros_acesso").select("id, aluno_id, tipo, metodo, status, registrado_em, confidence_score").eq("data", date).eq("status", "registrado").in("aluno_id", (students || []).map((item) => item.id)).order("registrado_em", { ascending: true });
      if (accessError) throw accessError;

      const events = new Map();
      (access || []).forEach((event) => {
        const list = events.get(event.aluno_id) || [];
        list.push(event);
        events.set(event.aluno_id, list);
      });

      setRows((students || []).map((student) => {
        const list = events.get(student.id) || [];
        const entry = list.find((event) => event.tipo === "entrada");
        const exits = list.filter((event) => event.tipo === "saida");
        const lastExit = exits.at(-1);
        const present = entry && (!lastExit || new Date(entry.registrado_em) > new Date(lastExit.registrado_em));
        return { ...student, entrada: entry?.registrado_em || null, saida: lastExit?.registrado_em || null, status: present ? "Presente" : lastExit ? "Fora da escola" : "Não registrado" };
      }));
    } catch (err) {
      console.error(err);
      setError("Não foi possível carregar a frequência desta turma.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.id, date, selectedTurma]);

  const stats = useMemo(() => ({
    total: rows.length,
    presentes: rows.filter((row) => row.status === "Presente").length,
    saidas: rows.filter((row) => row.status === "Fora da escola").length,
    naoRegistrados: rows.filter((row) => row.status === "Não registrado").length,
  }), [rows]);

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <PageTitle title="Frequência" subtitle="Acompanhe os registros de entrada e saída das suas turmas." />
      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Data<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white" /></label>
        <label className="text-sm font-semibold text-slate-700 dark:text-slate-200">Turma<select value={selectedTurma} onChange={(event) => setSelectedTurma(event.target.value)} className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-3 font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-900 dark:text-white"><option value="">Todas as minhas turmas</option>{turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}</select></label>
      </div>
      <section className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><FaUsers className="text-slate-500" /><p className="mt-2 text-sm text-slate-500">Alunos</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.total}</p></div>
        <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20"><FaCheckCircle className="text-green-600" /><p className="mt-2 text-sm text-green-700 dark:text-green-300">Presentes</p><p className="text-2xl font-black text-green-800 dark:text-green-200">{stats.presentes}</p></div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900"><FaSignOutAlt className="text-slate-500" /><p className="mt-2 text-sm text-slate-500">Fora da escola</p><p className="text-2xl font-black text-slate-900 dark:text-white">{stats.saidas}</p></div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-950/20"><FaClock className="text-amber-600" /><p className="mt-2 text-sm text-amber-700 dark:text-amber-300">Não registrados</p><p className="text-2xl font-black text-amber-800 dark:text-amber-200">{stats.naoRegistrados}</p></div>
      </section>
      {error && <div className="mt-5 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}
      <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-950"><tr><th className="px-4 py-3 font-semibold">Aluno</th><th className="px-4 py-3 font-semibold">Turma</th><th className="px-4 py-3 font-semibold">Entrada</th><th className="px-4 py-3 font-semibold">Saída</th><th className="px-4 py-3 font-semibold">Status</th></tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">Carregando...</td></tr> : rows.length === 0 ? <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-500">Nenhum aluno com registro para este filtro.</td></tr> : rows.map((row) => {
              const turma = turmas.find((item) => item.id === row.turma_id);
              return <tr key={row.id}><td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.nome}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{turma?.nome || "—"}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTime(row.entrada)}</td><td className="px-4 py-3 text-slate-600 dark:text-slate-300">{formatTime(row.saida)}</td><td className="px-4 py-3"><span className={row.status === "Presente" ? "rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700" : row.status === "Fora da escola" ? "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700" : "rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-700"}>{row.status}</span></td></tr>;
            })}
          </tbody>
        </table></div>
      </section>
    </main>
  );
};
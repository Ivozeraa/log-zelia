import { useEffect, useMemo, useState } from "react";
import { FaCamera, FaCheckCircle, FaDoorOpen, FaSearch, FaSignInAlt, FaSignOutAlt, FaSyncAlt } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { useSchool } from "../hooks/useSchool";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";
import { notify } from "../utils/notify";
import { FrequenciaCamera } from "./FrequenciaCamera";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
export const FrequenciaPonto = () => {
  const { user } = useAuth();
  const { schoolId } = useSchool();
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [students, setStudents] = useState([]);
  const [access, setAccess] = useState([]);
  const [points, setPoints] = useState([]);
  const [pointId, setPointId] = useState("");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [showCamera, setShowCamera] = useState(false);
  const [pendingAttendance, setPendingAttendance] = useState(null);
  const [recentConfirmation, setRecentConfirmation] = useState(null);
  const load = async () => {
    if (!schoolId || !hasFeature("frequencia")) return;
    setLoading(true);
    setError("");

    const [studentsRes, accessRes, pointsRes] = await Promise.all([
      supabase.from("alunos").select("id, nome, turma_id").eq("escola_id", schoolId).order("nome"),
      supabase.from("registros_acesso").select("id, aluno_id, tipo, metodo, registrado_em").eq("data", today()).eq("status", "registrado").eq("escola_id", schoolId).order("registrado_em", { ascending: true }),
      supabase.from("pontos_verificacao").select("id, nome, local, ativo").eq("escola_id", schoolId).eq("ativo", true).order("nome"),
    ]);

    if (studentsRes.error || accessRes.error || pointsRes.error) {
      console.error(studentsRes.error || accessRes.error || pointsRes.error);
      setError("Não foi possível carregar o ponto de frequência.");
      setLoading(false);
      return;
    }

    setStudents(studentsRes.data || []);
    setAccess(accessRes.data || []);
    setPoints(pointsRes.data || []);
    setPointId((current) => current || pointsRes.data?.[0]?.id || "");
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [schoolId, featureLoading]);

  const refreshAccess = async () => {
    if (!schoolId) return;
    setRefreshing(true);
    try {
      const [accessRes, pointsRes] = await Promise.all([
        supabase.from("registros_acesso").select("id, aluno_id, tipo, metodo, registrado_em").eq("data", today()).eq("status", "registrado").eq("escola_id", schoolId).order("registrado_em", { ascending: true }),
        supabase.from("pontos_verificacao").select("id, nome, local, ativo").eq("escola_id", schoolId).eq("ativo", true).order("nome"),
      ]);
      if (accessRes.error || pointsRes.error) throw accessRes.error || pointsRes.error;
      setAccess(accessRes.data || []);
      setPoints(pointsRes.data || []);
      setPointId((current) => current || pointsRes.data?.[0]?.id || "");
    } catch (refreshError) {
      console.error(refreshError);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (!schoolId || !hasFeature("frequencia")) return undefined;
    const interval = window.setInterval(() => void refreshAccess(), 15000);
    return () => window.clearInterval(interval);
  }, [schoolId, featureLoading]);

  const visibleStudents = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    const filtered = normalized
      ? students.filter((student) => student.nome.toLocaleLowerCase("pt-BR").includes(normalized))
      : students;

    return filtered.slice(0, 30).map((student) => {
      const events = access.filter((event) => event.aluno_id === student.id);
      const last = events.at(-1);
      return { ...student, lastEvent: last || null, active: last?.tipo === "entrada" };
    });
  }, [students, access, query]);

  const register = async (student, type) => {
    setSavingId(student.id);

    const { data, error: rpcError } = await supabase.rpc("registrar_acesso_frequencia", {
      p_aluno_id: student.id,
      p_tipo: type,
      p_metodo: "manual",
      p_ponto_id: pointId || null,
      p_confidence_score: null,
    });

    if (rpcError) {
      notify.error(rpcError.message || "Não foi possível registrar o acesso.");
      setSavingId("");
      return false;
    }

    setAccess((current) => [...current, data]);
    setRecentConfirmation({ studentName: student.nome, type, at: new Date().toISOString() });
    notify.success(type === "entrada" ? `${student.nome} entrou.` : `${student.nome} saiu.`);
    setSavingId("");
    return true;
  };

  const openCameraFor = (student, type) => {
    setPendingAttendance({ student, type });
    setShowCamera(true);
  };

  const confirmCameraAttendance = async () => {
    if (!pendingAttendance || savingId) return false;
    const { student, type } = pendingAttendance;
    const registered = await register(student, type);
    if (registered) {
      setPendingAttendance(null);
    }
    return registered;
  };

  const totalStudents = students.length;
  const presentStudents = students.filter((student) => access.some((event) => event.aluno_id === student.id && event.tipo === "entrada") && (() => {
    const events = access.filter((event) => event.aluno_id === student.id);
    return events.at(-1)?.tipo === "entrada";
  })()).length;
  const exitedStudents = students.filter((student) => {
    const events = access.filter((event) => event.aluno_id === student.id);
    return events.at(-1)?.tipo === "saida";
  }).length;
  const registeredStudents = new Set(access.map((event) => event.aluno_id)).size;

  useEffect(() => {
    if (!recentConfirmation) return undefined;
    const timer = window.setTimeout(() => setRecentConfirmation(null), 3000);
    return () => window.clearTimeout(timer);
  }, [recentConfirmation]);

  if (featureLoading || !hasFeature("frequencia")) return null;

  if (showCamera) {
    return (
      <FrequenciaCamera
        onClose={() => {
          setShowCamera(false);
          setPendingAttendance(null);
        }}
        studentName={pendingAttendance?.student?.nome}
        attendanceType={pendingAttendance?.type}
        onConfirm={pendingAttendance ? confirmCameraAttendance : undefined}
        confirming={Boolean(pendingAttendance && savingId === pendingAttendance.student.id)}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-7xl overflow-x-hidden px-3 py-3 sm:px-6 sm:py-6">
      <PageTitle title="Ponto de frequência" subtitle="Selecione o aluno e use a câmera para validar o enquadramento antes de confirmar o registro." />

      {recentConfirmation && (
        <div className="mt-4 flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-200">
          <FaCheckCircle className="shrink-0 text-lg" />
          <div className="min-w-0">
            <p className="font-bold">Registro confirmado</p>
            <p className="truncate text-sm">
              {recentConfirmation.studentName} · {recentConfirmation.type === "entrada" ? "Entrada" : "Saída"} às {new Date(recentConfirmation.at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
        </div>
      )}

      <div className="mt-4 grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-5">
        <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between sm:pb-5">
            <button type="button" onClick={() => void refreshAccess()} disabled={refreshing} className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800">
              <FaSyncAlt className={refreshing ? "animate-spin" : ""} /> Atualizar
            </button>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoje</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Registro manual</h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 dark:bg-green-950/20 dark:text-green-300">
              <FaCheckCircle /> Operacional
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs text-slate-500">Alunos</p><p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{totalStudents}</p></div>
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-950/20"><p className="text-xs text-green-700 dark:text-green-300">Presentes</p><p className="mt-1 text-2xl font-black text-green-800 dark:text-green-200">{presentStudents}</p></div>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700"><p className="text-xs text-slate-500">Saídas</p><p className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{exitedStudents}</p></div>
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-900/50 dark:bg-blue-950/20"><p className="text-xs text-blue-700 dark:text-blue-300">Registrados</p><p className="mt-1 text-2xl font-black text-blue-800 dark:text-blue-200">{registeredStudents}</p></div>
          </div>

          <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:gap-3">
            <div className="relative flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno pelo nome..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
            </div>
            <select value={pointId} onChange={(event) => setPointId(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white sm:w-auto sm:min-w-40">
              <option value="">Ponto padrão</option>
              {points.map((point) => <option key={point.id} value={point.id}>{point.nome}</option>)}
            </select>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="py-10 text-center text-sm text-slate-500">Carregando alunos...</div>
            ) : visibleStudents.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum aluno encontrado.</div>
            ) : visibleStudents.map((student) => (
              <div key={student.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate font-semibold text-slate-900 dark:text-white">{student.nome}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {student.lastEvent ? `${student.lastEvent.tipo === "entrada" ? "Entrada" : "Saída"} às ${new Date(student.lastEvent.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} · ${student.lastEvent.metodo}` : "Nenhum registro hoje"}
                  </p>
                </div>
                <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                  {student.active ? (
                    <>
                      <button type="button" disabled={savingId === student.id} onClick={() => void register(student, "saida")} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700 sm:w-auto sm:flex-none">
                        <FaSignOutAlt /> Saída
                      </button>
                      <button type="button" disabled={savingId === student.id} onClick={() => openCameraFor(student, "saida")} aria-label={`Validar saída de ${student.nome} pela câmera`} className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <FaCamera />
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" disabled={savingId === student.id} onClick={() => void register(student, "entrada")} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 sm:w-auto sm:flex-none">
                        <FaSignInAlt /> Entrada
                      </button>
                      <button type="button" disabled={savingId === student.id} onClick={() => openCameraFor(student, "entrada")} aria-label={`Validar entrada de ${student.nome} pela câmera`} className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                        <FaCamera />
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 p-5 shadow-sm dark:border-slate-700">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-green-500/15 text-green-500">
                <FaCamera className="text-xl" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-white">Câmera de presença</h3>
                <p className="mt-1 text-sm leading-5 text-slate-400">
                  Use a câmera para validar o enquadramento antes de confirmar o registro do aluno selecionado.
                </p>
              </div>
            </div>
            <button type="button" onClick={() => setShowCamera(true)} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-green-700">
              <FaCamera /> Abrir câmera
            </button>
            <p className="mt-3 text-center text-[11px] text-slate-500">
              A câmera não identifica o aluno: a seleção continua sendo feita manualmente.
            </p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-5 dark:border-green-900/50 dark:bg-green-950/20">
            <div className="flex items-center gap-2 text-green-700 dark:text-green-300"><FaDoorOpen /><span className="font-semibold">Fluxo</span></div>
            <ol className="mt-3 space-y-2 text-sm text-green-900/80 dark:text-green-200/80">
              <li>1. Identificar o aluno</li>
              <li>2. Validar presença</li>
              <li>3. Registrar entrada ou saída</li>
              <li>4. Encerrar automaticamente às 16:40</li>
            </ol>
          </div>
        </aside>
      </div>
    </main>
  );
};

import { useEffect, useMemo, useRef, useState } from "react";
import { FaCamera, FaCheckCircle, FaDoorOpen, FaSearch, FaSignInAlt, FaSignOutAlt, FaSyncAlt, FaStop } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { useAuth } from "../hooks/useAuth";
import { useSchool } from "../hooks/useSchool";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";
import { notify } from "../utils/notify";

const today = () => new Date().toISOString().slice(0, 10);

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
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const [error, setError] = useState("");
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  };

  const startCamera = async () => {
    setCameraError("");
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este navegador ou dispositivo não disponibiliza acesso à câmera.");
      return;
    }

    stopCamera();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (cameraErr) {
      console.error(cameraErr);
      setCameraError(
        cameraErr?.name === "NotAllowedError"
          ? "Permissão da câmera negada. Libere o acesso à câmera nas configurações do navegador."
          : "Não foi possível iniciar a câmera neste dispositivo."
      );
      setCameraReady(false);
    }
  };

  const switchCamera = async () => {
    setFacingMode((current) => (current === "user" ? "environment" : "user"));
  };

  useEffect(() => {
    if (!cameraReady) return;
    void startCamera();
  }, [facingMode]);

  useEffect(() => () => stopCamera(), []);

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
      return;
    }

    setAccess((current) => [...current, data]);
    notify.success(type === "entrada" ? `${student.nome} entrou.` : `${student.nome} saiu.`);
    setSavingId("");
  };

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="mx-auto w-full max-w-7xl px-3 py-4 sm:px-6 sm:py-6">
      <PageTitle title="Ponto de frequência" subtitle="Registre entradas e saídas enquanto o reconhecimento facial é conectado." />

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900 sm:p-6">
          <div className="flex flex-col gap-3 border-b border-slate-100 pb-5 dark:border-slate-800 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hoje</p>
              <h2 className="mt-1 text-xl font-bold text-slate-900 dark:text-white">Registro manual</h2>
            </div>
            <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2 text-sm font-semibold text-green-700 dark:bg-green-950/20 dark:text-green-300">
              <FaCheckCircle /> Operacional
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar aluno pelo nome..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
            </div>
            <select value={pointId} onChange={(event) => setPointId(event.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white">
              <option value="">Ponto padrão</option>
              {points.map((point) => <option key={point.id} value={point.id}>{point.nome}</option>)}
            </select>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}

          <div className="mt-5 space-y-2">
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
                <div className="flex shrink-0 gap-2">
                  {student.active ? (
                    <button type="button" disabled={savingId === student.id} onClick={() => void register(student, "saida")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50 dark:bg-slate-700">
                      <FaSignOutAlt /> Saída
                    </button>
                  ) : (
                    <button type="button" disabled={savingId === student.id} onClick={() => void register(student, "entrada")} className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50">
                      <FaSignInAlt /> Entrada
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-sm dark:border-slate-700">
            <div className="relative aspect-video overflow-hidden bg-slate-900">
              {cameraReady ? (
                <video ref={videoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full items-center justify-center p-6 text-center">
                  <div>
                    <FaCamera className="mx-auto text-4xl text-slate-500" />
                    <p className="mt-3 font-semibold text-white">Câmera de reconhecimento</p>
                    <p className="mt-1 text-xs text-slate-400">A câmera será usada nesta etapa apenas para captura/preview.</p>
                  </div>
                </div>
              )}
              {cameraReady && <div className="pointer-events-none absolute inset-x-8 top-1/2 h-28 -translate-y-1/2 rounded-3xl border-2 border-white/60" />}
            </div>
            <div className="space-y-2 p-4">
              {cameraError && <p className="rounded-lg bg-red-950/40 p-2 text-xs text-red-300">{cameraError}</p>}
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => void (cameraReady ? stopCamera() : startCamera())} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800">
                  {cameraReady ? <><FaStop /> Parar</> : <><FaCamera /> Iniciar</>}
                </button>
                <button type="button" onClick={() => void switchCamera()} disabled={!cameraReady} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-600 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40">
                  <FaSyncAlt /> Alternar
                </button>
              </div>
              <p className="text-center text-[11px] text-slate-500">{cameraReady ? `Câmera ${facingMode === "user" ? "frontal" : "traseira"} ativa` : "Câmera desligada"}</p>
            </div>
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

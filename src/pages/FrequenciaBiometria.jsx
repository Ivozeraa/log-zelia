import { useEffect, useState } from "react";
import { FaArrowLeft, FaCamera, FaCheckCircle, FaChalkboardTeacher, FaSearch, FaTimes, FaTrash, FaUserCircle } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { Pagination } from "../components/ui/Pagination";
import { supabase } from "../utils/supabase";
import { useSchool } from "../hooks/useSchool";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";
import { notify } from "../utils/notify";
import { getNormalizedFaceBox, useFaceScanner } from "../hooks/useFaceScanner";

const LAST_TURMA_KEY = "logzelia:biometria-facial:ultima-turma";
const PAGE_SIZE_OPTIONS = [10, 20, 50];
const STATUS_FILTERS = [
  { value: "todos", label: "Todos" },
  { value: "cadastrados", label: "Cadastrados" },
  { value: "nao_cadastrados", label: "Não cadastrados" },
];

const useDebouncedValue = (value, delayMs) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timeout);
  }, [value, delayMs]);
  return debounced;
};

/**
 * Cadastro do rosto de referência de cada aluno. Fluxo: selecionar turma →
 * buscar/paginar (10 por página) → cadastrar/recadastrar/remover. Só o
 * descritor (embedding) gerado pelo Human.js é enviado ao servidor — a
 * listagem nunca busca esse campo, nenhuma imagem é armazenada.
 */
export const FrequenciaBiometria = () => {
  const { schoolId } = useSchool();
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();

  const [turmas, setTurmas] = useState([]);
  const [selectedTurma, setSelectedTurma] = useState(() => {
    try { return window.localStorage.getItem(LAST_TURMA_KEY) || ""; } catch { return ""; }
  });
  const [searchInput, setSearchInput] = useState("");
  const search = useDebouncedValue(searchInput.trim(), 350);
  const [statusFilter, setStatusFilter] = useState("todos");
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);

  const [alunos, setAlunos] = useState([]);
  const [totalCount, setTotalCount] = useState(0);
  const [biometrias, setBiometrias] = useState(new Map());
  const [enrolledIds, setEnrolledIds] = useState(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [capturingAluno, setCapturingAluno] = useState(null);
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    if (!schoolId) return;
    supabase.from("turmas").select("id, nome").eq("escola_id", schoolId).order("nome")
      .then(({ data, error: turmasError }) => {
        if (turmasError) { console.error(turmasError); return; }
        setTurmas(data || []);
      });
  }, [schoolId]);

  // Ids de alunos com biometria cadastrada na escola (só o id, nunca o descritor).
  // Usado pra montar o filtro "cadastrados/não cadastrados" no banco.
  useEffect(() => {
    const load = async () => {
      if (!schoolId) return;
      const { data, error: enrolledError } = await supabase
        .from("alunos_biometria_facial")
        .select("aluno_id")
        .eq("escola_id", schoolId);
      if (enrolledError) { console.error(enrolledError); return; }
      setEnrolledIds(new Set((data || []).map((item) => item.aluno_id)));
    };
    void load();
  }, [schoolId]);

  useEffect(() => {
    const reset = () => setPage(1);
    reset();
  }, [selectedTurma, search, statusFilter, pageSize]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!schoolId || !selectedTurma) {
        setAlunos([]);
        setTotalCount(0);
        return;
      }

      setLoading(true);
      setError("");

      let query = supabase
        .from("alunos")
        .select("id, nome, matricula, turma_id", { count: "exact" })
        .eq("escola_id", schoolId)
        .eq("turma_id", selectedTurma);

      if (search) {
        const like = `%${search.replace(/[%_]/g, "")}%`;
        query = query.or(`nome.ilike.${like},matricula.ilike.${like}`);
      }

      if (statusFilter === "cadastrados") {
        const ids = Array.from(enrolledIds);
        if (ids.length === 0) {
          if (!cancelled) { setAlunos([]); setTotalCount(0); setLoading(false); }
          return;
        }
        query = query.in("id", ids);
      } else if (statusFilter === "nao_cadastrados" && enrolledIds.size > 0) {
        query = query.not("id", "in", `(${Array.from(enrolledIds).join(",")})`);
      }

      const from = (page - 1) * pageSize;
      const { data, error: queryError, count } = await query.order("nome").range(from, from + pageSize - 1);

      if (cancelled) return;

      if (queryError) {
        console.error(queryError);
        setError("Não foi possível carregar os alunos desta turma.");
        setAlunos([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }

      const pageAlunos = data || [];
      setAlunos(pageAlunos);
      setTotalCount(count || 0);

      const pageIds = pageAlunos.map((aluno) => aluno.id);
      if (pageIds.length > 0) {
        const { data: bioData, error: bioError } = await supabase
          .from("alunos_biometria_facial")
          .select("aluno_id, qualidade, updated_at")
          .in("aluno_id", pageIds);
        if (!cancelled && !bioError) {
          setBiometrias(new Map((bioData || []).map((item) => [item.aluno_id, item])));
        }
      } else {
        setBiometrias(new Map());
      }

      setLoading(false);
    };

    void load();
    return () => { cancelled = true; };
  }, [schoolId, selectedTurma, search, statusFilter, page, pageSize, enrolledIds]);

  const handleSelectTurma = (turmaId) => {
    setSelectedTurma(turmaId);
    try {
      if (turmaId) window.localStorage.setItem(LAST_TURMA_KEY, turmaId);
      else window.localStorage.removeItem(LAST_TURMA_KEY);
    } catch { /* localStorage indisponível — segue sem lembrar a turma */ }
  };

  const handleRemover = async (aluno) => {
    if (!window.confirm(`Remover o cadastro facial de ${aluno.nome}?`)) return;
    setRemovingId(aluno.id);
    const { error: rpcError } = await supabase.rpc("remover_biometria_facial_aluno", { p_aluno_id: aluno.id });
    if (rpcError) {
      notify.error(rpcError.message || "Não foi possível remover o cadastro.");
    } else {
      setBiometrias((current) => { const next = new Map(current); next.delete(aluno.id); return next; });
      setEnrolledIds((current) => { const next = new Set(current); next.delete(aluno.id); return next; });
      notify.success("Cadastro facial removido.");
    }
    setRemovingId("");
  };

  const handleCaptured = (aluno, entry) => {
    setBiometrias((current) => { const next = new Map(current); next.set(aluno.id, entry); return next; });
    setEnrolledIds((current) => new Set(current).add(aluno.id));
    setCapturingAluno(null);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const rangeStart = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(totalCount, page * pageSize);

  if (featureLoading) return null;
  if (!hasFeature("frequencia")) return null;

  if (capturingAluno) {
    return <CapturaFacialAluno aluno={capturingAluno} onClose={() => setCapturingAluno(null)} onCaptured={(entry) => handleCaptured(capturingAluno, entry)} />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl overflow-x-hidden px-3 py-3 sm:px-6 sm:py-6">
      <PageTitle title="Cadastro facial" subtitle="Cadastre o rosto de referência de cada aluno para o terminal de frequência identificá-lo automaticamente." />

      <label className="mt-4 block text-sm font-semibold text-slate-700 dark:text-slate-200">
        Turma
        <div className="relative mt-1">
          <FaChalkboardTeacher className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <select value={selectedTurma} onChange={(event) => handleSelectTurma(event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm font-normal text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white">
            <option value="">Selecione uma turma...</option>
            {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
          </select>
        </div>
      </label>

      {!selectedTurma ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
          Selecione uma turma para começar.
        </div>
      ) : (
        <>
          <div className="mt-3 flex min-w-0 flex-col gap-2 sm:flex-row sm:gap-3">
            <div className="relative flex-1">
              <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Buscar por nome ou matrícula..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
            </div>
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white sm:w-auto sm:min-w-44">
              {STATUS_FILTERS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </div>

          {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}

          <div className="mt-4 space-y-2">
            {loading ? (
              <div className="rounded-xl border border-slate-200 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Carregando alunos...</div>
            ) : alunos.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">
                {statusFilter === "cadastrados" ? "Nenhum aluno possui cadastro facial nesta turma." : "Nenhum aluno encontrado."}
              </div>
            ) : alunos.map((aluno) => {
              const entry = biometrias.get(aluno.id);
              return (
                <div key={aluno.id} className="flex flex-col gap-3 rounded-2xl border border-slate-200 p-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full ${entry ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500"}`}>
                      {entry ? <FaCheckCircle /> : <FaUserCircle className="text-xl" />}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{aluno.nome}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {aluno.matricula ? `Mat. ${aluno.matricula} · ` : ""}
                        {entry ? <>🟢 Cadastrado em {new Date(entry.updated_at).toLocaleDateString("pt-BR")}</> : <>⚪ Não cadastrado</>}
                      </p>
                    </div>
                  </div>
                  <div className="flex w-full shrink-0 gap-2 sm:w-auto">
                    <button type="button" onClick={() => setCapturingAluno(aluno)} className="flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 sm:w-auto sm:flex-none">
                      <FaCamera /> {entry ? "Recadastrar" : "Cadastrar rosto"}
                    </button>
                    {entry && (
                      <button type="button" disabled={removingId === aluno.id} onClick={() => void handleRemover(aluno)} aria-label={`Remover cadastro facial de ${aluno.nome}`} className="flex min-h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-red-300 bg-red-50 text-red-600 hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
                        <FaTrash />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalCount > 0 && (
            <div className="mt-4 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span>{rangeStart}–{rangeEnd} de {totalCount} alunos</span>
                <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white">
                  {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size} por página</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">‹ Anterior</button>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
                <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="min-h-9 rounded-lg border border-slate-300 px-3 text-xs font-semibold text-slate-700 disabled:opacity-40 dark:border-slate-600 dark:text-slate-200">Próxima ›</button>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
};

const CapturaFacialAluno = ({ aluno, onClose, onCaptured }) => {
  const { videoRef, cameraReady, cameraStarting, cameraError, faces, faceDetectorReady, faceQuality, switchCamera, getDescriptor, getConfidence } = useFaceScanner();
  const [saving, setSaving] = useState(false);

  const handleCapturar = async () => {
    if (!faceQuality.ready || saving) return;
    const descritor = getDescriptor();
    if (!descritor) {
      notify.error("Não foi possível processar o rosto. Tente novamente.");
      return;
    }

    setSaving(true);
    const qualidade = Math.min(1, Math.max(0, getConfidence() ?? 0));
    const { data, error: rpcError } = await supabase.rpc("cadastrar_biometria_facial_aluno", {
      p_aluno_id: aluno.id,
      p_descritor: descritor,
      p_qualidade: qualidade,
    });

    if (rpcError) {
      notify.error(rpcError.message || "Não foi possível cadastrar o rosto.");
      setSaving(false);
      return;
    }

    notify.success(`Rosto de ${aluno.nome} cadastrado.`);
    onCaptured({ aluno_id: aluno.id, qualidade, updated_at: data?.updated_at || new Date().toISOString() });
  };

  return (
    <main className="fixed inset-0 z-[99999] flex h-[100dvh] min-h-0 w-screen flex-col overflow-hidden bg-[#101419] text-white">
      <header className="z-30 shrink-0 border-b border-white/10 bg-[#151a20]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" onClick={onClose} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/85 transition hover:bg-white/10 sm:px-4 sm:text-sm">
            <FaTimes /> Cancelar
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-black tracking-tight sm:text-lg">CADASTRO FACIAL</p>
            <p className="mt-0.5 truncate text-[11px] text-white/55 sm:text-xs">{aluno.nome}</p>
          </div>
          <button type="button" onClick={() => void switchCamera()} disabled={!cameraReady} aria-label="Alternar câmera" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-base transition hover:bg-white/10 disabled:opacity-40">
            <FaArrowLeft className="rotate-180" />
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
          <div className="mb-3 rounded-xl border border-amber-400/60 bg-amber-500/10 px-4 py-2.5 text-center">
            <p className="text-sm font-bold sm:text-base">OLHE DIRETAMENTE PARA A CÂMERA</p>
            <p className="mt-0.5 text-[11px] text-white/55 sm:text-xs">Use boa iluminação e mantenha o rosto centralizado.</p>
          </div>

          <div className="relative min-h-[50vh] flex-1 overflow-hidden rounded-2xl border-2 border-white/20 bg-black shadow-2xl sm:min-h-[55vh]">
            <video ref={videoRef} autoPlay muted playsInline webkit-playsinline="true" style={{ transform: "none" }} className={`absolute inset-0 h-full w-full object-cover object-center ${cameraReady ? "opacity-100" : "opacity-0"}`} />

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <div>
                  <FaCamera className="mx-auto text-5xl text-white/30" />
                  <p className="mt-4 text-lg font-bold">{cameraError ? "Câmera indisponível" : "Preparando a câmera..."}</p>
                  <p className="mt-1 text-sm text-white/50">{cameraError || "Permita o acesso à câmera quando solicitado."}</p>
                </div>
              </div>
            )}

            {cameraReady && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5 sm:p-10">
                <div className={`relative h-[min(68vh,640px)] w-[min(82vw,400px)] max-w-[420px] rounded-[48%] border-[3px] transition-all duration-200 ${faceQuality.ready ? "border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,.30),0_0_35px_rgba(52,211,153,.55)]" : "border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,.34)]"}`}>
                  <div className={`absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-md sm:px-4 sm:py-2 sm:text-xs ${faceQuality.ready ? "bg-emerald-500 text-white" : "bg-black/65 text-white"}`}>
                    {faceQuality.ready ? "✓ Rosto pronto" : "CENTRALIZE O ROSTO"}
                  </div>
                  <div className="absolute -left-[3px] -top-[3px] h-10 w-10 rounded-tl-[48%] border-l-4 border-t-4 border-white sm:h-14 sm:w-14" />
                  <div className="absolute -right-[3px] -top-[3px] h-10 w-10 rounded-tr-[48%] border-r-4 border-t-4 border-white sm:h-14 sm:w-14" />
                  <div className="absolute -bottom-[3px] -left-[3px] h-10 w-10 rounded-bl-[48%] border-b-4 border-l-4 border-white sm:h-14 sm:w-14" />
                  <div className="absolute -bottom-[3px] -right-[3px] h-10 w-10 rounded-br-[48%] border-b-4 border-r-4 border-white sm:h-14 sm:w-14" />

                  {faces.map((face, index) => {
                    const video = videoRef.current;
                    if (!face.box || !video?.videoWidth || !video?.videoHeight) return null;
                    const normalizedBox = getNormalizedFaceBox(face, video.videoWidth, video.videoHeight);
                    return (
                      <div key={index} className={`pointer-events-none absolute rounded-2xl border-2 ${faceQuality.ready ? "border-emerald-300" : "border-amber-300"}`} style={{ left: `${normalizedBox.x * 100}%`, top: `${normalizedBox.y * 100}%`, width: `${normalizedBox.width * 100}%`, height: `${normalizedBox.height * 100}%` }} />
                    );
                  })}
                </div>
              </div>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pb-3 pt-24 sm:px-5 sm:pb-5">
              <div className={`mx-auto max-w-xl rounded-xl border px-3 py-2.5 text-center backdrop-blur-md ${faceQuality.ready ? "border-emerald-400/70 bg-emerald-950/70 text-emerald-100" : "border-white/10 bg-black/65 text-white/90"}`}>
                <p className="text-xs font-bold sm:text-sm">{cameraReady ? (faceDetectorReady ? (faces.length === 0 ? "Procurando rosto..." : faceQuality.ready ? "Rosto pronto" : "Centralize o rosto") : "Carregando detecção facial...") : cameraStarting ? "Abrindo câmera..." : "Câmera desligada"}</p>
              </div>

              <button
                type="button"
                onClick={() => void handleCapturar()}
                disabled={!faceQuality.ready || saving}
                className="mx-auto mt-3 flex min-h-12 w-full max-w-xl items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <FaCheckCircle /> {saving ? "Salvando..." : "Capturar e cadastrar rosto"}
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

import { useEffect, useMemo, useState } from "react";
import { FaArrowLeft, FaCamera, FaCheckCircle, FaSearch, FaTimes, FaTrash, FaUserCircle } from "react-icons/fa";
import { PageTitle } from "../components/ui/PageTitle";
import { supabase } from "../utils/supabase";
import { useSchool } from "../hooks/useSchool";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";
import { notify } from "../utils/notify";
import { getNormalizedFaceBox, useFaceScanner } from "../hooks/useFaceScanner";

/**
 * Cadastro do rosto de referência de cada aluno. Só o descritor (embedding)
 * gerado pelo Human.js é enviado ao servidor — nenhuma imagem é armazenada.
 */
export const FrequenciaBiometria = () => {
  const { schoolId } = useSchool();
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [alunos, setAlunos] = useState([]);
  const [turmas, setTurmas] = useState([]);
  const [biometrias, setBiometrias] = useState(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTurma, setSelectedTurma] = useState("");
  const [capturingAluno, setCapturingAluno] = useState(null);
  const [removingId, setRemovingId] = useState("");

  useEffect(() => {
    const load = async () => {
      if (!schoolId) return;
      setLoading(true);
      setError("");

      const [alunosRes, turmasRes, biometriasRes] = await Promise.all([
        supabase.from("alunos").select("id, nome, matricula, turma_id").eq("escola_id", schoolId).order("nome"),
        supabase.from("turmas").select("id, nome").eq("escola_id", schoolId).order("nome"),
        supabase.from("alunos_biometria_facial").select("aluno_id, qualidade, updated_at").eq("escola_id", schoolId),
      ]);

      if (alunosRes.error || turmasRes.error || biometriasRes.error) {
        console.error(alunosRes.error || turmasRes.error || biometriasRes.error);
        setError("Não foi possível carregar os alunos.");
        setLoading(false);
        return;
      }

      setAlunos(alunosRes.data || []);
      setTurmas(turmasRes.data || []);
      setBiometrias(new Map((biometriasRes.data || []).map((item) => [item.aluno_id, item])));
      setLoading(false);
    };

    void load();
  }, [schoolId]);

  const turmaNome = useMemo(() => {
    const map = new Map(turmas.map((turma) => [turma.id, turma.nome]));
    return (id) => map.get(id) || "Sem turma";
  }, [turmas]);

  const visibleAlunos = useMemo(() => {
    const query = search.trim().toLocaleLowerCase("pt-BR");
    return alunos.filter((aluno) => {
      const matchesSearch = !query || aluno.nome.toLocaleLowerCase("pt-BR").includes(query) || aluno.matricula?.toLowerCase().includes(query);
      const matchesTurma = !selectedTurma || aluno.turma_id === selectedTurma;
      return matchesSearch && matchesTurma;
    });
  }, [alunos, search, selectedTurma]);

  const handleRemover = async (aluno) => {
    if (!window.confirm(`Remover o cadastro facial de ${aluno.nome}?`)) return;
    setRemovingId(aluno.id);
    const { error: rpcError } = await supabase.rpc("remover_biometria_facial_aluno", { p_aluno_id: aluno.id });
    if (rpcError) {
      notify.error(rpcError.message || "Não foi possível remover o cadastro.");
    } else {
      setBiometrias((current) => {
        const next = new Map(current);
        next.delete(aluno.id);
        return next;
      });
      notify.success("Cadastro facial removido.");
    }
    setRemovingId("");
  };

  const handleCaptured = (aluno, entry) => {
    setBiometrias((current) => {
      const next = new Map(current);
      next.set(aluno.id, entry);
      return next;
    });
    setCapturingAluno(null);
  };

  if (featureLoading || loading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center px-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Carregando alunos...</p>
      </main>
    );
  }

  if (!hasFeature("frequencia")) return null;

  if (capturingAluno) {
    return <CapturaFacialAluno aluno={capturingAluno} onClose={() => setCapturingAluno(null)} onCaptured={(entry) => handleCaptured(capturingAluno, entry)} />;
  }

  return (
    <main className="mx-auto w-full max-w-5xl overflow-x-hidden px-3 py-3 sm:px-6 sm:py-6">
      <PageTitle title="Cadastro facial" subtitle="Cadastre o rosto de referência de cada aluno para o terminal de frequência identificá-lo automaticamente." />

      <div className="mt-4 flex min-w-0 flex-col gap-2 sm:flex-row sm:gap-3">
        <div className="relative flex-1">
          <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar aluno por nome ou matrícula..." className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-sm outline-none focus:border-green-500 dark:border-slate-600 dark:bg-slate-950 dark:text-white" />
        </div>
        <select value={selectedTurma} onChange={(event) => setSelectedTurma(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white sm:w-auto sm:min-w-48">
          <option value="">Todas as turmas</option>
          {turmas.map((turma) => <option key={turma.id} value={turma.id}>{turma.nome}</option>)}
        </select>
      </div>

      {error && <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">{error}</div>}

      <div className="mt-4 space-y-2">
        {visibleAlunos.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">Nenhum aluno encontrado.</div>
        ) : visibleAlunos.map((aluno) => {
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
                    {turmaNome(aluno.turma_id)} · {entry ? `Cadastrado em ${new Date(entry.updated_at).toLocaleDateString("pt-BR")}` : "Rosto não cadastrado"}
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
                <p className="text-xs font-bold sm:text-sm">{cameraReady ? (faceDetectorReady ? (faces.length === 0 ? "PROCURANDO ROSTO..." : faceQuality.message) : "Carregando detecção facial...") : cameraStarting ? "Abrindo câmera..." : "Câmera desligada"}</p>
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

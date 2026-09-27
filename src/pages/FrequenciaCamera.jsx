import { useEffect, useMemo, useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaCheckCircle, FaExclamationTriangle, FaSyncAlt, FaUserCheck } from "react-icons/fa";
import { supabase } from "../utils/supabase";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";
import { getNormalizedFaceBox, useFaceScanner } from "../hooks/useFaceScanner";

const today = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Fortaleza" }).format(new Date());
const nowLabel = () => new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

const RESET_DELAY_MS = { confirmado: 3200, ja_registrado: 2200, nao_identificado: 1800, erro: 2200 };
const IDENTIFICATION_COOLDOWN_MS = 8000;

/**
 * Terminal de frequência facial: câmera sempre aberta, identifica o aluno
 * automaticamente e registra entrada/saída sem seleção manual.
 */
export const FrequenciaCamera = ({ onExit, points = [], pointId, onPointChange }) => {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("logzelia:frequencia-camera", { detail: { active: true } }));
    return () => window.dispatchEvent(new CustomEvent("logzelia:frequencia-camera", { detail: { active: false } }));
  }, []);

  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const scanner = useFaceScanner();
  const { videoRef, cameraReady, cameraStarting, cameraError, faces, faceDetectorReady, faceDetectionError, faceQuality, faceDistance, switchCamera, getDescriptor, getConfidence } = scanner;

  const [phase, setPhase] = useState("aguardando");
  const [confirmation, setConfirmation] = useState(null);
  const [statusDetail, setStatusDetail] = useState("");

  const processingRef = useRef(false);
  const cooldownRef = useRef(new Map());
  const resetTimeoutRef = useRef(null);

  const scheduleReset = (nextPhase, delay) => {
    if (resetTimeoutRef.current) window.clearTimeout(resetTimeoutRef.current);
    resetTimeoutRef.current = window.setTimeout(() => {
      setPhase("aguardando");
      setStatusDetail("");
      processingRef.current = false;
    }, delay ?? RESET_DELAY_MS[nextPhase] ?? 2000);
  };

  const handleIdentifiedStudent = async (alunoId, nome, similaridade) => {
    const cooldownUntil = cooldownRef.current.get(alunoId);
    if (cooldownUntil && cooldownUntil > Date.now()) {
      setPhase("ja_registrado");
      setStatusDetail(nome);
      scheduleReset("ja_registrado");
      return;
    }

    setPhase("identificado");
    setStatusDetail(nome);

    const { data: ultimoRegistro } = await supabase
      .from("registros_acesso")
      .select("tipo")
      .eq("aluno_id", alunoId)
      .eq("data", today())
      .eq("status", "registrado")
      .order("registrado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const tipo = ultimoRegistro?.tipo === "entrada" ? "saida" : "entrada";

    setPhase("registrando");

    const confidence = Math.min(1, Math.max(0, similaridade ?? getConfidence() ?? 0));
    const { data: registro, error: rpcError } = await supabase.rpc("registrar_acesso_frequencia", {
      p_aluno_id: alunoId,
      p_tipo: tipo,
      p_metodo: "facial",
      p_ponto_id: pointId || null,
      p_confidence_score: confidence,
    });

    if (rpcError) {
      const mensagem = rpcError.message || "";
      if (mensagem.includes("já possui uma entrada ativa") || mensagem.includes("Não existe uma entrada ativa")) {
        cooldownRef.current.set(alunoId, Date.now() + IDENTIFICATION_COOLDOWN_MS);
        setPhase("ja_registrado");
        setStatusDetail(nome);
        scheduleReset("ja_registrado");
        return;
      }

      console.error(rpcError);
      setPhase("erro");
      setStatusDetail("Não foi possível registrar a frequência.");
      scheduleReset("erro");
      return;
    }

    cooldownRef.current.set(alunoId, Date.now() + IDENTIFICATION_COOLDOWN_MS);
    setConfirmation({ nome, tipo, horario: registro?.registrado_em ? new Date(registro.registrado_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : nowLabel() });
    setPhase("confirmado");
    scheduleReset("confirmado");
  };

  const handleFaceReady = async () => {
    if (processingRef.current) return;
    processingRef.current = true;
    setPhase("identificando");
    setStatusDetail("");

    const descritor = getDescriptor();
    if (!descritor) {
      setPhase("erro");
      setStatusDetail("Não foi possível processar o rosto.");
      scheduleReset("erro");
      return;
    }

    try {
      const { data, error } = await supabase.rpc("identificar_aluno_frequencia", { p_descritor: descritor });
      if (error) throw error;

      const match = Array.isArray(data) ? data[0] : data;
      if (!match?.aluno_id) {
        setPhase("nao_identificado");
        setStatusDetail("Rosto não reconhecido. Tente novamente.");
        scheduleReset("nao_identificado");
        return;
      }

      await handleIdentifiedStudent(match.aluno_id, match.nome, match.similaridade);
    } catch (identificationError) {
      console.error(identificationError);
      setPhase("erro");
      setStatusDetail("Falha temporária na identificação.");
      scheduleReset("erro");
    }
  };

  useEffect(() => {
    if (faceQuality.ready && phase === "aguardando" && !processingRef.current) {
      void handleFaceReady();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [faceQuality.ready, phase]);

  useEffect(() => () => {
    if (resetTimeoutRef.current) window.clearTimeout(resetTimeoutRef.current);
  }, []);

  const bigMessage = useMemo(() => {
    if (cameraError) return "CÂMERA INDISPONÍVEL";
    if (!cameraReady) return cameraStarting ? "INICIALIZANDO CÂMERA..." : "CÂMERA INDISPONÍVEL";
    if (!faceDetectorReady) return "INICIALIZANDO CÂMERA...";

    switch (phase) {
      case "identificando": return "IDENTIFICANDO...";
      case "identificado": return "ALUNO IDENTIFICADO";
      case "registrando": return "REGISTRANDO FREQUÊNCIA...";
      case "confirmado": return "FREQUÊNCIA REGISTRADA";
      case "ja_registrado": return "ALUNO JÁ REGISTRADO";
      case "nao_identificado": return "ERRO TEMPORÁRIO";
      case "erro": return "ERRO TEMPORÁRIO";
      default:
        if (faces.length === 0) return "PROCURANDO ROSTO...";
        if (faceQuality.ready) return "ROSTO PRONTO";
        return faceQuality.message === "Rosto detectado." ? "ROSTO DETECTADO" : faceQuality.message.toUpperCase();
    }
  }, [cameraError, cameraReady, cameraStarting, faceDetectorReady, faces.length, faceQuality, phase]);

  const isBusyPhase = ["identificando", "identificado", "registrando"].includes(phase);
  const panelTone = phase === "confirmado" ? "success" : phase === "ja_registrado" ? "warning" : phase === "erro" || phase === "nao_identificado" ? "danger" : "neutral";

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="fixed inset-0 z-[99999] flex h-[100dvh] min-h-0 w-screen flex-col overflow-hidden bg-[#101419] text-white">
      <header className="z-30 shrink-0 border-b border-white/10 bg-[#151a20]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" onClick={() => onExit?.()} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/85 transition hover:bg-white/10 sm:px-4 sm:text-sm">
            <FaArrowLeft /> Voltar
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-lg font-black tracking-tight sm:text-2xl">FREQUÊNCIA</p>
            <div className="mt-0.5 flex items-center justify-center gap-2 text-[10px] font-semibold text-white/55 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
              ONLINE <span>•</span> TERMINAL DE PRESENÇA
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {points.length > 1 && (
              <select
                value={pointId || ""}
                onChange={(event) => onPointChange?.(event.target.value)}
                className="hidden max-w-[9rem] truncate rounded-xl border border-white/10 bg-white/5 px-2 py-2 text-[11px] font-semibold text-white/80 outline-none sm:block"
              >
                {points.map((point) => <option key={point.id} value={point.id} className="text-black">{point.nome}</option>)}
              </select>
            )}
            <button type="button" onClick={() => void switchCamera()} disabled={!cameraReady} aria-label="Alternar câmera" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-base transition hover:bg-white/10 disabled:opacity-40">
              <FaSyncAlt />
            </button>
          </div>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <div className={`mb-3 rounded-xl border px-4 py-2.5 text-center transition-colors sm:mb-3 ${
            panelTone === "success" ? "border-emerald-400/60 bg-emerald-500/10"
            : panelTone === "warning" ? "border-amber-400/60 bg-amber-500/10"
            : panelTone === "danger" ? "border-red-400/60 bg-red-500/10"
            : "border-amber-400/60 bg-amber-500/10"
          }`}>
            <p className="text-sm font-bold tracking-wide sm:text-base">{bigMessage}</p>
            {statusDetail && <p className="mt-0.5 text-[11px] text-white/70 sm:text-xs">{statusDetail}</p>}
            {!statusDetail && phase === "aguardando" && <p className="mt-0.5 text-[11px] text-white/55 sm:text-xs">Mantenha o rosto centralizado dentro da moldura.</p>}
          </div>

          <div className="relative min-h-[56vh] flex-1 overflow-hidden rounded-2xl border-2 border-white/20 bg-black shadow-2xl sm:min-h-[60vh]">
            <video ref={videoRef} autoPlay muted playsInline webkit-playsinline="true" style={{ transform: "none" }} className={`absolute inset-0 h-full w-full object-cover object-center ${cameraReady ? "opacity-100" : "opacity-0"}`} />

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <div>
                  {cameraError ? <FaExclamationTriangle className="mx-auto text-5xl text-red-400/70" /> : <FaCamera className="mx-auto text-5xl text-white/30" />}
                  <p className="mt-4 text-lg font-bold">{cameraError ? "Câmera indisponível" : "Preparando a câmera..."}</p>
                  <p className="mt-1 text-sm text-white/50">{cameraError || "Permita o acesso à câmera quando solicitado."}</p>
                  {cameraError && (
                    <button type="button" onClick={() => window.location.reload()} className="mt-4 rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20">
                      Tentar novamente
                    </button>
                  )}
                </div>
              </div>
            )}

            {cameraReady && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-black/10" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5 sm:p-10">
                  <div className={`relative h-[min(64vh,620px)] w-[min(72vw,380px)] max-w-[390px] rounded-[48%] border-[3px] transition-all duration-200 ${
                    panelTone === "success" ? "border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,.30),0_0_35px_rgba(52,211,153,.55)]"
                    : panelTone === "warning" ? "border-amber-400 shadow-[0_0_0_9999px_rgba(0,0,0,.30),0_0_35px_rgba(251,191,36,.5)]"
                    : panelTone === "danger" ? "border-red-400 shadow-[0_0_0_9999px_rgba(0,0,0,.30),0_0_35px_rgba(248,113,113,.5)]"
                    : faceQuality.ready ? "border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,.30),0_0_35px_rgba(52,211,153,.55)]" : "border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,.34)]"
                  }`}>
                    <div className={`absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-md sm:px-4 sm:py-2 sm:text-xs ${
                      panelTone === "success" ? "bg-emerald-500 text-white"
                      : panelTone === "warning" ? "bg-amber-500 text-white"
                      : panelTone === "danger" ? "bg-red-500 text-white"
                      : faceQuality.ready ? "bg-emerald-500 text-white" : "bg-black/65 text-white"
                    }`}>
                      {isBusyPhase && <FaUserCheck className="mr-1 inline" />}
                      {phase === "aguardando" ? (faceQuality.ready ? "✓ Rosto pronto" : "CENTRALIZE SEU ROSTO") : bigMessage}
                    </div>
                    <div className="absolute -left-[3px] -top-[3px] h-10 w-10 rounded-tl-[48%] border-l-4 border-t-4 border-white sm:h-14 sm:w-14" />
                    <div className="absolute -right-[3px] -top-[3px] h-10 w-10 rounded-tr-[48%] border-r-4 border-t-4 border-white sm:h-14 sm:w-14" />
                    <div className="absolute -bottom-[3px] -left-[3px] h-10 w-10 rounded-bl-[48%] border-b-4 border-l-4 border-white sm:h-14 sm:w-14" />
                    <div className="absolute -bottom-[3px] -right-[3px] h-10 w-10 rounded-br-[48%] border-b-4 border-r-4 border-white sm:h-14 sm:w-14" />

                    {faces.map((face, index) => {
                      const confidence = face.boxScore ?? face.score ?? 0;
                      if (!face.box || !videoRef.current?.videoWidth || !videoRef.current?.videoHeight) return null;
                      const normalizedBox = getNormalizedFaceBox(face, videoRef.current.videoWidth, videoRef.current.videoHeight);
                      return (
                        <div key={index} className={`pointer-events-none absolute rounded-2xl border-2 ${faceQuality.ready ? "border-emerald-300" : "border-amber-300"}`} style={{ left: `${normalizedBox.x * 100}%`, top: `${normalizedBox.y * 100}%`, width: `${normalizedBox.width * 100}%`, height: `${normalizedBox.height * 100}%` }}>
                          <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/70 px-2 py-1 text-[10px] font-bold backdrop-blur">Rosto {Math.round(confidence * 100)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="absolute left-3 top-3 rounded-xl border border-white/10 bg-black/55 px-3 py-2 backdrop-blur-md sm:left-5 sm:top-5">
                  <p className="text-[9px] font-semibold uppercase tracking-wider text-white/50">Distância</p>
                  <p className="text-xl font-black leading-none text-amber-300 sm:text-2xl">{faceDistance > 0 ? faceDistance.toFixed(2) : "--"}</p>
                  <p className="mt-1 text-[9px] text-white/45">faixa de enquadramento</p>
                </div>
              </>
            )}

            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/95 via-black/55 to-transparent px-3 pb-3 pt-24 sm:px-5 sm:pb-5">
              {cameraError && <div className="mx-auto mb-2 max-w-xl rounded-xl bg-red-950/85 p-3 text-center text-xs text-red-200">{cameraError}</div>}
              {faceDetectionError && <div className="mx-auto mb-2 max-w-xl rounded-xl bg-amber-950/85 p-3 text-center text-xs text-amber-200">{faceDetectionError}</div>}

              {phase === "confirmado" && confirmation ? (
                <div className="mx-auto max-w-xl rounded-xl border border-emerald-400/70 bg-emerald-950/80 px-4 py-3 text-center backdrop-blur-md">
                  <div className="flex items-center justify-center gap-2 text-sm font-bold sm:text-base">
                    <FaCheckCircle className="text-emerald-300" />
                    <span>FREQUÊNCIA REGISTRADA</span>
                  </div>
                  <p className="mt-1 truncate text-sm font-semibold text-white">{confirmation.nome}</p>
                  <p className="mt-0.5 text-[11px] text-emerald-200 sm:text-xs">
                    {confirmation.tipo === "entrada" ? "Entrada" : "Saída"} registrada às {confirmation.horario}
                  </p>
                </div>
              ) : (
                <div className={`mx-auto max-w-xl rounded-xl border px-3 py-2.5 text-center backdrop-blur-md ${
                  panelTone === "warning" ? "border-amber-400/70 bg-amber-950/70 text-amber-100"
                  : panelTone === "danger" ? "border-red-400/70 bg-red-950/70 text-red-100"
                  : "border-white/10 bg-black/65 text-white/90"
                }`}>
                  <div className="flex items-center justify-center gap-2 text-xs font-bold sm:text-sm">
                    <span>{cameraReady ? (faceDetectorReady ? bigMessage : "Carregando detecção facial...") : cameraStarting ? "Abrindo câmera..." : "Câmera desligada"}</span>
                  </div>
                  {statusDetail && <p className="mt-1 text-[11px] font-semibold text-white/80">{statusDetail}</p>}
                </div>
              )}

              <div className="mt-2 text-center text-[10px] text-white/45 sm:text-xs">
                A câmera permanece ativa continuamente. Nenhuma imagem é armazenada.
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

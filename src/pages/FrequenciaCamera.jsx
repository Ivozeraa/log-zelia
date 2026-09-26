import { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaCheckCircle, FaSyncAlt } from "react-icons/fa";
import Human from "@vladmandic/human";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";


const getFaceBox = (face) => {
  const box = face?.box;
  if (Array.isArray(box)) {
    return {
      x: Number(box[0] ?? 0),
      y: Number(box[1] ?? 0),
      width: Number(box[2] ?? 0),
      height: Number(box[3] ?? 0),
    };
  }

  return {
    x: Number(box?.x ?? box?.originX ?? 0),
    y: Number(box?.y ?? box?.originY ?? 0),
    width: Number(box?.width ?? 0),
    height: Number(box?.height ?? 0),
  };
};

const getNormalizedFaceBox = (face, videoWidth, videoHeight) => {
  const raw = face?.boxRaw;
  if (Array.isArray(raw)) {
    return {
      x: Math.max(0, Math.min(1, Number(raw[0] ?? 0))),
      y: Math.max(0, Math.min(1, Number(raw[1] ?? 0))),
      width: Math.max(0, Math.min(1, Number(raw[2] ?? 0))),
      height: Math.max(0, Math.min(1, Number(raw[3] ?? 0))),
    };
  }

  const box = getFaceBox(face);
  return {
    x: box.x / videoWidth,
    y: box.y / videoHeight,
    width: box.width / videoWidth,
    height: box.height / videoHeight,
  };
};

export const FrequenciaCamera = ({ onClose, studentName, attendanceType, onConfirm, confirming = false }) => {
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("logzelia:frequencia-camera", { detail: { active: true } }));
    return () => window.dispatchEvent(new CustomEvent("logzelia:frequencia-camera", { detail: { active: false } }));
  }, []);
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const [faces, setFaces] = useState([]);
  const [faceDetectorReady, setFaceDetectorReady] = useState(false);
  const [faceDetectionError, setFaceDetectionError] = useState("");
  const [faceQuality, setFaceQuality] = useState({ ready: false, message: "Olhe diretamente para a câmera." });
  const [faceDistance, setFaceDistance] = useState(0);
  const [attendanceConfirmed, setAttendanceConfirmed] = useState(false);
  const stableFramesRef = useRef(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionFrameRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const cameraReadyRef = useRef(false);
  const detectionBusyRef = useRef(false);
  const confirmationTriggeredRef = useRef(false);

  const stopFaceDetection = () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current);
    detectionFrameRef.current = null;
    setFaces([]);
    setFaceQuality({ ready: false, message: "Olhe diretamente para a câmera." });
    setFaceDistance(0);
    stableFramesRef.current = 0;
    confirmationTriggeredRef.current = false;
    setAttendanceConfirmed(false);
  };

  const stopCamera = () => {
    stopFaceDetection();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    cameraReadyRef.current = false;
    setCameraReady(false);
    setFaceDetectorReady(false);
  };

  const initializeFaceDetector = async () => {
    if (detectorRef.current) {
      setFaceDetectorReady(true);
      return true;
    }

    setFaceDetectionError("");

    try {
      const human = new Human({
        backend: "webgl",
        modelBasePath: "https://vladmandic.github.io/human-models/models/",
        filter: { enabled: true, equalization: false, flip: false },
        face: {
          enabled: true,
          detector: {
            rotation: true,
            maxDetected: 5,
            minConfidence: 0.35,
            minSize: 80,
            return: false,
          },
          mesh: { enabled: false },
          attention: { enabled: false },
          iris: { enabled: true },
          description: { enabled: false },
          emotion: { enabled: false },
          antispoof: { enabled: false },
          liveness: { enabled: false },
        },
        body: { enabled: false },
        hand: { enabled: false },
        object: { enabled: false },
        gesture: { enabled: true },
        segmentation: { enabled: false },
      });

      await human.load();
      await human.warmup();
      detectorRef.current = human;
      setFaceDetectorReady(true);
      return true;
    } catch (detectorError) {
      console.error("Human initialization error:", detectorError);
      setFaceDetectionError("Não foi possível carregar o motor facial neste navegador.");
      return false;
    }
  };

  const runFaceDetection = async (timestamp = performance.now()) => {
    const video = videoRef.current;
    const human = detectorRef.current;

    if (!video || !human || !cameraReadyRef.current || video.readyState < 2 || !video.videoWidth || !video.videoHeight) {
      detectionFrameRef.current = requestAnimationFrame(runFaceDetection);
      return;
    }

    if (timestamp - lastDetectionRef.current >= 100 && !detectionBusyRef.current) {
      detectionBusyRef.current = true;

      try {
        const result = await human.detect(video);
        const detections = result?.face || [];
        const gestures = (result?.gesture || []).map((item) => item?.gesture).filter(Boolean);
        setFaces(detections);

        const width = video.videoWidth;
        const height = video.videoHeight;
        const face = detections.length === 1 ? detections[0] : null;
        const box = face?.box;
        const score = face?.boxScore ?? face?.score ?? 0;

        if (!box || detections.length !== 1) {
          stableFramesRef.current = 0;
          setFaceDistance(0);
          setFaceQuality({
            ready: false,
            message: detections.length > 1
              ? "Apenas uma pessoa deve estar diante da câmera."
              : "Olhe diretamente para a câmera.",
          });
        } else {
          const normalizedBox = getNormalizedFaceBox(face, width, height);
          const centerX = normalizedBox.x + normalizedBox.width / 2;
          const centerY = normalizedBox.y + normalizedBox.height / 2;
          const area = normalizedBox.width * normalizedBox.height;
          const faceWidth = normalizedBox.width;
          const faceHeight = normalizedBox.height;
          const distance = Math.max(0, Math.min(1, (faceHeight - 0.20) / 0.55));
          setFaceDistance(distance);

          const centered = centerX >= 0.25 && centerX <= 0.75 && centerY >= 0.20 && centerY <= 0.80;
          const goodSize = faceHeight >= 0.20 && faceHeight <= 0.85 && faceWidth >= 0.10 && faceWidth <= 0.75;
          const goodConfidence = score >= 0.40;
          const facingCenter = gestures.length === 0 || gestures.includes("facing center");
          const lookingCenter = gestures.length === 0 || gestures.includes("looking center");
          const readyNow = centered && goodSize && goodConfidence && facingCenter && lookingCenter;

          if (readyNow) stableFramesRef.current += 1;
          else stableFramesRef.current = 0;

          const ready = stableFramesRef.current >= 2;
          let message = "Rosto detectado.";

          if (!goodConfidence) message = "Melhore a iluminação e olhe para a câmera.";
          else if (faceHeight < 0.20 || area < 0.025) message = "Aproxime-se um pouco da câmera.";
          else if (faceHeight > 0.85 || area > 0.60) message = "Afaste-se um pouco da câmera.";
          else if (centerX < 0.30) message = "Mova o rosto para a direita.";
          else if (centerX > 0.70) message = "Mova o rosto para a esquerda.";
          else if (centerY < 0.27) message = "Mova o rosto um pouco para baixo.";
          else if (centerY > 0.80) message = "Mova o rosto um pouco para cima.";
          else if (!facingCenter) message = "Vire o rosto para a câmera.";
          else if (!lookingCenter) message = "Olhe diretamente para a câmera.";
          else if (ready) message = "ROSTO PRONTO";

          setFaceQuality({ ready, message });

          if (ready && studentName && onConfirm && !confirmationTriggeredRef.current) {
            confirmationTriggeredRef.current = true;
            const registered = await onConfirm();
            if (registered) {
              setAttendanceConfirmed(true);
              window.setTimeout(() => onClose?.(), 1000);
            } else {
              confirmationTriggeredRef.current = false;
            }
          }
        }

        lastDetectionRef.current = performance.now();
      } catch (detectionError) {
        console.error("Human detection error:", detectionError);
        setFaceDetectionError("A detecção facial foi interrompida.");
        stableFramesRef.current = 0;
      } finally {
        detectionBusyRef.current = false;
      }
    }

    detectionFrameRef.current = requestAnimationFrame(runFaceDetection);
  };

  const startFaceDetection = async () => {
    if (!await initializeFaceDetector()) return;
    stopFaceDetection();
    detectionFrameRef.current = requestAnimationFrame(runFaceDetection);
  };

  const startCamera = async () => {
    setCameraError("");
    setCameraStarting(true);
    stopCamera();

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError("Este navegador ou dispositivo não disponibiliza acesso à câmera.");
      setCameraStarting(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode, width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("VIDEO_ELEMENT_NOT_READY");
      }

      streamRef.current = stream;
      video.srcObject = stream;
      video.muted = true;
      video.setAttribute("playsinline", "true");

      await new Promise((resolve) => {
        if (video.readyState >= 1) resolve();
        else video.onloadedmetadata = () => resolve();
      });
      await video.play();

      cameraReadyRef.current = true;
      setCameraReady(true);
      setCameraStarting(false);
      window.setTimeout(() => void startFaceDetection(), 100);
    } catch (cameraErr) {
      console.error(cameraErr);
      setCameraStarting(false);
      setCameraError(cameraErr?.name === "NotAllowedError"
        ? "Permissão da câmera negada. Libere o acesso à câmera nas configurações do navegador."
        : "Não foi possível iniciar a câmera neste dispositivo.");
      setCameraReady(false);
    }
  };

  const switchCamera = async () => setFacingMode((current) => (current === "user" ? "environment" : "user"));

  useEffect(() => {
    void startCamera();
  }, [facingMode]);

  useEffect(() => () => {
    stopCamera();
    detectorRef.current?.tf?.disposeVariables?.();
    detectorRef.current = null;
  }, []);

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="fixed inset-0 z-[99999] flex h-[100dvh] min-h-0 w-screen flex-col overflow-hidden bg-[#101419] text-white">
      <header className="z-30 shrink-0 border-b border-white/10 bg-[#151a20]/95 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <button type="button" onClick={() => onClose?.()} className="flex min-h-10 shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 text-xs font-semibold text-white/85 transition hover:bg-white/10 sm:px-4 sm:text-sm">
            <FaArrowLeft /> Voltar
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-lg font-black tracking-tight sm:text-2xl">FREQUÊNCIA</p>
            <div className="mt-0.5 flex items-center justify-center gap-2 text-[10px] font-semibold text-white/55 sm:text-xs">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,.8)]" />
              ONLINE <span>•</span> LEITOR DE PRESENÇA
            </div>
          </div>
          <button type="button" onClick={() => void switchCamera()} disabled={!cameraReady} aria-label="Alternar câmera" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-base transition hover:bg-white/10 disabled:opacity-40">
            <FaSyncAlt />
          </button>
        </div>
      </header>

      <section className="flex min-h-0 flex-1 flex-col overflow-y-auto px-3 py-3 sm:px-6 sm:py-4">
        <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col">
          <div className="mb-3 rounded-xl border border-amber-400/60 bg-amber-500/10 px-4 py-2.5 text-center sm:mb-3">
            <p className="text-sm font-bold sm:text-base">OLHE DIRETAMENTE PARA A CÂMERA</p>
            <p className="mt-0.5 text-[11px] text-white/55 sm:text-xs">Mantenha o rosto centralizado dentro da moldura.</p>
          </div>

          <div className="relative min-h-[56vh] flex-1 overflow-hidden rounded-2xl border-2 border-white/20 bg-black shadow-2xl sm:min-h-[60vh]">
            <video ref={videoRef} autoPlay muted playsInline webkit-playsinline="true" className={`absolute inset-0 h-full w-full object-cover object-center ${cameraReady ? "opacity-100" : "opacity-0"}`} />

            {!cameraReady && (
              <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
                <div>
                  <FaCamera className="mx-auto text-5xl text-white/30" />
                  <p className="mt-4 text-lg font-bold">Preparando a câmera...</p>
                  <p className="mt-1 text-sm text-white/50">Permita o acesso à câmera quando solicitado.</p>
                </div>
              </div>
            )}

            {cameraReady && (
              <>
                <div className="pointer-events-none absolute inset-0 bg-black/10" />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-5 sm:p-10">
                  <div className={`relative h-[min(64vh,620px)] w-[min(72vw,380px)] max-w-[390px] rounded-[48%] border-[3px] transition-all duration-200 ${faceQuality.ready ? "border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,.30),0_0_35px_rgba(52,211,153,.55)]" : "border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,.34)]"}`}>
                    <div className={`absolute left-1/2 top-4 z-20 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1.5 text-[10px] font-bold shadow-lg backdrop-blur-md sm:px-4 sm:py-2 sm:text-xs ${faceQuality.ready ? "bg-emerald-500 text-white" : "bg-black/65 text-white"}`}>
                      {faceQuality.ready ? "✓ Rosto pronto" : "CENTRALIZE SEU ROSTO"}
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
              <div className={`mx-auto max-w-xl rounded-xl border px-3 py-2.5 text-center backdrop-blur-md ${faceQuality.ready ? "border-emerald-400/70 bg-emerald-950/70 text-emerald-100" : "border-white/10 bg-black/65 text-white/90"}`}>
                <div className="flex items-center justify-center gap-2 text-xs font-bold sm:text-sm">
                  {faceQuality.ready && <FaCheckCircle className="text-emerald-300" />}
                  <span>{cameraReady ? faceDetectorReady ? faces.length === 0 ? "PROCURANDO ROSTO..." : faceQuality.message : "Carregando detecção facial..." : cameraStarting ? "Abrindo câmera..." : "Câmera desligada"}</span>
                </div>
              </div>
              <div className="mt-2 text-center text-[10px] text-white/45 sm:text-xs">
                A câmera permanece ativa enquanto esta tela estiver aberta.
              </div>
              {studentName && (
                <div className="mx-auto mt-3 max-w-xl rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center backdrop-blur-md">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Aluno selecionado</p>
                  <p className="mt-1 truncate text-sm font-bold text-white">{studentName}</p>
                  <p className="mt-0.5 text-[11px] text-white/50">{attendanceType === "entrada" ? "Confirmação de entrada" : "Confirmação de saída"}</p>
                </div>
              )}
              {studentName && (
                <div className={`mx-auto mt-3 max-w-xl rounded-xl border px-4 py-3 text-center backdrop-blur-md ${attendanceConfirmed ? "border-emerald-400/70 bg-emerald-950/80" : "border-white/10 bg-white/5"}`}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-white/45">Aluno selecionado</p>
                  <p className="mt-1 truncate text-sm font-bold text-white">{studentName}</p>
                  <p className={`mt-0.5 text-[11px] font-semibold ${attendanceConfirmed ? "text-emerald-300" : "text-white/50"}`}>
                    {attendanceConfirmed
                      ? `✓ ${attendanceType === "entrada" ? "Entrada" : "Saída"} confirmada`
                      : confirming
                        ? "Registrando presença..."
                        : attendanceType === "entrada" ? "Aguardando validação do rosto..." : "Aguardando validação do rosto..."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

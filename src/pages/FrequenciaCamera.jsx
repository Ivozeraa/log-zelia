import { useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaCamera, FaCheckCircle, FaSyncAlt, FaStop } from "react-icons/fa";
import { useSchoolFeatures } from "../hooks/useSchoolFeatures";

const MEDIAPIPE_MODULE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/vision_bundle.mjs";
const MEDIAPIPE_WASM = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";
const FACE_MODEL = "https://storage.googleapis.com/mediapipe-models/face_detector/blaze_face_short_range/float16/1/blaze_face_short_range.tflite";

export const FrequenciaCamera = ({ onClose }) => {
  const { hasFeature, loading: featureLoading } = useSchoolFeatures();
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const [faces, setFaces] = useState([]);
  const [faceDetectorReady, setFaceDetectorReady] = useState(false);
  const [faceDetectionError, setFaceDetectionError] = useState("");
  const [faceQuality, setFaceQuality] = useState({ ready: false, message: "Posicione o rosto dentro da moldura." });

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionFrameRef = useRef(null);
  const lastDetectionRef = useRef(0);

  const stopFaceDetection = () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current);
    detectionFrameRef.current = null;
    setFaces([]);
    setFaceQuality({ ready: false, message: "Posicione o rosto dentro da moldura." });
  };

  const stopCamera = () => {
    stopFaceDetection();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
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
      const { FilesetResolver, FaceDetector } = await import(/* @vite-ignore */ MEDIAPIPE_MODULE);
      const vision = await FilesetResolver.forVisionTasks(MEDIAPIPE_WASM);
      detectorRef.current = await FaceDetector.createFromOptions(vision, {
        baseOptions: { modelAssetPath: FACE_MODEL, delegate: "CPU" },
        runningMode: "VIDEO",
        minDetectionConfidence: 0.5,
        minSuppressionThreshold: 0.3,
      });
      setFaceDetectorReady(true);
      return true;
    } catch (detectorError) {
      console.error(detectorError);
      setFaceDetectionError("Não foi possível carregar a detecção facial neste navegador.");
      return false;
    }
  };

  const runFaceDetection = (timestamp = performance.now()) => {
    const video = videoRef.current;
    const detector = detectorRef.current;
    if (!video || !detector || !cameraReady || video.readyState < 2) return;

    if (timestamp - lastDetectionRef.current >= 120) {
      try {
        const result = detector.detectForVideo(video, timestamp);
        const detections = result?.detections || [];
        setFaces(detections);

        const videoWidth = video.videoWidth || 0;
        const videoHeight = video.videoHeight || 0;
        const face = detections.length === 1 ? detections[0] : null;
        const box = face?.boundingBox;
        const score = face?.categories?.[0]?.score ?? 0;
        const centerX = box && videoWidth ? (box.originX + box.width / 2) / videoWidth : 0;
        const centerY = box && videoHeight ? (box.originY + box.height / 2) / videoHeight : 0;
        const area = box && videoWidth && videoHeight ? (box.width * box.height) / (videoWidth * videoHeight) : 0;

        const frameLeft = 0.18;
        const frameRight = 0.82;
        const frameTop = 0.13;
        const frameBottom = 0.87;
        const horizontalInside = box
          ? box.originX / videoWidth >= frameLeft && (box.originX + box.width) / videoWidth <= frameRight
          : false;
        const verticalInside = box
          ? box.originY / videoHeight >= frameTop && (box.originY + box.height) / videoHeight <= frameBottom
          : false;

        const ready = Boolean(
          face &&
          score >= 0.65 &&
          area >= 0.08 &&
          area <= 0.5 &&
          centerX >= 0.3 &&
          centerX <= 0.7 &&
          centerY >= 0.25 &&
          centerY <= 0.75 &&
          horizontalInside &&
          verticalInside
        );

        let message = "Posicione o rosto dentro da moldura.";
        if (detections.length > 1) message = "Apenas uma pessoa deve estar diante da câmera.";
        else if (detections.length === 0) message = "Posicione o rosto dentro da moldura.";
        else if (score < 0.65) message = "Mantenha o rosto visível e procure boa iluminação.";
        else if (area < 0.08) message = "Aproxime o rosto um pouco.";
        else if (area > 0.5) message = "Afaste o rosto um pouco.";
        else if (!horizontalInside || centerX < 0.3 || centerX > 0.7) message = centerX < 0.5 ? "Mova o rosto um pouco para a direita." : "Mova o rosto um pouco para a esquerda.";
        else if (!verticalInside || centerY < 0.25 || centerY > 0.75) message = centerY < 0.5 ? "Mova o rosto um pouco para baixo." : "Mova o rosto um pouco para cima.";
        else if (ready) message = "Rosto bem posicionado.";

        setFaceQuality({ ready, message });
        lastDetectionRef.current = timestamp;
      } catch (detectionError) {
        console.error(detectionError);
        setFaceDetectionError("A detecção facial foi interrompida.");
        return;
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

      setCameraReady(true);
      setCameraStarting(false);
      window.setTimeout(() => void startFaceDetection(), 150);
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
    detectorRef.current?.close?.();
    detectorRef.current = null;
  }, []);

  if (featureLoading || !hasFeature("frequencia")) return null;

  return (
    <main className="fixed inset-0 z-[1100] flex h-[100dvh] min-h-0 w-screen flex-col overflow-hidden bg-black text-white">
      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between bg-gradient-to-b from-black/85 via-black/45 to-transparent px-3 pb-14 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
        <button type="button" onClick={() => onClose?.()} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-black/50 px-3 text-xs font-semibold backdrop-blur-md transition hover:bg-black/65 sm:px-4 sm:text-sm">
          <FaArrowLeft /> Voltar
        </button>
        <div className="min-w-0 px-2 text-center">
          <p className="truncate text-xs font-bold sm:text-sm">Ponto de frequência</p>
          <p className="text-[10px] text-white/65 sm:text-[11px]">{facingMode === "user" ? "Câmera frontal" : "Câmera traseira"}</p>
        </div>
        <button type="button" onClick={() => void switchCamera()} disabled={!cameraReady} aria-label="Alternar câmera" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-black/50 text-base backdrop-blur-md transition hover:bg-black/65 disabled:opacity-40">
          <FaSyncAlt />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden pb-[env(safe-area-inset-bottom)]">
        <video ref={videoRef} autoPlay muted playsInline webkit-playsinline="true" className={`h-full w-full object-cover object-center ${cameraReady ? "opacity-100" : "opacity-0"}`} />

        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center px-8 text-center">
            <div>
              <FaCamera className="mx-auto text-5xl text-white/35" />
              <p className="mt-4 text-lg font-semibold">Preparando a câmera...</p>
              <p className="mt-1 text-sm text-white/55">Permita o acesso à câmera quando solicitado.</p>
            </div>
          </div>
        )}

        {cameraReady && (
          <>
            <div className="pointer-events-none absolute inset-0 bg-black/25" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-5 pb-40 pt-24 sm:px-12 sm:pb-48 sm:pt-24">
              <div className={`relative h-[min(54dvh,500px)] max-h-[500px] w-[min(72vw,330px)] max-w-[330px] rounded-[48%] border-[3px] shadow-[0_0_0_9999px_rgba(0,0,0,0.28)] transition-all duration-200 sm:h-[62vh] sm:w-[min(58vw,380px)] ${faceQuality.ready ? "border-green-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.22),0_0_28px_rgba(74,222,128,0.55)]" : "border-white/85"}`}>
                <div className="absolute -top-11 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/60 px-3 py-2 text-[10px] font-semibold backdrop-blur-md sm:-top-14 sm:px-4 sm:text-xs">
                  {faceQuality.ready ? "Rosto bem posicionado" : "Centralize seu rosto"}
                </div>
                <div className="absolute -left-[3px] -top-[3px] h-9 w-9 sm:h-12 sm:w-12 rounded-tl-[48%] border-l-4 border-t-4 border-white" />
                <div className="absolute -right-[3px] -top-[3px] h-9 w-9 sm:h-12 sm:w-12 rounded-tr-[48%] border-r-4 border-t-4 border-white" />
                <div className="absolute -bottom-[3px] -left-[3px] h-9 w-9 sm:h-12 sm:w-12 rounded-bl-[48%] border-b-4 border-l-4 border-white" />
                <div className="absolute -bottom-[3px] -right-[3px] h-9 w-9 sm:h-12 sm:w-12 rounded-br-[48%] border-b-4 border-r-4 border-white" />

                {faces.map((face, index) => {
                  const box = face.boundingBox;
                  const confidence = face.categories?.[0]?.score ?? 0;
                  if (!box || !videoRef.current?.videoWidth || !videoRef.current?.videoHeight) return null;
                  return (
                    <div key={index} className={`pointer-events-none absolute rounded-2xl border-2 ${faceQuality.ready ? "border-green-300" : "border-amber-300"}`} style={{ left: `${(box.originX / videoRef.current.videoWidth) * 100}%`, top: `${(box.originY / videoRef.current.videoHeight) * 100}%`, width: `${(box.width / videoRef.current.videoWidth) * 100}%`, height: `${(box.height / videoRef.current.videoHeight) * 100}%` }}>
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-black/65 px-2 py-1 text-[10px] font-bold backdrop-blur">Rosto {Math.round(confidence * 100)}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}

        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-24 sm:px-8 sm:pb-7">
          {cameraError && <div className="mx-auto mb-3 max-w-xl rounded-xl bg-red-950/80 p-3 text-center text-xs text-red-200">{cameraError}</div>}
          {faceDetectionError && <div className="mx-auto mb-3 max-w-xl rounded-xl bg-amber-950/80 p-3 text-center text-xs text-amber-200">{faceDetectionError}</div>}
          <div className={`mx-auto max-w-xl rounded-2xl border px-4 py-3 text-center backdrop-blur-md ${faceQuality.ready ? "border-green-400/60 bg-green-950/65 text-green-100" : "border-white/15 bg-black/55 text-white/85"}`}>
            <div className="flex items-center justify-center gap-2 text-xs font-semibold sm:text-sm">
              {faceQuality.ready && <FaCheckCircle className="text-green-300" />}
              <span>{cameraReady ? faceDetectorReady ? faces.length === 0 ? "Nenhum rosto detectado" : faceQuality.message : "Carregando detecção facial..." : cameraStarting ? "Abrindo câmera..." : "Câmera desligada"}</span>
            </div>
            <p className="mt-1 text-[10px] leading-4 text-white/55 sm:text-[11px]">Posicione o rosto dentro da moldura e mantenha a cabeça centralizada.</p>
          </div>
          <div className="mx-auto mt-3 flex max-w-xl justify-center">
            <button type="button" onClick={() => void (cameraReady ? stopCamera() : startCamera())} disabled={cameraStarting} className="flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 bg-black/60 px-5 text-xs font-semibold sm:min-h-12 sm:px-6 sm:text-sm backdrop-blur-md transition hover:bg-black/75 disabled:opacity-50">
              {cameraReady ? <><FaStop /> Parar câmera</> : <><FaCamera /> {cameraStarting ? "Abrindo..." : "Iniciar câmera"}</>}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
};

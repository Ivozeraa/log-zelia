import { useCallback, useEffect, useRef, useState } from "react";
import Human from "@vladmandic/human";

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

export const getNormalizedFaceBox = (face, videoWidth, videoHeight) => {
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

const IDLE_MESSAGE = "Olhe diretamente para a câmera.";

/**
 * Câmera + detecção facial contínua com @vladmandic/human.
 * Usado pelo terminal de frequência (identificação automática) e pela tela
 * de cadastro facial (enrollment). O descritor (embedding) só fica disponível
 * em memória no navegador; quem decide o que fazer com ele é quem chama o hook.
 */
export function useFaceScanner() {
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const [facingMode, setFacingMode] = useState("user");
  const [faces, setFaces] = useState([]);
  const [faceDetectorReady, setFaceDetectorReady] = useState(false);
  const [faceDetectionError, setFaceDetectionError] = useState("");
  const [faceQuality, setFaceQuality] = useState({ ready: false, message: IDLE_MESSAGE });
  const [faceDistance, setFaceDistance] = useState(0);

  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const detectorRef = useRef(null);
  const detectionFrameRef = useRef(null);
  const lastDetectionRef = useRef(0);
  const cameraReadyRef = useRef(false);
  const detectionBusyRef = useRef(false);
  const stableFramesRef = useRef(0);
  const lastResultRef = useRef(null);

  const stopFaceDetection = () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current);
    detectionFrameRef.current = null;
    setFaces([]);
    setFaceQuality({ ready: false, message: IDLE_MESSAGE });
    setFaceDistance(0);
    stableFramesRef.current = 0;
    lastResultRef.current = null;
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
          mesh: { enabled: true },
          attention: { enabled: false },
          iris: { enabled: true },
          description: { enabled: true },
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
        lastResultRef.current = result;
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
              : IDLE_MESSAGE,
          });
        } else {
          const normalizedBox = getNormalizedFaceBox(face, width, height);
          const centerX = normalizedBox.x + normalizedBox.width / 2;
          const centerY = normalizedBox.y + normalizedBox.height / 2;
          const area = normalizedBox.width * normalizedBox.height;
          const faceWidth = normalizedBox.width;
          const faceHeight = normalizedBox.height;
          const distance = Math.max(0, Math.min(1, (faceHeight - 0.16) / 0.65));
          setFaceDistance(distance);

          const centered = centerX >= 0.25 && centerX <= 0.75 && centerY >= 0.20 && centerY <= 0.80;
          const goodSize = faceHeight >= 0.16 && faceHeight <= 0.95 && faceWidth >= 0.08 && faceWidth <= 0.90;
          const goodConfidence = score >= 0.40;
          const facingCenter = gestures.length === 0 || gestures.includes("facing center");
          const lookingCenter = gestures.length === 0 || gestures.includes("looking center");
          const hasDescriptor = Array.isArray(face?.embedding) && face.embedding.length > 0;
          const readyNow = centered && goodSize && goodConfidence && facingCenter && lookingCenter && hasDescriptor;

          if (readyNow) stableFramesRef.current += 1;
          else stableFramesRef.current = 0;

          const ready = stableFramesRef.current >= 2;
          let message = "Rosto detectado.";

          if (!goodConfidence) message = "Melhore a iluminação e olhe para a câmera.";
          else if (faceHeight < 0.16 || area < 0.018) message = "Aproxime-se um pouco da câmera.";
          else if (faceHeight > 0.95 || area > 0.85) message = "Afaste-se um pouco da câmera.";
          else if (centerX < 0.30) message = "Mova o rosto para a direita.";
          else if (centerX > 0.70) message = "Mova o rosto para a esquerda.";
          else if (centerY < 0.27) message = "Mova o rosto um pouco para baixo.";
          else if (centerY > 0.80) message = "Mova o rosto um pouco para cima.";
          else if (!facingCenter) message = "Vire o rosto para a câmera.";
          else if (!lookingCenter) message = IDLE_MESSAGE;
          else if (!hasDescriptor) message = "Processando o rosto...";
          else if (ready) message = "ROSTO PRONTO";

          setFaceQuality({ ready, message });
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

  const getDescriptor = useCallback(() => {
    const face = lastResultRef.current?.face?.[0];
    const embedding = face?.embedding;
    return Array.isArray(embedding) && embedding.length > 0 ? Array.from(embedding).map(Number) : null;
  }, []);

  const getConfidence = useCallback(() => {
    const face = lastResultRef.current?.face?.[0];
    const score = face?.boxScore ?? face?.score ?? null;
    return typeof score === "number" ? score : null;
  }, []);

  useEffect(() => {
    void startCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [facingMode]);

  useEffect(() => () => {
    stopCamera();
    detectorRef.current?.tf?.disposeVariables?.();
    detectorRef.current = null;
  }, []);

  return {
    videoRef,
    cameraReady,
    cameraStarting,
    cameraError,
    faces,
    faceDetectorReady,
    faceDetectionError,
    faceQuality,
    faceDistance,
    switchCamera,
    getDescriptor,
    getConfidence,
  };
}

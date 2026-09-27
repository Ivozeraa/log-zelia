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
  const descriptorBufferRef = useRef([]);
  const descriptorFaceIdRef = useRef(null);
  const lastDescriptorSampleRef = useRef(0);

  const stopFaceDetection = () => {
    if (detectionFrameRef.current) cancelAnimationFrame(detectionFrameRef.current);
    detectionFrameRef.current = null;
    setFaces([]);
    setFaceQuality({ ready: false, message: IDLE_MESSAGE });
    setFaceDistance(0);
    stableFramesRef.current = 0;
    lastResultRef.current = null;
    descriptorBufferRef.current = [];
    descriptorFaceIdRef.current = null;
    lastDescriptorSampleRef.current = 0;
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
        cacheSensitivity: 0.01,
        filter: { enabled: true, equalization: true, autoBrightness: true, flip: false },
        face: {
          enabled: true,
          detector: {
            rotation: true,
            maxDetected: 3,
            minConfidence: 0.50,
            minSize: 96,
            return: false,
            square: true,
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
        const score = Number(face?.score ?? 0);
        const boxScore = Number(face?.boxScore ?? 0);
        const meshScore = Number(face?.faceScore ?? 0);

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
          const distance = Math.max(0, Math.min(1, (faceHeight - 0.12) / 0.72));
          setFaceDistance(distance);

          const centered = centerX >= 0.22 && centerX <= 0.78 && centerY >= 0.18 && centerY <= 0.82;
          const goodSize = faceHeight >= 0.12 && faceHeight <= 1.00 && faceWidth >= 0.065 && faceWidth <= 1.00;
          const goodConfidence = score >= 0.55 && boxScore >= 0.50 && meshScore >= 0.45;
          const rotation = face?.rotation?.angle;
          const yaw = Number(rotation?.yaw ?? 0);
          const pitch = Number(rotation?.pitch ?? 0);
          const roll = Number(rotation?.roll ?? 0);
          const goodRotation = Math.abs(yaw) <= 24 && Math.abs(pitch) <= 20 && Math.abs(roll) <= 22;
          const facingCenter = goodRotation;
          const lookingCenter = true;
          const hasDescriptor = Array.isArray(face?.embedding) && face.embedding.length > 0;
          const readyNow = centered && goodSize && goodConfidence && facingCenter && lookingCenter && hasDescriptor;

          if (readyNow) {
            stableFramesRef.current += 1;

            const faceId = face?.id ?? null;
            if (faceId !== null && descriptorFaceIdRef.current !== faceId) {
              descriptorBufferRef.current = [];
              descriptorFaceIdRef.current = faceId;
              lastDescriptorSampleRef.current = 0;
            }

            const now = performance.now();
            if (now - lastDescriptorSampleRef.current >= 120) {
              const embedding = face?.embedding;
              if (Array.isArray(embedding) && embedding.length > 0) {
                const cleaned = embedding.map(Number).filter(Number.isFinite);
                if (cleaned.length === embedding.length) {
                  descriptorBufferRef.current = [...descriptorBufferRef.current, cleaned].slice(-8);
                  lastDescriptorSampleRef.current = now;
                }
              }
            }
          } else {
            stableFramesRef.current = 0;
            descriptorBufferRef.current = [];
            descriptorFaceIdRef.current = null;
            lastDescriptorSampleRef.current = 0;
          }

          const ready = stableFramesRef.current >= 4 && descriptorBufferRef.current.length >= 4;
          let message = "Rosto detectado.";

          if (!goodConfidence) message = "Melhore a iluminação e olhe para a câmera.";
          else if (faceHeight < 0.12 || area < 0.012) message = "Aproxime-se um pouco da câmera.";
          else if (faceHeight > 1.00 || area > 0.95) message = "Afaste-se um pouco da câmera.";
          else if (centerX < 0.30) message = "Mova o rosto para a direita.";
          else if (centerX > 0.70) message = "Mova o rosto para a esquerda.";
          else if (centerY < 0.27) message = "Mova o rosto um pouco para baixo.";
          else if (centerY > 0.80) message = "Mova o rosto um pouco para cima.";
          else if (!facingCenter) message = "Aponte o rosto um pouco mais para a câmera.";
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
        video: {
          facingMode,
          width: { ideal: 1920, max: 1920 },
          height: { ideal: 1080, max: 1080 },
          frameRate: { ideal: 30, max: 30 },
        },
      });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        throw new Error("VIDEO_ELEMENT_NOT_READY");
      }

      streamRef.current = stream;

      const track = stream.getVideoTracks()[0];
      const capabilities = track?.getCapabilities?.();
      if (capabilities?.focusMode?.includes?.("continuous")) {
        try { await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] }); } catch { /* opcional */ }
      }
      if (capabilities?.exposureMode?.includes?.("continuous")) {
        try { await track.applyConstraints({ advanced: [{ exposureMode: "continuous" }] }); } catch { /* opcional */ }
      }

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
    const samples = descriptorBufferRef.current;
    if (!Array.isArray(samples) || samples.length === 0) return null;

    const dimension = samples[0]?.length || 0;
    if (!dimension || samples.some((sample) => sample.length !== dimension)) return null;

    const averaged = new Array(dimension).fill(0);
    for (const sample of samples) {
      for (let index = 0; index < dimension; index += 1) {
        averaged[index] += Number(sample[index]) || 0;
      }
    }

    for (let index = 0; index < dimension; index += 1) averaged[index] /= samples.length;

    const norm = Math.sqrt(averaged.reduce((sum, value) => sum + value * value, 0));
    return norm > 0 ? averaged.map((value) => value / norm) : null;
  }, []);

  const getConfidence = useCallback(() => {
    const face = lastResultRef.current?.face?.[0];
    const score = Number(face?.score ?? NaN);
    return Number.isFinite(score) ? Math.max(0, Math.min(1, score)) : null;
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

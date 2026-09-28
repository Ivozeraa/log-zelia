import { useEffect, useState } from "react";
import { FaCamera, FaCheckCircle, FaExclamationTriangle, FaStop } from "react-icons/fa";
import { CameraPreview } from "../components/frequencia-camera/CameraPreview";
import { requestCameraStream, stopCameraStream } from "../services/cameraService";

export const FrequenciaCameraIA = () => {
  const [stream, setStream] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const iniciarCamera = async () => {
    setLoading(true);
    setError("");
    try {
      const nextStream = await requestCameraStream();
      setStream((previousStream) => {
        stopCameraStream(previousStream);
        return nextStream;
      });
    } catch (cameraError) {
      console.error("[Frequência por câmera]", cameraError);
      setError(cameraError?.name === "NotAllowedError" ? "A permissão para usar a câmera foi negada." : "Não foi possível iniciar a câmera. Verifique se ela está disponível.");
    } finally {
      setLoading(false);
    }
  };

  const pararCamera = () => {
    stopCameraStream(stream);
    setStream(null);
  };

  useEffect(() => () => stopCameraStream(stream), [stream]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">Frequência por câmera</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Etapa 1: validar a captura de vídeo antes da detecção facial.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(280px,1fr)]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <CameraPreview stream={stream} />
          <div className="mt-4 flex flex-wrap gap-3">
            {!stream ? (
              <button type="button" onClick={iniciarCamera} disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-green-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"><FaCamera />{loading ? "Iniciando..." : "Iniciar câmera"}</button>
            ) : (
              <button type="button" onClick={pararCamera} className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white"><FaStop />Parar câmera</button>
            )}
          </div>
        </section>
        <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Status</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex items-center gap-3">{stream ? <FaCheckCircle className="text-green-600" /> : <FaCamera className="text-slate-400" />}<span>{stream ? "Câmera conectada" : "Câmera não iniciada"}</span></div>
            <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span>Detecção facial: aguardando</span></div>
            <div className="flex items-center gap-3"><span className="h-2.5 w-2.5 rounded-full bg-slate-300" /><span>Reconhecimento: aguardando</span></div>
          </div>
          {error && <div className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><FaExclamationTriangle className="mt-0.5 shrink-0" /><span>{error}</span></div>}
        </aside>
      </div>
    </div>
  );
};

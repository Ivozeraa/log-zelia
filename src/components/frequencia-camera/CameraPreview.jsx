import { useEffect, useRef } from "react";

export const CameraPreview = ({ stream, mirrored = true }) => {
  const videoRef = useRef(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    video.srcObject = stream || null;
    return () => {
      video.srcObject = null;
    };
  }, [stream]);

  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-slate-950">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={`h-full w-full object-cover ${mirrored ? "-scale-x-100" : ""}`}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-sm text-slate-400">
          Câmera desligada
        </div>
      )}
    </div>
  );
};

export async function requestCameraStream(constraints = {}) {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Este navegador não disponibiliza acesso à câmera.");
  }

  const defaultConstraints = {
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
    audio: false,
  };

  return navigator.mediaDevices.getUserMedia({
    ...defaultConstraints,
    ...constraints,
  });
}

export function stopCameraStream(stream) {
  stream?.getTracks().forEach((track) => track.stop());
}

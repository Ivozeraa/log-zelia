import Human from "@vladmandic/human";

let humanInstance;

export function getHumanInstance() {
  if (!humanInstance) {
    humanInstance = new Human({
      modelBasePath: "https://cdn.jsdelivr.net/npm/@vladmandic/human@3.3.6/models/",
      face: {
        enabled: true,
        detector: { rotation: true, maxDetected: 10 },
        mesh: { enabled: true },
        description: { enabled: true },
      },
      body: { enabled: false },
      hand: { enabled: false },
      object: { enabled: false },
      gesture: { enabled: false },
    });
  }

  return humanInstance;
}

export async function detectFaces(input) {
  const human = getHumanInstance();
  await human.load();
  await human.warmup();
  return human.detect(input);
}

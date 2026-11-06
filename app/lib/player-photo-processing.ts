import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";
import { env, InferenceSession, Tensor } from "onnxruntime-web/wasm";

export type PhotoFrame = { x: number; y: number; size: number };
export type PreparedPhoto = { original: HTMLCanvasElement; cutout: HTMLCanvasElement | null; faces: PhotoFrame[]; frame: PhotoFrame; warning: string; alreadyPrepared?: boolean };
let models: Promise<FaceDetector> | undefined;
let matting: Promise<InferenceSession> | undefined;
const preparations = new WeakMap<File, Promise<PreparedPhoto>>();
let preparationQueue: Promise<void> = Promise.resolve();

function clampFrame(frame: PhotoFrame, width: number, height: number): PhotoFrame {
  return { x: Math.max(0, Math.min(width, frame.x)), y: Math.max(0, Math.min(height, frame.y)), size: Math.max(1, frame.size) };
}

export function preparePlayerPhoto(file: File): Promise<PreparedPhoto> {
  const existing = preparations.get(file); if (existing) return existing;
  // React development effects can run twice; one session cannot infer concurrently.
  const result = preparationQueue.then(() => processPlayerPhoto(file));
  preparations.set(file, result); preparationQueue = result.then(() => undefined, () => undefined);
  void result.catch(() => preparations.delete(file)); return result;
}

function loadModels() {
  models ??= (async () => {
    const files = await FilesetResolver.forVisionTasks("/vision/wasm");
    return FaceDetector.createFromOptions(files, { baseOptions: { modelAssetPath: "/vision/face-detector.tflite" }, runningMode: "IMAGE", minDetectionConfidence: 0.4 });
  })().catch((error) => { models = undefined; throw error; });
  return models;
}

function canvas(width: number, height: number) {
  const result = document.createElement("canvas"); result.width = width; result.height = height; return result;
}

async function portraitMatte(original: HTMLCanvasElement) {
  env.wasm.wasmPaths = "/vision/ort/"; env.wasm.numThreads = 1;
  matting ??= InferenceSession.create("/vision/modnet.onnx", { executionProviders: ["wasm"] }).catch((error) => { matting = undefined; throw error; });
  const session = await matting;
  const scale = 512 / Math.min(original.width, original.height);
  const width = Math.max(32, Math.min(1024, Math.round(original.width * scale / 32) * 32));
  const height = Math.max(32, Math.min(1024, Math.round(original.height * scale / 32) * 32));
  const resized = canvas(width, height); const context = resized.getContext("2d")!;
  context.drawImage(original, 0, 0, width, height);
  const pixels = context.getImageData(0, 0, width, height).data; const area = width * height;
  const values = new Float32Array(area * 3);
  for (let i = 0; i < area; i++) for (let channel = 0; channel < 3; channel++) values[channel * area + i] = pixels[i * 4 + channel] / 127.5 - 1;
  const input = new Tensor("float32", values, [1, 3, height, width]);
  let result: Awaited<ReturnType<InferenceSession["run"]>> | undefined;
  try {
    result = await session.run({ [session.inputNames[0]]: input });
    const output = result[session.outputNames[0]]; const alpha = output.data as Float32Array;
    const maskWidth = output.dims.at(-1)!; const maskHeight = output.dims.at(-2)!;
    const mask = canvas(maskWidth, maskHeight); const maskContext = mask.getContext("2d")!;
    const image = maskContext.createImageData(maskWidth, maskHeight);
    for (let i = 0; i < alpha.length; i++) {
      const x = i % maskWidth; const y = Math.floor(i / maskWidth);
      let value = alpha[i];
      for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = x + ox; const ny = y + oy;
        if (nx >= 0 && nx < maskWidth && ny >= 0 && ny < maskHeight) value = Math.max(value, alpha[ny * maskWidth + nx] * 0.72);
      }
      image.data[i * 4 + 3] = Math.round(Math.max(0, Math.min(1, value)) * 255);
    }
    maskContext.putImageData(image, 0, 0);
    const cutout = canvas(original.width, original.height); const target = cutout.getContext("2d")!;
    target.drawImage(original, 0, 0); target.globalCompositeOperation = "destination-in";
    target.drawImage(mask, 0, 0, original.width, original.height); target.globalCompositeOperation = "source-over";
    return cutout;
  } finally { input.dispose(); if (result) Object.values(result).forEach((tensor) => tensor.dispose()); }
}

async function processPlayerPhoto(file: File): Promise<PreparedPhoto> {
  if (!file.size || file.size > 8_000_000 || !["image/jpeg", "image/png", "image/webp"].includes(file.type)) throw new Error("Elige una imagen PNG, JPG o WebP de hasta 8 MB.");
  const bitmap = await createImageBitmap(file);
  if (bitmap.width * bitmap.height > 30_000_000) { bitmap.close(); throw new Error("La imagen supera los 30 megapixeles."); }
  const scale = Math.min(1, 2400 / Math.max(bitmap.width, bitmap.height));
  const original = canvas(Math.max(1, Math.round(bitmap.width * scale)), Math.max(1, Math.round(bitmap.height * scale)));
  original.getContext("2d")!.drawImage(bitmap, 0, 0, original.width, original.height); bitmap.close();
  const fallback = { x: original.width / 2, y: original.height / 2, size: Math.min(original.width, original.height) };
  const sample = canvas(64, 64); sample.getContext("2d")!.drawImage(original, 0, 0, 64, 64);
  const rgba = sample.getContext("2d")!.getImageData(0, 0, 64, 64).data;
  let transparent = 0; for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 240) transparent++;
  // A supplied cutout must retain its pixels and framing, not be segmented again.
  if (transparent > 40) return { original, cutout: null, faces: [], frame: { ...fallback, size: Math.max(original.width, original.height) }, warning: "", alreadyPrepared: true };
  try {
    const detector = await loadModels();
    const faces = detector.detect(original).detections.flatMap(({ boundingBox: box }) => box ? [clampFrame({
      x: box.originX + box.width / 2,
      y: box.originY + box.height * 1.55,
      size: Math.max(box.width * 5.2, box.height * 5.2),
    }, original.width, original.height)] : []).sort((a, b) => b.size - a.size);
    const cutout = await portraitMatte(original).catch((error: unknown) => { console.warn("Portrait matting unavailable", error); return null; });
    return { original, cutout, faces, frame: faces[0] ?? fallback, warning: !cutout ? "No se ha podido separar el fondo. Puedes guardar la foto con su fondo original." : !faces.length ? "No se ha detectado una cara. Revisa el encuadre." : faces.length > 1 ? "Se han detectado varias caras. Selecciona al jugador." : "" };
  } catch {
    return { original, cutout: null, faces: [], frame: fallback, warning: "El tratamiento automático no está disponible. Puedes ajustar el encuadre y conservar el fondo." };
  }
}

export function drawPlayerPortrait(target: HTMLCanvasElement, photo: PreparedPhoto, frame: PhotoFrame, removeBackground: boolean) {
  const context = target.getContext("2d")!; const size = target.width;
  context.clearRect(0, 0, size, size); context.save(); context.beginPath(); context.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2); context.clip();
  context.fillStyle = "#e2e7ea"; context.fillRect(0, 0, size, size);
  const source = removeBackground && photo.cutout ? photo.cutout : photo.original;
  const scale = size / frame.size;
  context.drawImage(source, size / 2 - frame.x * scale, size / 2 - frame.y * scale, source.width * scale, source.height * scale);
  context.restore(); context.beginPath(); context.arc(size / 2, size / 2, size / 2 - size / 120, 0, Math.PI * 2); context.strokeStyle = "white"; context.lineWidth = size / 100; context.stroke();
}

export function drawPlayerCover(target: HTMLCanvasElement, photo: PreparedPhoto, frame: PhotoFrame, removeBackground: boolean) {
  const context = target.getContext("2d")!;
  const source = removeBackground && photo.cutout ? photo.cutout : photo.original;
  const scale = target.width / frame.size;
  context.clearRect(0, 0, target.width, target.height);
  context.drawImage(source, target.width / 2 - frame.x * scale, target.height / 2 - frame.y * scale, source.width * scale, source.height * scale);
}

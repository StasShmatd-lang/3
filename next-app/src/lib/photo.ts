/** Decode a phone photo. createImageBitmap first; <img> as a fallback (older iOS, odd camera files). */
async function decodeImage(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() };
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.decoding = "async";
      img.src = url;
      await img.decode();
      return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => URL.revokeObjectURL(url) };
    } catch {
      URL.revokeObjectURL(url);
      throw new Error("Не получилось открыть фото — попробуйте снять ещё раз");
    }
  }
}

export async function fileToDataUrl(
  file: File,
  opts?: { maxSide?: number; maxChars?: number },
): Promise<string> {
  // Some phones hand over camera shots with an empty type — let the decoder decide.
  if (file.type && !file.type.startsWith("image/")) throw new Error("Нужно изображение");
  const img = await decodeImage(file);
  const maxSide = opts?.maxSide ?? 960;
  const maxChars = opts?.maxChars ?? 350_000;
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
  const w = Math.max(1, Math.round(img.width * scale));
  const h = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.drawImage(img.source, 0, 0, w, h);
  img.done();
  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  if (!out.startsWith("data:image/jpeg")) throw new Error("Браузер не смог сжать фото");
  while (out.length > maxChars - 30_000 && quality > 0.4) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  if (out.length > maxChars) throw new Error("Фото слишком большое");
  return out;
}

const JPEG_PREFIX = "data:image/jpeg;base64,";

/**
 * Accept only a real JPEG: base64 alphabet + JPEG magic bytes (FF D8 FF → "/9j/").
 * (The old check searched the base64 text for "svg" — random photo data contains
 * those three letters often, so roughly every other photo was rejected.)
 */
export function assertJpegDataUrl(value: string, maxChars: number) {
  if (typeof value !== "string" || !value.startsWith(JPEG_PREFIX)) {
    throw new Error("Только JPEG data-URL");
  }
  if (value.length > maxChars) throw new Error("Фото слишком большое");
  const b64 = value.slice(JPEG_PREFIX.length);
  if (!b64.startsWith("/9j/") || !/^[A-Za-z0-9+/]+={0,2}$/.test(b64)) {
    throw new Error("Недопустимое изображение");
  }
}

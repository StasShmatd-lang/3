export async function fileToDataUrl(
  file: File,
  opts?: { maxSide?: number; maxChars?: number },
): Promise<string> {
  if (!file.type.startsWith("image/")) throw new Error("Нужно изображение");
  const bitmap = await createImageBitmap(file);
  const maxSide = opts?.maxSide ?? 960;
  const maxChars = opts?.maxChars ?? 350_000;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas недоступен");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  let quality = 0.82;
  let out = canvas.toDataURL("image/jpeg", quality);
  while (out.length > maxChars - 30_000 && quality > 0.4) {
    quality -= 0.1;
    out = canvas.toDataURL("image/jpeg", quality);
  }
  if (out.length > maxChars) throw new Error("Фото слишком большое");
  return out;
}

export function assertJpegDataUrl(value: string, maxChars: number) {
  if (typeof value !== "string" || !value.startsWith("data:image/jpeg;base64,")) {
    throw new Error("Только JPEG data-URL");
  }
  if (value.length > maxChars) throw new Error("Фото слишком большое");
  if (value.includes("svg") || value.includes("<script")) {
    throw new Error("Недопустимое изображение");
  }
}

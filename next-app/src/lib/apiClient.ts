import { readJson } from "./json";

export async function api<T>(
  path: string,
  opts?: { method?: string; body?: unknown; token?: string },
): Promise<T> {
  const headers: Record<string, string> = {};
  if (opts?.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts?.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(path, {
    method: opts?.method ?? (opts?.body !== undefined ? "POST" : "GET"),
    headers,
    body: opts?.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });
  const data = await readJson<T & { error?: string }>(res);
  if (!res.ok) throw new Error(data.error || `Ошибка ${res.status}`);
  return data;
}

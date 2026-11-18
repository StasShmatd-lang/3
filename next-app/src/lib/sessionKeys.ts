export function persistToken(kind: "host" | "screen" | "guest", eventId: string, token: string) {
  const key = `ph-${kind}:${eventId}`;
  try {
    localStorage.setItem(key, token);
    sessionStorage.setItem(key, token);
  } catch {
    // privacy mode / blocked storage
  }
}

export function loadToken(kind: "host" | "screen" | "guest", eventId: string) {
  const key = `ph-${kind}:${eventId}`;
  try {
    return localStorage.getItem(key) || sessionStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

export function readHashParam(name: string) {
  if (typeof window === "undefined") return "";
  const raw = window.location.hash.replace(/^#/, "");
  return (new URLSearchParams(raw).get(name) || "").trim();
}

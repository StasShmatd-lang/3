"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import type { PollState } from "@/lib/types";

export function usePollState(eventId: string | undefined, token: string | undefined) {
  const [state, setState] = useState<PollState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const refresh = useCallback(async () => {
    if (!eventId || !tokenRef.current) return;
    try {
      const next = await api<PollState>(`/api/state?eventId=${encodeURIComponent(eventId)}`, {
        token: tokenRef.current,
      });
      setState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка синхронизации");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !token) {
      setLoading(false);
      return;
    }
    void refresh();
    const id = window.setInterval(() => void refresh(), 1200);
    return () => window.clearInterval(id);
  }, [eventId, token, refresh]);

  return { state, error, loading, refresh, setState };
}

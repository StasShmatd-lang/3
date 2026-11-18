"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/apiClient";
import type { PollState } from "@/lib/types";

const POLL_MS = 2000;

export function usePollState(eventId: string | undefined, token: string | undefined) {
  const [state, setState] = useState<PollState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(eventId && token));
  const tokenRef = useRef(token);
  tokenRef.current = token;
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!eventId || !tokenRef.current || inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await api<PollState>(`/api/state?eventId=${encodeURIComponent(eventId)}`, {
        token: tokenRef.current,
      });
      setState(next);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка синхронизации");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (!eventId || !token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void refresh();
    const id = window.setInterval(() => void refresh(), POLL_MS);
    return () => window.clearInterval(id);
  }, [eventId, token, refresh]);

  return { state, error, loading, refresh, setState };
}

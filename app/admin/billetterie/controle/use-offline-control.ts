"use client";

import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { offlineVerdict, tokenHash, type OfflineList, type OfflineScan } from "@/lib/offline-control";
import { ticketTokenFrom, type ScanRefusal } from "@/lib/ticketing";
import type { SyncState } from "../actions";

/** Stockage local tolérant : navigation privée ou stockage plein ne doivent pas bloquer le contrôle. */
const store = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* stockage indisponible : la file reste en mémoire */
    }
  },
};

function subscribeOnline(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

export type LocalResult =
  | { ok: true; at: string; ticket: { number: string; holderName: string; category: string; gate: string } }
  | { ok: false; at: string; reason: ScanRefusal };

/**
 * Contrôle hors ligne (EF-CTL-06) : liste préchargée (empreintes), décision locale, file des passages
 * conservée sur l'appareil et synchronisée au retour du réseau.
 */
export function useOfflineControl(eventId: number, sync: (scans: OfflineScan[]) => Promise<SyncState>) {
  const listKey = `fcf-offline-list-${eventId}`;
  const queueKey = `fcf-offline-queue-${eventId}`;
  const online = useSyncExternalStore(subscribeOnline, () => navigator.onLine, () => true);
  const [list, setList] = useState<OfflineList | null>(() => (typeof window === "undefined" ? null : store.get<OfflineList | null>(listKey, null)));
  const [queue, setQueue] = useState<(OfflineScan & { h: string })[]>(() => (typeof window === "undefined" ? [] : store.get(queueKey, [])));
  const [syncResult, setSyncResult] = useState<SyncState | null>(null);
  const [syncing, setSyncing] = useState(false);

  const byHash = useMemo(() => new Map((list?.tickets ?? []).map((t) => [t.h, t])), [list]);
  const usedHere = useMemo(() => new Set(queue.map((q) => q.h)), [queue]);

  const download = useCallback(async () => {
    const res = await fetch(`/admin/billetterie/controle/${eventId}/liste`, { cache: "no-store" });
    if (!res.ok) throw new Error("Téléchargement impossible.");
    const data = (await res.json()) as OfflineList;
    store.set(listKey, data);
    setList(data);
  }, [eventId, listKey]);

  /** Décision locale pour un code lu sans réseau. */
  const verifyLocal = useCallback(
    async (scanned: string, gate: string): Promise<LocalResult> => {
      const at = new Date().toISOString();
      const token = ticketTokenFrom(scanned);
      const h = token ? await tokenHash(token) : "";
      const ticket = byHash.get(h);
      const refusal = offlineVerdict(ticket, usedHere);
      if (refusal || !ticket || !token) return { ok: false, at, reason: refusal ?? "UNKNOWN" };
      // Badge presse : entrée sans file à synchroniser (entrées multiples autorisées).
      if (ticket.badge) return { ok: true, at, ticket: { number: ticket.number, holderName: ticket.holder, category: ticket.category, gate: ticket.gate } };
      const next = [...queue, { token, gate, at, h }];
      store.set(queueKey, next);
      setQueue(next);
      return { ok: true, at, ticket: { number: ticket.number, holderName: ticket.holder, category: ticket.category, gate: ticket.gate } };
    },
    [byHash, usedHere, queue, queueKey],
  );

  const syncNow = useCallback(async () => {
    if (queue.length === 0 || syncing) return;
    setSyncing(true);
    try {
      const result = await sync(queue.map(({ token, gate, at }) => ({ token, gate, at })));
      setSyncResult(result);
      if (!("error" in result)) {
        store.set(queueKey, []);
        setQueue([]);
      }
    } finally {
      setSyncing(false);
    }
  }, [queue, queueKey, sync, syncing]);

  // Synchronisation automatique dès le retour du réseau (planifiée hors du rendu de l'effet).
  useEffect(() => {
    if (!online || queue.length === 0) return;
    const timer = setTimeout(() => void syncNow(), 0);
    return () => clearTimeout(timer);
  }, [online, queue.length, syncNow]);

  return { online, list, download, queue, verifyLocal, syncNow, syncing, syncResult };
}

"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/format";
import type { OfflineScan } from "@/lib/offline-control";
import { SCAN_REFUSAL_LABELS } from "@/lib/ticketing";
import { useActionForm } from "@/lib/use-action-form";
import type { ScanState, SyncState } from "../actions";
import { useOfflineControl, type LocalResult } from "./use-offline-control";

const noop = () => () => {};

type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> };
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => BarcodeDetectorLike;
  }
}

/**
 * Poste de contrôle (EF-CTL-01) : caméra du téléphone ou de la tablette (si le navigateur sait lire
 * les QR codes), douchette (elle « tape » le contenu suivi d'Entrée) ou saisie manuelle.
 */
export function Scanner({
  action,
  sync,
  eventId,
  initialEntries,
}: {
  action: (s: ScanState, f: FormData) => Promise<ScanState>;
  sync: (scans: OfflineScan[]) => Promise<SyncState>;
  eventId: number;
  initialEntries: number;
}) {
  const { state, pending, formProps } = useActionForm(action);
  const offline = useOfflineControl(eventId, sync);
  // Rendu identique serveur / navigateur : le bloc hors ligne (stockage local) n'apparaît qu'une fois la page active.
  const isClient = useSyncExternalStore(noop, () => true, () => false);
  const [local, setLocal] = useState<LocalResult | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [camera, setCamera] = useState<"off" | "on" | "unsupported">("off");
  const lastRead = useRef({ value: "", at: 0 });

  // Après chaque contrôle : champ vidé et prêt pour le billet suivant.
  useEffect(() => {
    if (codeRef.current) {
      codeRef.current.value = "";
      codeRef.current.focus();
    }
  }, [state, local]);

  // Sans réseau, avec une liste préchargée : décision locale (EF-CTL-06).
  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    if (offline.online || !offline.list) return formProps.onSubmit(e);
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    setLocal(await offline.verifyLocal(String(data.get("code") ?? ""), String(data.get("gate") ?? "—")));
  };

  // Dernier résultat affiché : serveur ou décision locale, selon le plus récent.
  const result = local && (!state || local.at > state.at) ? local : state;

  useEffect(() => {
    if (camera !== "on") return;
    let stream: MediaStream | null = null;
    let stopped = false;
    const detector = new window.BarcodeDetector!({ formats: ["qr_code"] });
    (async () => {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      if (!videoRef.current) return;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      while (!stopped) {
        const codes = await detector.detect(videoRef.current).catch(() => []);
        const value = codes[0]?.rawValue;
        // Le même QR reste devant la caméra : on ne le relit pas pendant 3 secondes.
        if (value && (value !== lastRead.current.value || Date.now() - lastRead.current.at > 3000)) {
          lastRead.current = { value, at: Date.now() };
          if (codeRef.current) {
            codeRef.current.value = value;
            codeRef.current.form?.requestSubmit();
          }
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    })().catch(() => setCamera("unsupported"));
    return () => {
      stopped = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [camera]);

  const entries = (state?.entries ?? initialEntries) + offline.queue.length;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Entrées : <strong className="text-2xl tabular-nums" data-testid="entries">{entries}</strong>
      </p>

      {isClient && (
        <div className="flex flex-col gap-2 rounded-lg border p-3 text-sm" data-testid="offline-panel">
          <p>
            Réseau : <strong className={offline.online ? "text-[var(--flag-green)]" : "text-destructive"}>{offline.online ? "connecté" : "hors ligne"}</strong>
            {offline.list ? (
              <> · liste hors ligne : {offline.list.tickets.length} billet(s), téléchargée le {formatDateTime(new Date(offline.list.downloadedAt))}</>
            ) : (
              <> · mode hors ligne non préparé</>
            )}
          </p>
          {offline.queue.length > 0 && (
            <p className="font-semibold" data-testid="offline-queue">
              {offline.queue.length} passage(s) enregistré(s) hors ligne, à synchroniser.
            </p>
          )}
          {offline.syncResult &&
            ("error" in offline.syncResult ? (
              <p className="text-destructive">{offline.syncResult.error}</p>
            ) : (
              <p data-testid="offline-sync">
                Synchronisation : {offline.syncResult.accepted} entrée(s) enregistrée(s)
                {offline.syncResult.conflicts.length > 0 &&
                  ` · ${offline.syncResult.conflicts.length} conflit(s) : ${offline.syncResult.conflicts.map((c) => `…${c.code} (${SCAN_REFUSAL_LABELS[c.reason as keyof typeof SCAN_REFUSAL_LABELS] ?? c.reason})`).join(", ")}`}
              </p>
            ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              disabled={!offline.online}
              onClick={() => offline.download().then(() => setDownloadError(null), (err: Error) => setDownloadError(err.message))}
            >
              {offline.list ? "Actualiser la liste hors ligne" : "Préparer le mode hors ligne"}
            </Button>
            {offline.queue.length > 0 && offline.online && (
              <Button type="button" className="h-9" disabled={offline.syncing} onClick={() => void offline.syncNow()}>
                Synchroniser maintenant
              </Button>
            )}
          </div>
          {downloadError && <p className="text-destructive">{downloadError}</p>}
        </div>
      )}

      <form {...formProps} onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          Porte
          <input name="gate" defaultValue="Porte A" className="h-11 w-32 rounded-md border px-3" />
        </label>
        <label className="flex flex-1 flex-col gap-1.5 text-sm font-medium">
          QR code ou code du billet
          <input ref={codeRef} name="code" autoFocus autoComplete="off" placeholder="Scanner ou saisir…" className="h-11 rounded-md border px-3 font-mono" />
        </label>
        <Button type="submit" disabled={pending} className="h-11">
          Contrôler
        </Button>
      </form>

      {result && (
        <div
          role="status"
          aria-live="assertive"
          className={`rounded-xl p-6 text-center text-white ${result.ok ? "bg-[var(--flag-green)]" : "bg-destructive"}`}
        >
          {result.ok ? (
            <>
              <p className="text-3xl font-extrabold">ENTRÉE AUTORISÉE</p>
              <p className="mt-1 text-lg">{result.ticket.holderName}</p>
              <p className="text-sm">
                {result.ticket.category} · {result.ticket.gate} · {result.ticket.number}
              </p>
            </>
          ) : (
            <>
              <p className="text-3xl font-extrabold">REFUSÉ</p>
              <p className="mt-1 text-lg">{SCAN_REFUSAL_LABELS[result.reason]}</p>
              {"detail" in result && typeof result.detail === "string" && <p className="text-sm">{result.detail}</p>}
            </>
          )}
          {result === local && <p className="mt-2 text-xs">Décision hors ligne — à synchroniser</p>}
        </div>
      )}

      {camera === "on" ? (
        <div className="flex flex-col gap-2">
          <video ref={videoRef} muted playsInline className="aspect-square w-full max-w-sm rounded-lg bg-black object-cover" />
          <Button type="button" variant="outline" className="h-10 w-fit" onClick={() => setCamera("off")}>
            Arrêter la caméra
          </Button>
        </div>
      ) : camera === "unsupported" ? (
        <p className="text-sm text-muted-foreground">Lecture par caméra indisponible sur cet appareil : utilisez une douchette ou la saisie.</p>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-11 w-fit"
          onClick={() => setCamera(typeof window !== "undefined" && window.BarcodeDetector ? "on" : "unsupported")}
        >
          Activer la caméra
        </Button>
      )}
    </div>
  );
}

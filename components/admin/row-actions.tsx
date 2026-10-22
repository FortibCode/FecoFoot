"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";

const ICON = {
  view: "M15 12a3 3 0 11-6 0 3 3 0 016 0zM2.5 12C3.8 7.9 7.6 5 12 5s8.2 2.9 9.5 7c-1.3 4.1-5.1 7-9.5 7s-8.2-2.9-9.5-7z",
  edit: "M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.4-9.6a2 2 0 112.8 2.8L11.8 15H9v-2.8l8.6-8.6z",
  delete: "M19 7l-.9 12.1A2 2 0 0116.1 21H7.9a2 2 0 01-2-1.9L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16",
  power: "M5.6 5.6a9 9 0 1012.8 0M12 3v9",
} as const;

function Svg({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" width={16} height={16} aria-hidden>
      {d.split(/(?=M)/).map((p, i) => (
        <path key={i} d={p} />
      ))}
    </svg>
  );
}

/**
 * Actions d'une ligne de tableau : Voir, Modifier, Supprimer (avec confirmation), ou action de bascule
 * (activer / désactiver). La suppression passe par le serveur, qui la refuse avec la raison si l'élément
 * est rattaché à l'historique (licences, transferts, matchs…).
 */
export function RowActions({
  name,
  viewHref,
  editHref,
  onDelete,
  toggle,
}: {
  /** Nom de l'élément, pour les libellés accessibles et la confirmation. */
  name: string;
  viewHref?: string;
  editHref?: string;
  onDelete?: () => Promise<ActionState>;
  toggle?: { label: string; danger?: boolean; action: () => Promise<unknown> };
}) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    start(async () => {
      const r = await onDelete!();
      if (r?.error) return setError(r.error);
      dialog.current?.close();
      router.refresh();
    });

  return (
    <span className="row-actions">
      {viewHref && (
        <Link href={viewHref} className="row-btn" title="Voir" aria-label={`Voir ${name}`}>
          <Svg d={ICON.view} />
        </Link>
      )}
      {editHref && (
        <Link href={editHref} className="row-btn" title="Modifier" aria-label={`Modifier ${name}`}>
          <Svg d={ICON.edit} />
        </Link>
      )}
      {toggle && (
        <button
          type="button"
          className={`row-btn${toggle.danger ? " is-danger" : ""}`}
          title={toggle.label}
          aria-label={`${toggle.label} : ${name}`}
          disabled={pending}
          onClick={() =>
            start(async () => {
              await toggle.action();
              router.refresh();
            })
          }
        >
          <Svg d={ICON.power} />
        </button>
      )}
      {onDelete && (
        <>
          <button
            type="button"
            className="row-btn is-danger"
            title="Supprimer"
            aria-label={`Supprimer ${name}`}
            onClick={() => {
              setError(null);
              dialog.current?.showModal();
            }}
          >
            <Svg d={ICON.delete} />
          </button>
          <dialog ref={dialog} className="confirm-dialog" aria-labelledby={`del-${name}`} onClose={() => setError(null)}>
            <span className="confirm-dialog-icon" aria-hidden>
              <Svg d={ICON.delete} />
            </span>
            <h2 id={`del-${name}`} className="confirm-dialog-title">
              Supprimer « {name} » ?
            </h2>
            <p className="confirm-dialog-text">Cette action est définitive et sera inscrite au journal d’audit.</p>
            {error && (
              <p role="alert" className="confirm-dialog-error">
                {error}
              </p>
            )}
            <div className="confirm-dialog-actions">
              <button type="button" className="admin-btn admin-btn-outline" onClick={() => dialog.current?.close()}>
                {error ? "Fermer" : "Annuler"}
              </button>
              {!error && (
                <button type="button" className="admin-btn admin-btn-danger" onClick={confirm} disabled={pending}>
                  {pending ? "Suppression…" : "Supprimer"}
                </button>
              )}
            </div>
          </dialog>
        </>
      )}
    </span>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ActionState } from "@/lib/action-state";

/** Bouton « À la une » d'un match (administration) : met en avant ou retire de la page d'accueil. */
export function FeaturedToggle({ action, featured }: { action: (featured: boolean) => Promise<ActionState>; featured: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<ActionState>(undefined);
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button
        type="button"
        aria-pressed={featured}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMessage(await action(!featured));
            router.refresh();
          })
        }
        className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-semibold transition-colors disabled:opacity-60 ${featured ? "border-[var(--flag-yellow)] bg-[color-mix(in_srgb,var(--flag-yellow)_25%,transparent)]" : "bg-background hover:bg-muted"}`}
      >
        <span aria-hidden>{featured ? "★" : "☆"}</span>
        {featured ? "À la une" : "Mettre à la une"}
      </button>
      {message?.error && <span className="text-xs text-destructive">{message.error}</span>}
    </span>
  );
}

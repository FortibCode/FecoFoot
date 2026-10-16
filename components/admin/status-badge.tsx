import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  ok: "bg-[color-mix(in_oklch,var(--flag-green)_15%,transparent)] text-[color-mix(in_oklch,var(--flag-green)_70%,black)]",
  wait: "bg-[color-mix(in_oklch,var(--flag-yellow)_35%,transparent)] text-[color-mix(in_oklch,var(--flag-yellow)_30%,black)]",
  bad: "bg-destructive/10 text-destructive",
  neutral: "bg-muted text-muted-foreground",
} as const;

export type Tone = keyof typeof TONES;

export function StatusBadge({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-block rounded px-1.5 py-0.5 text-xs font-semibold uppercase tracking-wide", TONES[tone])}>
      {children}
    </span>
  );
}

export function licenseTone(status: string): Tone {
  if (status === "VALIDATED") return "ok";
  if (status === "PENDING" || status === "PAID") return "wait";
  if (status === "REJECTED" || status === "SUSPENDED") return "bad";
  return "neutral";
}

export function transferTone(status: string): Tone {
  if (status === "APPROVED") return "ok";
  if (status === "REFUSED") return "bad";
  if (status === "CANCELLED") return "neutral";
  return "wait";
}

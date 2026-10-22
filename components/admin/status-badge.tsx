import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const TONES = {
  ok: "admin-badge admin-badge-ok",
  wait: "admin-badge admin-badge-wait",
  bad: "admin-badge admin-badge-bad",
  neutral: "admin-badge admin-badge-neutral",
} as const;

export type Tone = keyof typeof TONES;

/** Pastille de statut arrondie avec point coloré. */
export function StatusBadge({
  tone,
  children,
}: {
  tone: Tone;
  children: ReactNode;
}) {
  return (
    <span className={cn(TONES[tone])}>
      <span
        aria-hidden
        style={{
          display: "inline-block",
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: "currentColor",
          flexShrink: 0,
        }}
      />
      {children}
    </span>
  );
}

export function licenseTone(status: string): Tone {
  if (status === "VALIDATED") return "ok";
  if (status === "PENDING" || status === "PAID" || status === "TO_CORRECT") return "wait";
  if (status === "REJECTED" || status === "SUSPENDED" || status === "REVOKED") return "bad";
  return "neutral";
}

export function transferTone(status: string): Tone {
  if (status === "APPROVED") return "ok";
  if (status === "REFUSED") return "bad";
  if (status === "CANCELLED") return "neutral";
  return "wait";
}

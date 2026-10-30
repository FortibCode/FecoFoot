"use client";

import Link from "next/link";
import { createContext, use, type ReactNode } from "react";

export type Division = { code: string; name: string };

const DivisionsContext = createContext<Division[]>([]);

/** Divisions nationales lues en base par la mise en page : menu et pied de page en affichent les noms à jour. */
export function DivisionsProvider({ divisions, children }: { divisions: Division[]; children: ReactNode }) {
  return <DivisionsContext value={divisions}>{children}</DivisionsContext>;
}

export const useDivisions = () => use(DivisionsContext);

/** Liens du pied de page vers chaque division nationale. */
export function DivisionFooterLinks() {
  return useDivisions().map((d) => (
    <li key={d.code}>
      <Link href={`/championnats/${d.code}`} className="transition-colors hover:text-[var(--flag-yellow)]">
        {d.name}
      </Link>
    </li>
  ));
}

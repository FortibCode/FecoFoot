import type { Metadata } from "next";
import Link from "next/link";
import { desc, ne } from "drizzle-orm";
import { PublicShell } from "@/components/public/public-shell";
import { COMPETITION_STATUS_LABELS } from "@/lib/competitions";
import { db } from "@/lib/db";
import { competitions } from "@/lib/db/schema";
import { CATEGORY_LABELS, seasonLabel } from "@/lib/licenses";

export const metadata: Metadata = {
  title: "Compétitions — FECOFOOT",
  description: "Calendriers, résultats et classements des compétitions de la Fédération Congolaise de Football.",
};

export default async function PublicCompetitionsPage() {
  const rows = await db.select().from(competitions).where(ne(competitions.status, "DRAFT")).orderBy(desc(competitions.season), competitions.name);
  return (
    <PublicShell eyebrow="Compétitions" title="Compétitions" wide>
      {rows.length === 0 ? (
        <p className="text-muted-foreground">Aucune compétition publiée.</p>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/competitions/${c.slug}`} className="block rounded-lg border p-4 hover:bg-muted">
                <p className="text-xs text-muted-foreground">
                  {seasonLabel(c.season)} · {CATEGORY_LABELS[c.category]}
                  {c.gender === "F" ? " · Féminin" : ""}
                </p>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-muted-foreground">{COMPETITION_STATUS_LABELS[c.status]}</p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}

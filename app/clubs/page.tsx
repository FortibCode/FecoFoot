import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { connection } from "next/server";
import { PublicShell } from "@/components/public/public-shell";
import { db } from "@/lib/db";
import { clubs } from "@/lib/db/schema";
import { ClubLogo } from "@/components/public/club-logo";
import { clubLogos } from "@/lib/club-logos";

export const metadata: Metadata = { title: "Clubs affiliés — FECOFOOT", description: "Les clubs affiliés à la Fédération Congolaise de Football, par ville." };

/** Clubs affiliés par ville (EF-PUB-04). */
export default async function PublicClubsPage() {
  await connection();
  const rows = await db.select().from(clubs).where(eq(clubs.status, "AFFILIATED")).orderBy(asc(clubs.city), asc(clubs.name));
  const cities = [...new Set(rows.map((c) => c.city))];
  const logos = await clubLogos(rows.map((c) => c.id));
  return (
    <PublicShell eyebrow="Clubs" title="Clubs affiliés" wide>
      {cities.length === 0 ? (
        <p className="text-muted-foreground">Aucun club affilié.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {cities.map((city) => (
            <section key={city}>
              <h2 className="mb-4 border-b-2 border-foreground pb-2 text-2xl font-bold uppercase">{city}</h2>
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {rows
                  .filter((c) => c.city === city)
                  .map((c, i) => (
                    <li key={c.id} data-reveal="zoom" style={{ ["--rd" as string]: `${Math.min(i, 8) * 60}ms` }}>
                      <Link
                        href={`/clubs/${c.slug}`}
                        className="group flex h-full flex-col items-center gap-3 rounded-xl bg-muted/60 p-5 text-center transition-all motion-safe:hover:-translate-y-0.5"
                      >
                        <ClubLogo src={logos.get(c.id)} name={c.name} className="size-20 transition-transform duration-300 motion-safe:group-hover:scale-105 sm:size-24" />
                        <span className="font-display text-lg leading-tight font-bold uppercase">{c.name}</span>
                        {(c.stadium || c.foundedYear) && (
                          <span className="text-xs text-muted-foreground">{[c.stadium, c.foundedYear && `Fondé en ${c.foundedYear}`].filter(Boolean).join(" · ")}</span>
                        )}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </PublicShell>
  );
}

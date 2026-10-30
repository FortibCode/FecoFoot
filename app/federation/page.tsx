import type { Metadata } from "next";
import { connection } from "next/server";
import { PublicShell } from "@/components/public/public-shell";
import { GOVERNANCE_BODY_KIND_LABELS, positionRank } from "@/lib/governance";
import { publishedBodies } from "@/lib/queries/governance";
import { siteSettingsRow } from "@/lib/queries/reference";

export const metadata: Metadata = {
  title: "La Fédération — FECOFOOT",
  description: "Comité exécutif, commissions et instances de la Fédération Congolaise de Football : composition et fonctions.",
};

/** Présentation de la fédération et composition de ses instances (gouvernance). */
export default async function FederationPage() {
  await connection();
  const [bodies, settings] = await Promise.all([publishedBodies(), siteSettingsRow()]);
  // Informations institutionnelles : paramètres du portail (administration), seulement celles renseignées.
  const facts = (
    [
      ["Fondée en", settings?.foundedYear ? String(settings.foundedYear) : null],
      ["Siège", settings?.headquarters ?? null],
      ["Affiliations", settings?.affiliations ?? null],
    ] satisfies [string, string | null][]
  ).filter((f): f is [string, string] => f[1] !== null);
  return (
    <PublicShell eyebrow="La Fédération" title="La Fédération" subtitle="Fédération Congolaise de Football · membre de la FIFA, de la CAF et de l'UNIFFAC" wide>
      <div className="flex flex-col gap-10">
        {facts.length > 0 && (
          <section className="grid gap-3 rounded-2xl bg-muted/60 p-6 text-sm sm:grid-cols-3">
            {facts.map(([k, v]) => (
              <div key={k}>
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{k}</p>
                <p className="mt-1 font-semibold">{v}</p>
              </div>
            ))}
          </section>
        )}
        {bodies.length === 0 ? (
          <p className="rounded-xl border border-dashed p-6 text-muted-foreground">La composition des instances sera publiée prochainement.</p>
        ) : (
          bodies.map((b) => {
            const leaders = b.members.filter((m) => positionRank(m.position) <= 1);
            const others = b.members.filter((m) => positionRank(m.position) > 1);
            return (
              <section key={b.id} aria-labelledby={`instance-${b.id}`} className="flex flex-col gap-4">
                <div className="border-b-2 border-foreground pb-2">
                  {GOVERNANCE_BODY_KIND_LABELS[b.kind] !== b.name && (
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--flag-green)]">{GOVERNANCE_BODY_KIND_LABELS[b.kind]}</p>
                  )}
                  <h2 id={`instance-${b.id}`} className="text-2xl">
                    {b.name}
                  </h2>
                </div>
                {b.description && <p className="max-w-3xl text-sm leading-relaxed whitespace-pre-line text-muted-foreground">{b.description}</p>}
                {b.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Composition à publier.</p>
                ) : (
                  <>
                    {leaders.length > 0 && (
                      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {leaders.map((m) => (
                          <li key={m.id} className="flex items-center gap-4 rounded-xl bg-muted/60 p-4">
                            <span aria-hidden className="brand-band grid size-12 shrink-0 place-items-center rounded-full font-display text-lg font-bold">
                              {m.fullName
                                .split(/\s+/)
                                .slice(0, 2)
                                .map((w) => w[0])
                                .join("")
                                .toUpperCase()}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-xs font-semibold uppercase tracking-wider text-[var(--flag-green)]">{m.position}</span>
                              <span className="block font-bold">{m.fullName}</span>
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {others.length > 0 && (
                      <ul className="grid gap-x-6 gap-y-2 rounded-xl bg-muted/60 p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
                        {others.map((m) => (
                          <li key={m.id}>
                            <span className="font-semibold">{m.fullName}</span>
                            <span className="text-muted-foreground"> · {m.position}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </section>
            );
          })
        )}
      </div>
    </PublicShell>
  );
}

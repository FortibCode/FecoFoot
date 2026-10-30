import Link from "next/link";
import { MatchCard, type FixtureItem } from "@/components/matches/match-card";

/** Rencontres regroupées par compétition et journée (ou sélection), dans l'ordre reçu. */
export function FixtureGroups({ items, showDate = false }: { items: FixtureItem[]; showDate?: boolean }) {
  const groups = new Map<string, FixtureItem[]>();
  for (const i of items) groups.set(i.group.key, [...(groups.get(i.group.key) ?? []), i]);
  return (
    <div className="flex flex-col gap-3">
      {[...groups.values()].map((list) => {
        const g = list[0].group;
        return (
          <div key={g.key} data-group className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b bg-muted/50 px-3 py-2.5 text-sm sm:px-5">
              <span aria-hidden className="h-4 w-1 rounded-full bg-[linear-gradient(180deg,var(--flag-green)_0_33.33%,var(--flag-yellow)_33.33%_66.66%,var(--flag-red)_66.66%)]" />
              {g.href ? (
                <Link href={g.href} className="font-semibold uppercase tracking-wide hover:underline">
                  {g.title}
                </Link>
              ) : (
                <span className="font-semibold uppercase tracking-wide">{g.title}</span>
              )}
              {g.detail && <span className="text-muted-foreground">{g.detail}</span>}
            </p>
            <ul className="divide-y">
              {list.map((i) => (
                <MatchCard key={i.key} item={i} showDate={showDate} />
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

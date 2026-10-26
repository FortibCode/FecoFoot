import Link from "next/link";
import { formatFcfa } from "@/lib/format";
import { EVENT_KIND_LABELS, parseEventTitle, type EventKind } from "@/lib/ticketing";

const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

type WalletTicket = {
  id: number;
  number: string;
  token: string;
  holderName: string;
  category: string;
  gate: string;
  price: number;
  status: string;
  eventId: number;
  event: string;
  kind: EventKind;
  kickoffAt: Date;
  venue: string;
  orderRef: string;
};

const STATUS: Record<string, { label: string; cls: string }> = {
  VALID: { label: "Valide", cls: "bg-[#009543]/10 text-[#00753a]" },
  USED: { label: "Utilisé", cls: "bg-gray-100 text-gray-600" },
  RESERVED: { label: "Paiement en attente", cls: "bg-amber-100 text-amber-900" },
};

/**
 * Portefeuille de billets de l'espace supporter : une carte par rencontre (compétition, affiche, date,
 * stade), puis une ligne compacte par billet (titulaire, porte, tribune, numéro, état) ; le billet complet
 * avec son QR code s'ouvre en grand ou se télécharge en PDF. Rencontres à venir d'abord, puis passées.
 */
export function TicketWallet({ tickets, qrs, now }: { tickets: WalletTicket[]; qrs: Map<number, string>; now: Date }) {
  const events = new Map<number, WalletTicket[]>();
  for (const t of tickets) events.set(t.eventId, [...(events.get(t.eventId) ?? []), t]);
  // Une rencontre reste « à venir » jusqu'à 4 h après le coup d'envoi.
  const limit = now.getTime() - 4 * 3600_000;
  const groups = [...events.values()];
  const upcoming = groups.filter((g) => g[0].kickoffAt.getTime() >= limit).sort((a, b) => a[0].kickoffAt.getTime() - b[0].kickoffAt.getTime());
  const past = groups.filter((g) => g[0].kickoffAt.getTime() < limit).sort((a, b) => b[0].kickoffAt.getTime() - a[0].kickoffAt.getTime());

  const card = (list: WalletTicket[], faded: boolean) => {
    const e = list[0];
    const { competition, detail, match, teams } = parseEventTitle(e.event);
    const valid = list.filter((t) => t.status === "VALID").length;
    return (
      <section key={e.eventId} aria-label={e.event} className={`overflow-hidden rounded-2xl border bg-card shadow-sm ${faded ? "opacity-80" : ""}`}>
        <header className="relative flex flex-wrap items-end justify-between gap-4 bg-[#0b1f17] px-5 py-4 text-white">
          <div className="min-w-0">
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.18em] text-[#fbde4a]">
              {competition ?? EVENT_KIND_LABELS[e.kind]}
              {detail && ` · ${detail}`}
            </p>
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 font-heading text-2xl leading-none font-bold uppercase sm:text-3xl">
              {teams ? (
                <>
                  {teams[0]} <span className="text-sm font-semibold text-white/50">vs</span> {teams[1]}
                </>
              ) : (
                match
              )}
            </p>
            <p className="mt-2 text-sm text-white/80">
              <span className="inline-block font-semibold text-white first-letter:uppercase">{dayFmt.format(e.kickoffAt)}</span> · {timeFmt.format(e.kickoffAt)} · {e.venue}
            </p>
          </div>
          <div className="flex flex-row-reverse items-center gap-2 sm:flex-col sm:items-end">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              {list.length} billet{list.length > 1 ? "s" : ""}
            </span>
            {valid > 1 && (
              <a href={`/supporters/espace/billets?evenement=${e.eventId}`} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#0b1f17] hover:bg-white/90">
                Tous les billets (PDF)
              </a>
            )}
          </div>
          <div aria-hidden className="absolute inset-x-0 bottom-0 flex h-1">
            <span className="flex-1 bg-[#009543]" />
            <span className="flex-1 bg-[#fbde4a]" />
            <span className="flex-1 bg-[#dc241f]" />
          </div>
        </header>
        <ul className="divide-y">
          {list.map((t) => {
            const st = STATUS[t.status] ?? { label: t.status, cls: "bg-red-50 text-red-700" };
            return (
              <li key={t.id}>
                <article aria-label={`Billet ${t.number}`} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-4 gap-y-3 px-5 py-4 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
                  {/* Aperçu du QR code ; le billet à scanner s'ouvre en grand avec « Afficher le billet ». */}
                  <div aria-hidden className="size-16 rounded-lg bg-white p-1 ring-1 ring-gray-200 [&_svg]:h-full [&_svg]:w-full">
                    {t.status === "VALID" ? <span dangerouslySetInnerHTML={{ __html: qrs.get(t.id) ?? "" }} /> : <span className="grid h-full place-items-center text-[0.6rem] text-gray-400">QR</span>}
                  </div>
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2">
                      <span className="truncate font-semibold">{t.holderName}</span>
                      <span className={`rounded-full px-2 py-0.5 text-[0.65rem] font-bold uppercase tracking-wider ${st.cls}`}>{st.label}</span>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t.gate} · {t.category} · {t.price === 0 ? "Invitation" : formatFcfa(t.price)}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {t.number} · commande {t.orderRef}
                    </p>
                  </div>
                  <div className="col-span-2 flex gap-2 sm:col-span-1">
                    <Link href={`/billet/${t.token}`} className="rounded-md bg-brand-ink px-3 py-2 text-xs font-semibold text-white hover:opacity-90">
                      Afficher le billet
                    </Link>
                    {t.status === "VALID" && (
                      <a href={`/billet/${t.token}/pdf`} className="rounded-md border px-3 py-2 text-xs font-semibold hover:bg-muted">
                        PDF
                      </a>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </section>
    );
  };

  return (
    <div className="flex flex-col gap-8">
      {upcoming.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">À venir</h3>
          {upcoming.map((g) => card(g, false))}
        </div>
      )}
      {past.length > 0 && (
        <div className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Matchs passés</h3>
          {past.map((g) => card(g, true))}
        </div>
      )}
    </div>
  );
}

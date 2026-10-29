import { BrandLogo } from "@/components/brand-logo";
import { formatFcfa } from "@/lib/format";
import { EVENT_KIND_LABELS, parseEventTitle, type EventKind } from "@/lib/ticketing";

const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "short", day: "numeric", month: "short", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

const STAMP: Record<string, string> = { USED: "Utilisé", CANCELLED: "Annulé", REFUNDED: "Remboursé", RESERVED: "Paiement en attente" };

/**
 * E-billet nominatif (EF-SUP-02, EF-BIL-04) au format d'un billet de stade imprimé : 203 × 82 mm
 * (8 × 3¼ pouces, le format courant des billets de match), soit une partie principale (rencontre,
 * date, stade, porte, tribune, prix, titulaire) et un talon de 50 mm portant le QR code d'entrée.
 * Écran étroit : le talon passe sous le billet.
 */
export function ETicket({
  qr,
  t,
}: {
  qr: string;
  t: {
    number: string;
    holderName: string;
    category: string;
    gate: string;
    price: number;
    status: string;
    event: string;
    kind?: EventKind;
    kickoffAt: Date;
    venue: string;
    orderRef?: string;
  };
}) {
  const { competition, detail, teams, match } = parseEventTitle(t.event);
  const valid = t.status === "VALID";
  const stamp = STAMP[t.status];
  const [stadium, ...city] = t.venue.split(",");
  const info = (label: string, value: string, grow: string) => (
    <div className={`min-w-0 ${grow}`}>
      <dt className="text-[0.5rem] font-semibold uppercase tracking-[0.14em] text-gray-500">{label}</dt>
      <dd className="truncate font-heading text-sm leading-tight font-bold whitespace-nowrap text-gray-900">{value}</dd>
    </div>
  );

  return (
    <article aria-label={`Billet ${t.number} — ${t.event}`} className="ticket-print @container print-only w-full max-w-[44rem] text-black">
      <div className="relative flex flex-col overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-black/10 @lg:aspect-[203/82] @lg:flex-row">
        {/* Bande latérale : couleurs nationales et mention du billet */}
        <div aria-hidden className="hidden w-7 shrink-0 flex-col @lg:flex">
          <span className="flex-1 bg-[#009543]" />
          <span className="flex-1 bg-[#fbde4a]" />
          <span className="flex-1 bg-[#dc241f]" />
        </div>

        {/* Partie principale */}
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-2 px-4 py-3">
          <header className="flex items-center gap-2">
            <BrandLogo size={26} decorative />
            <p className="min-w-0 flex-1 truncate font-display text-xs font-bold tracking-wider">
              FECOFOOT <span className="font-sans text-[0.5rem] font-normal tracking-[0.14em] text-gray-500 uppercase">· Fédération Congolaise de Football</span>
            </p>
            <p className="shrink-0 rounded border border-gray-300 px-1.5 py-0.5 text-[0.5rem] font-semibold uppercase tracking-[0.16em] text-gray-600">Billet d&apos;entrée</p>
          </header>

          <div className="min-w-0">
            <p className="truncate text-[0.55rem] font-semibold uppercase tracking-[0.16em] text-[#009543]">
              {competition ?? (t.kind ? EVENT_KIND_LABELS[t.kind] : "Rencontre")}
              {detail && ` · ${detail}`}
            </p>
            {teams ? (
              <p className="flex flex-wrap items-baseline gap-x-2 font-display text-2xl leading-none font-bold uppercase @lg:text-[1.7rem]">
                <span>{teams[0]}</span>
                <span className="text-xs font-semibold text-gray-400">vs</span>
                <span>{teams[1]}</span>
              </p>
            ) : (
              <p className="truncate font-display text-xl leading-tight font-bold uppercase">{match}</p>
            )}
            <p className="mt-1 line-clamp-2 text-xs text-gray-600">
              <span className="font-semibold text-gray-900 first-letter:uppercase">{dayFmt.format(t.kickoffAt)}</span> ·{" "}
              <strong className="text-gray-900">{timeFmt.format(t.kickoffAt)}</strong> · {stadium}
              {city.length > 0 && `, ${city.join(",").trim()}`}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-dashed border-gray-300 pt-2 @lg:flex">
            {info("Porte", t.gate, "@lg:flex-[0.7]")}
            {info("Tribune", t.category, "@lg:flex-[1.4]")}
            {info("Prix", t.price === 0 ? "Invitation" : formatFcfa(t.price), "@lg:flex-[1] @lg:shrink-0")}
            {info("Titulaire", t.holderName, "@lg:flex-[1.4]")}
          </dl>

          <p className="line-clamp-2 text-[0.5rem] leading-snug text-gray-500">
            Billet nominatif · pièce d&apos;identité exigible · QR code valable pour une seule entrée · ni repris ni échangé
            {t.orderRef && ` · commande ${t.orderRef}`}
          </p>
        </div>

        {/* Perforation : pointillés et encoches, verticale (talon à droite) ou horizontale (talon dessous). */}
        <div aria-hidden className="relative border-t-2 border-dashed border-gray-300 @lg:border-t-0 @lg:border-l-2">
          <span className="absolute -top-2.5 -left-2.5 size-5 rounded-full bg-background" />
          <span className="absolute -top-2.5 -right-2.5 size-5 rounded-full bg-background @lg:top-auto @lg:right-auto @lg:-bottom-2.5 @lg:-left-2.5" />
        </div>

        {/* Talon (50 mm) : contrôle d'accès */}
        <aside className="flex shrink-0 flex-col items-center justify-center gap-1 bg-gray-50 px-3 py-3 text-center @lg:w-[24.6%]">
          {valid ? (
            <div className="size-24 rounded-md bg-white p-1 ring-1 ring-gray-200 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
          ) : (
            <div className="grid size-24 place-items-center rounded-md border-2 border-dashed border-gray-300 p-2 text-[0.6rem] text-gray-500">
              {t.status === "RESERVED" ? "QR code après paiement" : "QR code désactivé"}
            </div>
          )}
          <p className="font-mono text-[0.7rem] font-bold tracking-wider">{t.number}</p>
          <p className="text-[0.55rem] text-gray-500">
            {t.gate} · {t.category}
          </p>
          <p className={`rounded-full px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider ${valid ? "bg-[#009543]/10 text-[#00753a]" : "bg-red-50 text-red-700"}`}>
            {valid ? "Valide" : (stamp ?? t.status)}
          </p>
        </aside>

        {stamp && (
          <p aria-hidden className="pointer-events-none absolute top-1/2 left-1/3 -translate-x-1/2 -translate-y-1/2 -rotate-12 rounded-md border-[3px] border-red-600/70 px-3 py-0.5 font-display text-2xl font-bold uppercase tracking-widest text-red-600/70">
            {stamp}
          </p>
        )}
      </div>
    </article>
  );
}

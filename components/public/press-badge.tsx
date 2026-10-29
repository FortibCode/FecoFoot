import { BrandLogo } from "@/components/brand-logo";
import { PRESS_ROLE_LABELS, PRESS_ZONE_LABELS, PRESS_ZONES, type PressRole, type PressZone } from "@/lib/accreditations";
import { parseEventTitle } from "@/lib/ticketing";

const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" });
const timeFmt = new Intl.DateTimeFormat("fr-FR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });

/**
 * Badge presse (EF-MED-04) au format des badges de match portés au cou : bandeau FECOFOOT, mention
 * PRESSE, photo, identité, média et fonction, zones numérotées (accordées en couleur, refusées barrées),
 * rencontre et QR code. Valable uniquement pour le match indiqué (RG-16).
 */
export function PressBadge({
  qr,
  photo,
  a,
}: {
  qr: string;
  photo: string | null;
  a: { number: string; lastName: string; firstName: string; outlet: string; role: PressRole; grantedZones: PressZone[]; event: string; kickoffAt: Date; venue: string };
}) {
  const { competition, detail, match, teams } = parseEventTitle(a.event);
  return (
    <article aria-label="Badge presse" className="print-only w-full max-w-[22rem] overflow-hidden rounded-2xl bg-white text-black shadow-xl ring-1 ring-black/10">
      {/* Fente du cordon */}
      <div className="flex justify-center bg-[#0b1f17] pt-3">
        <span aria-hidden className="h-2.5 w-16 rounded-full bg-white/90" />
      </div>
      <header className="flex items-center gap-3 bg-[#0b1f17] px-4 pt-3 pb-3 text-white">
        <BrandLogo size={36} decorative />
        <div className="min-w-0 leading-tight">
          <p className="font-display text-sm font-bold tracking-wider">FECOFOOT</p>
          <p className="text-[0.55rem] uppercase tracking-[0.16em] text-white/70">Fédération Congolaise de Football</p>
        </div>
      </header>
      <p className="bg-[#fbde4a] py-1.5 text-center font-display text-3xl leading-none font-bold tracking-[0.3em] text-[#0b1f17]">PRESSE</p>
      <div aria-hidden className="flex h-1.5">
        <span className="flex-1 bg-[#009543]" />
        <span className="flex-1 bg-[#fbde4a]" />
        <span className="flex-1 bg-[#dc241f]" />
      </div>

      <div className="flex flex-col items-center gap-3 px-5 pt-5 text-center">
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element -- photo servie par la route des badges (contrôle d'accès)
          <img src={photo} alt={`Photo de ${a.firstName} ${a.lastName}`} className="aspect-[3/4] w-32 rounded-lg object-cover ring-4 ring-[#0b1f17]" />
        ) : (
          <span aria-hidden className="brand-band grid aspect-[3/4] w-32 place-items-center rounded-lg font-heading text-4xl font-bold">
            {`${a.firstName[0] ?? ""}${a.lastName[0] ?? ""}`.toUpperCase()}
          </span>
        )}
        <div>
          <p className="font-display text-2xl leading-tight font-bold uppercase">{a.lastName}</p>
          <p className="text-lg leading-tight">{a.firstName}</p>
        </div>
        <p className="rounded-full bg-[#0b1f17] px-3 py-1 text-xs font-semibold uppercase tracking-wider text-white">{PRESS_ROLE_LABELS[a.role]}</p>
        <p className="text-sm font-semibold">{a.outlet}</p>
      </div>

      {/* Zones numérotées : accès accordé en vert, refusé barré. */}
      <ul aria-label="Zones d'accès" className="mx-5 mt-4 grid grid-cols-4 gap-1.5">
        {PRESS_ZONES.map((z, i) => {
          const ok = a.grantedZones.includes(z);
          return (
            <li key={z} title={PRESS_ZONE_LABELS[z]} className={`flex flex-col items-center rounded-md px-1 py-1.5 text-center ${ok ? "bg-[#009543] text-white" : "bg-gray-100 text-gray-400 line-through"}`}>
              <span className="font-heading text-xl leading-none font-bold">{i + 1}</span>
              <span aria-hidden className="mt-0.5 text-[0.55rem] leading-tight">
                {PRESS_ZONE_LABELS[z].replace(" (photo)", "")}
              </span>
              <span className="sr-only">
                {PRESS_ZONE_LABELS[z]} : {ok ? "accès accordé" : "accès non accordé"}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mx-5 mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-dashed border-gray-300 pt-4 pb-5">
        <div className="min-w-0 text-left">
          <p className="text-[0.6rem] font-semibold uppercase tracking-[0.14em] text-[#009543]">
            {competition ?? "Rencontre"}
            {detail && ` · ${detail}`}
          </p>
          <p className="font-display text-lg leading-tight font-bold uppercase">{teams ? `${teams[0]} – ${teams[1]}` : match}</p>
          <p className="text-xs text-gray-600 first-letter:uppercase">
            {dayFmt.format(a.kickoffAt)} · {timeFmt.format(a.kickoffAt)}
          </p>
          <p className="text-xs text-gray-600">{a.venue}</p>
          <p className="mt-2 font-mono text-xs font-bold">{a.number}</p>
        </div>
        <div className="size-24 rounded-md bg-white p-1 ring-1 ring-gray-200 [&_svg]:h-full [&_svg]:w-full" dangerouslySetInnerHTML={{ __html: qr }} />
      </div>
      <p className="bg-[#0b1f17] px-4 py-2 text-center text-[0.6rem] uppercase tracking-[0.14em] text-white/80">
        Personnel et incessible · valable uniquement pour ce match
      </p>
    </article>
  );
}

import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ClubLogo } from "@/components/public/club-logo";
import { ArrowIcon, SwapIcon } from "@/components/public/icons";
import { PublicShell } from "@/components/public/public-shell";
import { PlayerPhoto } from "@/components/player-photo";
import { clubLogos } from "@/lib/club-logos";
import { db } from "@/lib/db";
import { clubs, players, transfers } from "@/lib/db/schema";
import { formatDate } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { playerPhotoUrls } from "@/lib/queries/player-photos";
import { TRANSFER_TYPE_LABELS, TRANSFER_TYPES, type TransferType } from "@/lib/transfers";

export const metadata: Metadata = {
  title: "Transferts — FECOFOOT",
  description: "Transferts et prêts de joueurs homologués par la Fédération Congolaise de Football.",
};

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v)?.trim() || undefined;
const fromClub = alias(clubs, "from_club");
const toClub = alias(clubs, "to_club");

/** Couleur de chaque type de transfert (le libellé est toujours écrit). */
const TYPE_DOT: Record<TransferType, string> = { DEFINITIVE: "bg-[var(--flag-green)]", LOAN: "bg-[var(--flag-yellow)]", FREE: "bg-brand-ink" };
const TYPE_PILL: Record<TransferType, string> = {
  DEFINITIVE: "bg-[var(--flag-green)] text-white",
  LOAN: "bg-[var(--flag-yellow)] text-brand-ink",
  FREE: "bg-brand-ink text-white",
};

/** Transferts homologués (statut « approuvé ») : joueur, club quitté, club d'accueil, type. Les indemnités restent confidentielles. */
export default async function PublicTransfersPage({ searchParams }: PageProps<"/transferts">) {
  await connection();
  const sp = await searchParams;
  const season = Number(one(sp.saison)) || undefined;
  const type = TRANSFER_TYPES.find((t) => t === one(sp.type)) as TransferType | undefined;

  const filters: SQL[] = [eq(transfers.status, "APPROVED")];
  if (season) filters.push(eq(transfers.season, season));
  if (type) filters.push(eq(transfers.type, type));

  const [rows, seasons] = await Promise.all([
    db
      .select({
        t: transfers,
        playerId: players.id,
        firstName: players.firstName,
        lastName: players.lastName,
        from: { id: fromClub.id, name: fromClub.name, slug: fromClub.slug },
        to: { id: toClub.id, name: toClub.name, slug: toClub.slug },
      })
      .from(transfers)
      .innerJoin(players, eq(transfers.playerId, players.id))
      .leftJoin(fromClub, eq(transfers.fromClubId, fromClub.id))
      .innerJoin(toClub, eq(transfers.toClubId, toClub.id))
      .where(and(...filters))
      .orderBy(desc(transfers.decidedAt), desc(transfers.id))
      .limit(200),
    db.selectDistinct({ season: transfers.season }).from(transfers).where(eq(transfers.status, "APPROVED")).orderBy(desc(transfers.season)),
  ]);
  const [logos, photos] = await Promise.all([
    clubLogos(rows.flatMap((r) => [r.to.id, ...(r.from?.id ? [r.from.id] : [])])),
    // Photo publiée seulement avec l'accord du joueur (licence délivrée).
    playerPhotoUrls(rows.map((r) => r.playerId), { publicOnly: true }),
  ]);
  const select = "h-10 w-full min-w-0 rounded-md border bg-background px-2 text-sm";
  // Nombre de transferts par type (saison choisie) : les puces de filtre.
  const counts = await db
    .select({ type: transfers.type, season: transfers.season })
    .from(transfers)
    .where(and(eq(transfers.status, "APPROVED"), season ? eq(transfers.season, season) : undefined));
  const countOf = (t?: TransferType) => counts.filter((c) => !t || c.type === t).length;
  const href = (t?: TransferType) => {
    const q = new URLSearchParams();
    if (season) q.set("saison", String(season));
    if (t) q.set("type", t);
    const str = q.toString();
    return `/transferts${str ? `?${str}` : ""}`;
  };
  const chip = (active: boolean) =>
    `inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold whitespace-nowrap transition-colors ${active ? "border-brand-ink bg-brand-ink text-white" : "bg-card hover:border-[var(--flag-green)] hover:text-[var(--flag-green)]"}`;
  const team = (c: { id: number; name: string; slug: string } | null, align: "start" | "end") =>
    c ? (
      <Link href={`/clubs/${c.slug}`} className={`flex min-w-0 items-center gap-2.5 font-semibold transition-colors hover:text-[var(--flag-green)] ${align === "end" ? "flex-row-reverse text-right sm:flex-row sm:text-left" : ""}`}>
        <span className="relative size-10 shrink-0 bg-white">
          <ClubLogo src={logos.get(c.id)} name={c.name} className="absolute inset-0 m-auto size-[80%] text-[0.6rem]" />
        </span>
        <span className="line-clamp-2 leading-tight">{c.name}</span>
      </Link>
    ) : (
      <span className="flex items-center gap-2.5 text-muted-foreground">
        <span aria-hidden className="grid size-10 shrink-0 place-items-center bg-white/60 text-xs">—</span>
        Sans club
      </span>
    );

  return (
    <PublicShell eyebrow="Mouvements de joueurs" title="Transferts" subtitle="Transferts et prêts homologués par la fédération. Les indemnités restent confidentielles." wide>
      <div className="flex flex-col gap-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <nav aria-label="Type de transfert" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0">
            <ul className="flex gap-2 sm:flex-wrap">
              {[undefined, ...TRANSFER_TYPES].map((t) => (
                <li key={t ?? "all"}>
                  <Link href={href(t)} aria-current={type === t ? "page" : undefined} className={chip(type === t)}>
                    {t && <span aria-hidden className={`size-2.5 rounded-full ${TYPE_DOT[t]}`} />}
                    {t ? TRANSFER_TYPE_LABELS[t] : "Tous"}
                    <span className={`rounded-full px-1.5 text-xs tabular-nums ${type === t ? "bg-white/20" : "bg-muted"}`}>{countOf(t)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
          <form className="flex items-end gap-2" aria-label="Saison">
            {type && <input type="hidden" name="type" value={type} />}
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              Saison
              <select name="saison" defaultValue={season ?? ""} className={`${select} w-44`}>
                <option value="">Toutes</option>
                {seasons.map((s) => (
                  <option key={s.season} value={s.season}>
                    {seasonLabel(s.season)}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="h-10 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white transition-colors hover:bg-[var(--flag-green)]">
              Filtrer
            </button>
          </form>
        </div>

        {rows.length === 0 ? (
          <div data-reveal="up" className="flex flex-col items-center gap-3 bg-muted/60 px-6 py-12 text-center">
            <SwapIcon className="size-9 text-[var(--flag-green)]" />
            <p className="font-semibold">Aucun transfert homologué pour ces critères.</p>
            <Link href="/transferts" className="text-sm font-semibold text-[var(--flag-green)] underline-offset-4 hover:underline">
              Voir tous les transferts
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map(({ t, playerId, firstName, lastName, from, to }, i) => (
              <li
                key={t.id}
                data-reveal="up"
                style={{ ["--rd" as string]: `${Math.min(i, 8) * 70}ms` }}
                className="group grid gap-4 bg-muted/60 p-4 transition-colors hover:bg-muted sm:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] sm:items-center sm:p-5"
              >
                {/* Joueur */}
                <div className="flex min-w-0 items-center gap-4">
                  <PlayerPhoto src={photos.get(playerId)} firstName={firstName} lastName={lastName} className="size-14 shrink-0 text-base" />
                  <div className="min-w-0">
                    <p className="font-display text-xl leading-tight font-bold uppercase">
                      {firstName} {lastName}
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                      <span className={`px-2 py-0.5 font-bold ${TYPE_PILL[t.type]}`}>
                        {TRANSFER_TYPE_LABELS[t.type]}
                        {t.type === "LOAN" && t.loanEndDate && ` jusqu'au ${formatDate(t.loanEndDate)}`}
                      </span>
                      <span>{seasonLabel(t.season)}</span>
                      {t.decidedAt && <span>· homologué le {formatDate(t.decidedAt)}</span>}
                    </p>
                  </div>
                </div>
                {/* Mouvement : club quitté → club d'accueil */}
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 bg-card p-3">
                  {team(from?.id ? from : null, "start")}
                  <span aria-label="vers" className="grid size-9 place-items-center rounded-full bg-[var(--flag-green)] text-white transition-transform duration-300 motion-safe:group-hover:translate-x-1">
                    <ArrowIcon className="size-4" />
                  </span>
                  {team(to, "end")}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </PublicShell>
  );
}

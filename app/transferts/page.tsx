import type { Metadata } from "next";
import { connection } from "next/server";
import Link from "next/link";
import { and, desc, eq, type SQL } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { ClubLogo } from "@/components/public/club-logo";
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
  const team = (c: { id: number; name: string; slug: string } | null) =>
    c ? (
      <Link href={`/clubs/${c.slug}`} className="flex min-w-0 items-center gap-2 font-semibold hover:underline">
        <ClubLogo src={logos.get(c.id)} name={c.name} className="size-7 text-[0.6rem]" />
        <span className="truncate">{c.name}</span>
      </Link>
    ) : (
      <span className="text-muted-foreground">Sans club</span>
    );

  return (
    <PublicShell eyebrow="Mouvements de joueurs" title="Transferts" subtitle="Transferts et prêts homologués par la fédération" wide>
      <form className="mb-8 grid gap-3 rounded-xl bg-muted/60 p-4 sm:grid-cols-[repeat(2,minmax(0,1fr))_auto] sm:items-end" aria-label="Filtres">
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Saison
          <select name="saison" defaultValue={season ?? ""} className={select}>
            <option value="">Toutes</option>
            {seasons.map((s) => (
              <option key={s.season} value={s.season}>
                {seasonLabel(s.season)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Type
          <select name="type" defaultValue={type ?? ""} className={select}>
            <option value="">Tous</option>
            {TRANSFER_TYPES.map((t) => (
              <option key={t} value={t}>
                {TRANSFER_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className="h-10 rounded-md bg-brand-ink px-5 text-sm font-semibold text-white">
          Filtrer
        </button>
      </form>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-muted-foreground">Aucun transfert homologué pour ces critères.</p>
      ) : (
        <ul className="flex flex-col divide-y rounded-xl bg-muted/60">
          {rows.map(({ t, playerId, firstName, lastName, from, to }) => (
            <li key={t.id} className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 p-4 text-sm sm:grid-cols-[auto_minmax(0,1.2fr)_minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
              <PlayerPhoto src={photos.get(playerId)} firstName={firstName} lastName={lastName} className="row-span-2 size-14 text-base sm:row-span-1" />
              <div className="min-w-0">
                <p className="font-heading text-base font-bold uppercase">
                  {firstName} {lastName}
                </p>
                <p className="text-xs text-muted-foreground">
                  {TRANSFER_TYPE_LABELS[t.type]}
                  {t.type === "LOAN" && t.loanEndDate && ` jusqu'au ${formatDate(t.loanEndDate)}`} · {seasonLabel(t.season)}
                  {t.decidedAt && ` · homologué le ${formatDate(t.decidedAt)}`}
                </p>
              </div>
              <div className="col-start-2 flex min-w-0 items-center gap-2 sm:contents">
                {team(from?.id ? from : null)}
                <span aria-label="vers" className="text-muted-foreground">
                  →
                </span>
                {team(to)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PublicShell>
  );
}

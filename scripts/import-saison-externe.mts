import "dotenv/config";
import { randomUUID } from "node:crypto";
import { and, count, eq, inArray } from "drizzle-orm";
import { formatAffiliationNumber } from "../lib/clubs";
import { divisionName } from "../lib/competitions";
import { db } from "../lib/db";
import { auditLogs, championships, clubAffiliationSeq, clubs, competitions, competitionTeams, documents, externalLinks, matches } from "../lib/db/schema";
import { checkUpload, MIME } from "../lib/documents";
import { normalizeClubName } from "../lib/external-sync-rules";
import { slugify } from "../lib/format";
import { fixturesOf, teamsOf } from "../lib/integrations/api-football";
import { seasonOf } from "../lib/licenses";
import { syncCompetition } from "../lib/live-sync";
import { nextVal } from "../lib/sequences";
import { putFile } from "../lib/storage";

/**
 * Import d'une saison réelle depuis API-Football :
 *   npm run sources:import-saison -- <ligue fournisseur> <saison> <code championnat>
 *   ex. npm run sources:import-saison -- 844 2024 ligue-1   (Ligue 1 du Congo, saison 2024-2025)
 *
 *  1. chaque équipe du fournisseur est associée à un club existant (nom ou sigle, ALIASES sinon) ;
 *     un club absent est créé (rattaché à la fédération) avec le logo du fournisseur ;
 *  2. la saison du championnat est créée si besoin (« Ligue 1 National », saison donnée) et liée à la ligue du fournisseur ;
 *  3. les matchs sont importés par la synchronisation habituelle (lib/live-sync.ts : provenance « externe », à valider) ;
 *  4. championnat joué en zones : les poules sont déduites des rencontres (équipes qui se sont affrontées).
 * Relançable : rien n'est créé deux fois. Chaque création est inscrite au journal d'audit.
 * Coût : 3 requêtes (équipes, rencontres pour les zones, synchronisation).
 */
const [leagueArg, seasonArg, championshipCode] = process.argv.slice(2);
const externalLeague = Number(leagueArg);
const season = Number(seasonArg);
if (!externalLeague || !season || !championshipCode) throw new Error("Usage : npm run sources:import-saison -- <ligue> <saison> <code championnat>");

// Noms du fournisseur → nom du club sur la plateforme, quand la comparaison des noms ne suffit pas.
const ALIASES: Record<string, string> = {
  "Léopards de Dolisié": "AC Léopards de Dolisie",
  "Otôho d'Oyo": "AS Otohô",
  "JS Talangaï": "Jeunesse Sportive de Talangaï",
};
// Ville d'un club créé, quand le fournisseur ne la donne pas : déduite du nom, sinon à préciser dans la fiche du club.
const CITY_HINTS: [RegExp, string][] = [
  [/pointe[- ]noire|ponten/i, "Pointe-Noire"],
  [/dolisi/i, "Dolisie"],
  [/madingou/i, "Madingou"],
  [/poto-poto|brazzaville|talanga/i, "Brazzaville"],
];

// Journal d'audit hors requête HTTP (lib/audit.ts lit l'adresse IP de la requête).
const logAudit = (e: { userId: null; action: string; entity: string; entityId: number; details: object }) =>
  db.insert(auditLogs).values({ ...e, entityId: String(e.entityId), details: { ...e.details, script: "import-saison-externe" } });

const [ch] = await db.select().from(championships).where(eq(championships.code, championshipCode)).limit(1);
if (!ch) throw new Error(`Championnat « ${championshipCode} » introuvable.`);

// 1. Équipes → clubs
const { data: teams } = await teamsOf(externalLeague, season);
const existing = await db.select().from(clubs);
const byKey = new Map<string, (typeof existing)[number]>();
for (const c of existing) for (const n of [c.name, c.shortName]) if (n) byKey.set(normalizeClubName(n), c);
const links = await db.select().from(externalLinks).where(and(eq(externalLinks.provider, "API_FOOTBALL"), eq(externalLinks.entity, "club")));

for (const { team, venue } of teams as { team: { id: number; name: string; founded?: number | null; logo?: string }; venue?: { city?: string | null } }[]) {
  const linked = links.find((l) => l.externalId === String(team.id));
  let club = linked ? existing.find((c) => c.id === linked.entityId) : undefined;
  club ??= ALIASES[team.name] ? existing.find((c) => c.name === ALIASES[team.name]) : byKey.get(normalizeClubName(team.name));
  let note = "associé";
  if (!club) {
    const city = venue?.city ?? CITY_HINTS.find(([re]) => re.test(team.name))?.[1] ?? "À préciser";
    const taken = await db.$count(clubs, eq(clubs.slug, slugify(team.name)));
    [club] = await db
      .insert(clubs)
      .values({
        name: team.name,
        city,
        leagueId: null,
        foundedYear: team.founded ?? null,
        status: "AFFILIATED",
        slug: taken ? `${slugify(team.name)}-${team.id}` : slugify(team.name),
        affiliationNumber: formatAffiliationNumber(await nextVal(clubAffiliationSeq)),
      })
      .returning();
    existing.push(club);
    await logAudit({ userId: null, action: "CREATE", entity: "club", entityId: club.id, details: { source: "API_FOOTBALL", externalTeamId: team.id } });
    note = `créé (${city})`;
  }
  if (!linked) {
    await db.insert(externalLinks).values({ provider: "API_FOOTBALL", entity: "club", entityId: club.id, externalId: String(team.id) }).onConflictDoNothing();
  }
  // Logo du fournisseur pour un club qui n'en a pas encore.
  const hasLogo = await db.$count(documents, and(eq(documents.ownerType, "club"), eq(documents.ownerId, club.id), eq(documents.type, "CLUB_LOGO")));
  if (!hasLogo && team.logo) {
    const res = await fetch(team.logo, { signal: AbortSignal.timeout(15_000) }).catch(() => null);
    const bytes = res?.ok ? new Uint8Array(await res.arrayBuffer()) : null;
    const checked = bytes ? checkUpload("CLUB_LOGO", bytes) : { error: "téléchargement impossible" };
    if (bytes && !("error" in checked)) {
      const storageKey = `club/${club.id}/${randomUUID()}.${checked.kind}`;
      await putFile(storageKey, bytes);
      await db.insert(documents).values({ ownerType: "club", ownerId: club.id, type: "CLUB_LOGO", storageKey, originalName: `api-football-${team.id}.png`, contentType: MIME[checked.kind], size: bytes.length });
      note += " + logo";
    } else note += ` (logo : ${"error" in checked ? checked.error : "?"})`;
  }
  console.log(`✓ ${team.name} → ${club.name} : ${note}`);
}

// 2. Saison du championnat, liée à la ligue du fournisseur
let [comp] = await db.select().from(competitions).where(and(eq(competitions.championshipId, ch.id), eq(competitions.season, season))).limit(1);
if (!comp) {
  [comp] = await db
    .insert(competitions)
    .values({ name: divisionName(ch.name), slug: `${ch.code}-national-${season}-${season + 1}`, season, category: "SENIOR", gender: "M", type: "LEAGUE", status: "DRAFT", championshipId: ch.id })
    .returning();
  await logAudit({ userId: null, action: "CREATE", entity: "competition", entityId: comp.id, details: { source: "API_FOOTBALL", externalLeague, season } });
  console.log(`✓ Compétition créée : ${comp.name} ${season}-${season + 1}`);
}
await db
  .insert(externalLinks)
  .values({ provider: "API_FOOTBALL", entity: "competition", entityId: comp.id, externalId: String(externalLeague), externalSeason: season })
  .onConflictDoNothing();

// 3. Matchs
const r = await syncCompetition(comp.id, "manual");
console.log(`Synchronisation : ${r.created} créé(s), ${r.updated} mis à jour, ${r.conflicts} conflit(s), ${r.skipped} ignoré(s).`, r.error ?? "", r.notes.join(" "));
if (r.error) process.exit(1);

// 4. Zones : groupes d'équipes qui se sont affrontées ; un petit groupe isolé rejoint la zone de sa ville.
const { data: fixtures } = await fixturesOf(externalLeague, season);
const clubOfTeam = new Map((await db.select().from(externalLinks).where(and(eq(externalLinks.provider, "API_FOOTBALL"), eq(externalLinks.entity, "club")))).map((l) => [Number(l.externalId), l.entityId]));
const adj = new Map<number, Set<number>>();
for (const f of fixtures) {
  const [h, a] = [clubOfTeam.get(f.teams.home.id), clubOfTeam.get(f.teams.away.id)];
  if (!h || !a) continue;
  adj.set(h, (adj.get(h) ?? new Set()).add(a));
  adj.set(a, (adj.get(a) ?? new Set()).add(h));
}
const groups: number[][] = [];
const seen = new Set<number>();
for (const start of adj.keys()) {
  if (seen.has(start)) continue;
  const group: number[] = [];
  const stack = [start];
  while (stack.length) {
    const x = stack.pop()!;
    if (seen.has(x)) continue;
    seen.add(x);
    group.push(x);
    stack.push(...(adj.get(x) ?? []));
  }
  groups.push(group);
}
groups.sort((a, b) => b.length - a.length);
const main = groups.filter((g) => g.length > 3);
if (main.length > 1) {
  const cityOf = new Map(existing.map((c) => [c.id, c.city]));
  const pools = main.map((g, i) => ({ name: String.fromCharCode(65 + i), clubs: [...g] }));
  for (const g of groups.filter((g) => g.length <= 3)) {
    const cities = g.map((c) => cityOf.get(c));
    const best = pools.map((p) => ({ p, n: p.clubs.filter((c) => cities.includes(cityOf.get(c))).length })).sort((x, y) => y.n - x.n)[0].p;
    best.clubs.push(...g);
  }
  for (const p of pools) {
    await db.update(competitionTeams).set({ pool: p.name }).where(and(eq(competitionTeams.competitionId, comp.id), inArray(competitionTeams.clubId, p.clubs)));
    await db.update(matches).set({ pool: p.name }).where(and(eq(matches.competitionId, comp.id), inArray(matches.homeClubId, p.clubs)));
    console.log(`Poule ${p.name} : ${p.clubs.map((c) => existing.find((x) => x.id === c)?.name).join(", ")}`);
  }
}

// Saison passée : terminée (la synchronisation planifiée ne la relit plus).
if (season < seasonOf()) await db.update(competitions).set({ status: "FINISHED" }).where(eq(competitions.id, comp.id));
const [{ n }] = await db.select({ n: count() }).from(matches).where(eq(matches.competitionId, comp.id));
console.log(`Terminé : ${comp.name} ${season}-${season + 1}, ${n} match(s).`);
process.exit(0);

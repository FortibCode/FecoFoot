import "server-only";
import { and, asc, desc, eq, or, sql, type AnyColumn, type SQL } from "drizzle-orm";
import type { CurrentUser } from "@/lib/auth/guard";
import { can } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { articles, clubs, licenses, players, supporters, users } from "@/lib/db/schema";

const LIMIT = 8;

// Recherche insensible à la casse et aux accents (« leo » trouve « Léopards ») sans extension PostgreSQL.
const FROM = "àáâãäåçèéêëìíîïñòóôõöùúûüýÿœæ";
const TO = "aaaaaaceeeeiiiinooooouuuuyyoa";
const fold = (v: AnyColumn | SQL) => sql`translate(lower(${v}), ${FROM}, ${TO})`;
const foldText = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[%_\\]/g, (c) => `\\${c}`);
const matches = (col: AnyColumn, needle: string) => sql`${fold(col)} like ${`%${needle}%`}`;

/** Périmètre d'un compte de club ou de ligue (les autres profils voient tout). */
function clubScope(user: CurrentUser): SQL | undefined {
  if (user.role === "CLUB") return eq(clubs.id, user.clubId ?? -1);
  if (user.role === "LEAGUE") return eq(clubs.leagueId, user.leagueId ?? -1);
  return undefined;
}

/**
 * Recherche globale de l'espace fédéral : clubs, joueurs, licences, supporters, comptes, actualités,
 * selon les droits du compte et dans son périmètre (club, ligue).
 */
export async function globalSearch(user: CurrentUser, raw: string) {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return null;
  const n = foldText(q);
  const [clubRows, playerRows, licenseRows, fanRows, userRows, articleRows] = await Promise.all([
    can(user.role, "clubs.read")
      ? db
          .select({ id: clubs.id, name: clubs.name, city: clubs.city, number: clubs.affiliationNumber })
          .from(clubs)
          .where(and(clubScope(user), or(matches(clubs.name, n), matches(clubs.shortName, n), matches(clubs.affiliationNumber, n), matches(clubs.city, n))))
          .orderBy(asc(clubs.name))
          .limit(LIMIT)
      : [],
    can(user.role, "players.read")
      ? db
          .select({ id: players.id, lastName: players.lastName, firstName: players.firstName, federalId: players.federalId, club: clubs.name })
          .from(players)
          .leftJoin(clubs, eq(players.clubId, clubs.id))
          .where(and(clubScope(user), or(matches(players.lastName, n), matches(players.firstName, n), matches(players.federalId, n))))
          .orderBy(asc(players.lastName))
          .limit(LIMIT)
      : [],
    can(user.role, "licenses.validate") || can(user.role, "licenses.request")
      ? db
          .select({ id: licenses.id, number: licenses.number, lastName: players.lastName, firstName: players.firstName, status: licenses.status })
          .from(licenses)
          .innerJoin(players, eq(licenses.playerId, players.id))
          .innerJoin(clubs, eq(licenses.clubId, clubs.id))
          .where(and(clubScope(user), matches(licenses.number, n)))
          .orderBy(desc(licenses.createdAt))
          .limit(LIMIT)
      : [],
    can(user.role, "ticketing.manage")
      ? db
          .select({ id: supporters.id, fanId: supporters.fanId, lastName: supporters.lastName, firstName: supporters.firstName })
          .from(supporters)
          .where(or(matches(supporters.lastName, n), matches(supporters.firstName, n), matches(supporters.fanId, n)))
          .orderBy(asc(supporters.lastName))
          .limit(LIMIT)
      : [],
    can(user.role, "users.manage")
      ? db
          .select({ id: users.id, fullName: users.fullName, email: users.email })
          .from(users)
          .where(or(matches(users.fullName, n), matches(users.email, n)))
          .orderBy(asc(users.fullName))
          .limit(LIMIT)
      : [],
    can(user.role, "communication.manage")
      ? db.select({ id: articles.id, title: articles.title, status: articles.status }).from(articles).where(matches(articles.title, n)).orderBy(desc(articles.updatedAt)).limit(LIMIT)
      : [],
  ]);
  return { q, clubRows, playerRows, licenseRows, fanRows, userRows, articleRows };
}

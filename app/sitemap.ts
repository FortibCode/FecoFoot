import type { MetadataRoute } from "next";
import { and, eq, gt, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { articles, clubs, competitions, leagues, nationalTeams, ticketEvents } from "@/lib/db/schema";

/** Plan du site (EF-PUB-08), généré à chaque demande à partir des contenus publiés. */
export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  const [news, comps, clubRows, teams, events, leagueRows] = await Promise.all([
    db.select({ slug: articles.slug, updatedAt: articles.updatedAt }).from(articles).where(eq(articles.status, "PUBLISHED")),
    db.select({ slug: competitions.slug }).from(competitions).where(ne(competitions.status, "DRAFT")),
    db.select({ slug: clubs.slug, updatedAt: clubs.updatedAt }).from(clubs).where(eq(clubs.status, "AFFILIATED")),
    db.select({ slug: nationalTeams.slug }).from(nationalTeams),
    db.select({ slug: ticketEvents.slug }).from(ticketEvents).where(and(inArray(ticketEvents.salesStatus, ["PRESALE", "OPEN"]), gt(ticketEvents.kickoffAt, new Date()))),
    db.select({ code: leagues.code, updatedAt: leagues.updatedAt }).from(leagues).where(eq(leagues.active, true)),
  ]);
  const page = (path: string, lastModified?: Date) => ({ url: `${base}${path}`, ...(lastModified && { lastModified }) });
  return [
    ...["/", "/actualites", "/competitions", "/championnats/ligue-1", "/championnats/ligue-2", "/ligues", "/clubs", "/equipes-nationales", "/billetterie", "/supporters", "/accreditations", "/verifier"].map((p) => page(p)),
    ...news.map((a) => page(`/actualites/${a.slug}`, a.updatedAt)),
    ...comps.map((c) => page(`/competitions/${c.slug}`)),
    ...clubRows.map((c) => page(`/clubs/${c.slug}`, c.updatedAt)),
    ...leagueRows.map((l) => page(`/ligues/${l.code.toLowerCase()}`, l.updatedAt)),
    ...teams.map((t) => page(`/equipes-nationales/${t.slug}`)),
    ...events.map((e) => page(`/billetterie/${e.slug}`)),
  ];
}

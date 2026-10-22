import "server-only";

/**
 * Client API-Football (api-sports.io, version 3) : ligues, équipes et rencontres.
 * Clé : API_FOOTBALL_KEY (environnement uniquement, jamais dans le code). Sans clé, aucune requête n'est faite.
 * Quotas : selon l'abonnement (offre gratuite ≈ 100 requêtes/jour) ; une synchronisation de compétition = 1 requête.
 */
const BASE = process.env.API_FOOTBALL_BASE_URL ?? "https://v3.football.api-sports.io";

export const apiFootballConfigured = () => Boolean(process.env.API_FOOTBALL_KEY?.trim());

export class ExternalApiError extends Error {}

type Envelope<T> = { errors: unknown; results: number; response: T[] };

async function call<T>(path: string, params: Record<string, string | number>): Promise<{ data: T[]; remaining: number | null }> {
  const key = process.env.API_FOOTBALL_KEY?.trim();
  if (!key) throw new ExternalApiError("Source externe non configurée : renseignez API_FOOTBALL_KEY.");
  const url = new URL(path, BASE);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  let res: Response;
  try {
    res = await fetch(url, { headers: { "x-apisports-key": key }, cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch (e) {
    throw new ExternalApiError(`API-Football injoignable : ${(e as Error).message}`);
  }
  if (!res.ok) throw new ExternalApiError(`API-Football : réponse ${res.status}.`);
  const body = (await res.json()) as Envelope<T>;
  // Les erreurs (clé invalide, quota atteint, paramètre refusé) arrivent dans « errors », réponse 200.
  const errors: unknown[] = Array.isArray(body.errors) ? body.errors : body.errors && typeof body.errors === "object" ? Object.values(body.errors) : [];
  if (errors.length) throw new ExternalApiError(`API-Football : ${errors.map(String).join(" ; ")}`);
  const header = res.headers.get("x-ratelimit-requests-remaining");
  return { data: body.response ?? [], remaining: header !== null && Number.isFinite(Number(header)) ? Number(header) : null };
}

export type ApiLeague = {
  league: { id: number; name: string; type: string };
  country: { name: string };
  seasons: { year: number; current: boolean; coverage?: { fixtures?: { events?: boolean; lineups?: boolean }; standings?: boolean } }[];
};
export type ApiTeam = { team: { id: number; name: string; logo?: string } };
export type ApiFixture = {
  fixture: { id: number; date: string; venue?: { name: string | null; city: string | null }; status: { short: string; elapsed: number | null } };
  league: { id: number; season: number; round: string | null };
  teams: { home: { id: number; name: string }; away: { id: number; name: string } };
  goals: { home: number | null; away: number | null };
};

/** Ligues d'un pays (ex. « Congo » : République du Congo ; la RD Congo est « Congo-DR »). */
export const leaguesOfCountry = (country: string) => call<ApiLeague>("/leagues", { country });
export const teamsOf = (league: number, season: number) => call<ApiTeam>("/teams", { league, season });
export const fixturesOf = (league: number, season: number) => call<ApiFixture>("/fixtures", { league, season });

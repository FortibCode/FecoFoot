import "dotenv/config";
import postgres from "postgres";

/**
 * Diables Rouges U-15 à la Coupe du Monde FIFA U-15 Azerbaïdjan 2026 : données réelles et sourcées.
 *   npm run selection:u15
 *
 * Sources (vérifiées le 22 octobre 2026) :
 *  - calendrier officiel FIFA du 15 octobre 2026 (groupe E, heures locales de Bakou, UTC+4) :
 *    https://digitalhub.fifa.com/asset/c8711ca2-6faf-4f7e-9aa3-4539173ea70c/FIFA-U-15-World-Cup-Festival-2026-Match-Schedule.pdf
 *  - Les Dépêches de Brazzaville (Adiac), 19 octobre 2026 : réception de la délégation et remise du drapeau ;
 *  - Africa Soccer, 20 octobre 2026.
 * Le sélectionneur, le staff et la liste des 14 joueurs n'ont pas été publiés : ils restent à saisir par la
 * fédération (Administration › Équipes nationales). Rien n'est inventé. Relançable sans doublon.
 */
const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL n'est pas défini.");
const sql = postgres(url, { max: 1 });

const COMPETITION = "Coupe du Monde FIFA U-15 2026 · Groupe E";
const VENUE = "Complexe de Hövsan, Bakou (Azerbaïdjan)";
// Heure de Bakou (UTC+4) → instant exact.
const baku = (iso: string) => new Date(`${iso}:00+04:00`);
const FIXTURES = [
  { at: "2026-10-24T09:00", opponent: "Tadjikistan", isHome: true },
  { at: "2026-10-25T14:30", opponent: "Espagne", isHome: true },
  { at: "2026-10-25T20:45", opponent: "Koweït", isHome: true },
  { at: "2026-10-26T14:30", opponent: "Chili", isHome: false },
  { at: "2026-10-26T20:45", opponent: "Barbade", isHome: false },
];

const SELECTION_TITLE = "Coupe du Monde FIFA U-15 — Azerbaïdjan 2026";
const PURPOSE = `Première édition de la Coupe du Monde et Festival FIFA U-15, du 22 au 31 octobre 2026 à Bakou (Azerbaïdjan) : matchs à 8 contre 8, deux mi-temps de 20 minutes, 14 joueurs nés en 2011 ou 2012 par délégation. Le Congo est dans le groupe E avec l'Espagne, le Chili, le Koweït, le Tadjikistan et la Barbade ; le classement du groupe détermine le niveau de la phase finale (28-30 octobre).`;

const ARTICLE_SLUG = "coupe-du-monde-fifa-u15-diables-rouges-cadets-groupe-e-bakou";
const ARTICLE = {
  title: "Coupe du Monde FIFA U-15 : les Diables Rouges cadets entrent en lice à Bakou",
  summary:
    "Première Coupe du Monde FIFA U-15 de l'histoire : le Congo, dans le groupe E avec l'Espagne, le Chili, le Koweït, le Tadjikistan et la Barbade, ouvre son tournoi le 24 octobre face au Tadjikistan.",
  body: `La sélection congolaise des moins de 15 ans dispute la toute première **Coupe du Monde et Festival FIFA U-15**, organisée du 22 au 31 octobre 2026 à Bakou, en Azerbaïdjan.

## Une délégation reçue avant le départ
Le 19 octobre à Brazzaville, le directeur de cabinet du ministre des Sports, Charles Makaya, a reçu la délégation, lui a transmis les dernières consignes et lui a remis le drapeau national, en présence du président de la Fécofoot. Il a rappelé aux jeunes joueurs que représenter le pays est un grand honneur.

## Le format
- Matchs à **8 contre 8**, deux mi-temps de 20 minutes
- **14 joueurs** par délégation, nés en 2011 ou 2012
- Phase de groupes du 24 au 26 octobre, puis phase finale par niveaux du 28 au 30 octobre selon le classement du groupe
- Rencontres au complexe de Hövsan ; finales au Baku Crystal Hall

## Le calendrier du Congo (groupe E)
Heures de Brazzaville (heure locale de Bakou entre parenthèses) :
- **Samedi 24 octobre**, 6 h (9 h) : Congo – Tadjikistan
- **Dimanche 25 octobre**, 11 h 30 (14 h 30) : Congo – Espagne
- **Dimanche 25 octobre**, 17 h 45 (20 h 45) : Congo – Koweït
- **Lundi 26 octobre**, 11 h 30 (14 h 30) : Chili – Congo
- **Lundi 26 octobre**, 17 h 45 (20 h 45) : Barbade – Congo

Horaires donnés par la FIFA sous réserve de modification. Les résultats seront publiés sur la page de la sélection au fil du tournoi.

*Sources : [calendrier officiel de la FIFA](https://digitalhub.fifa.com/asset/c8711ca2-6faf-4f7e-9aa3-4539173ea70c/FIFA-U-15-World-Cup-Festival-2026-Match-Schedule.pdf), [Les Dépêches de Brazzaville](https://www.adiac-congo.com/content/coupe-du-monde-fifa-u-15-les-diables-rouges-cadets-pares-pour-le-rendez-vous-de-bakou-172045).*`,
};

await sql.begin(async (tx) => {
  const audit = (action: string, entity: string, entityId: number, details: object) =>
    tx`insert into audit_logs (user_id, action, entity, entity_id, details) values (null, ${action}, ${entity}, ${String(entityId)}, ${tx.json({ ...details, script: "u15-bakou" } as never)})`;

  await tx`insert into national_teams (code, name, slug) values ('U15', 'Diables Rouges U-15', 'u15') on conflict (code) do nothing`;
  const [team] = await tx`select id from national_teams where code = 'U15'`;

  let [selection] = await tx`select id from selections where team_id = ${team.id} and title = ${SELECTION_TITLE}`;
  if (!selection) {
    [selection] = await tx`
      insert into selections (team_id, title, purpose, gathering_date, location, status, published_at)
      values (${team.id}, ${SELECTION_TITLE}, ${PURPOSE}, '2026-10-19', 'Bakou (Azerbaïdjan)', 'PUBLISHED', ${new Date("2026-10-19T12:00:00+01:00")})
      returning id`;
    await audit("CREATE", "selection", selection.id, { title: SELECTION_TITLE });
  }

  for (const f of FIXTURES) {
    const kickoff = baku(f.at);
    const [exists] = await tx`select id from national_fixtures where team_id = ${team.id} and kickoff_at = ${kickoff} and opponent = ${f.opponent}`;
    if (exists) continue;
    const [row] = await tx`
      insert into national_fixtures (team_id, opponent, kickoff_at, venue, competition, is_home, status)
      values (${team.id}, ${f.opponent}, ${kickoff}, ${VENUE}, ${COMPETITION}, ${f.isHome}, 'SCHEDULED')
      returning id`;
    await audit("CREATE", "national_fixture", row.id, { opponent: f.opponent });
  }

  const [article] = await tx`select id from articles where slug = ${ARTICLE_SLUG}`;
  if (!article) {
    const [admin] = await tx`select id from users where role = 'SUPER_ADMIN' order by id limit 1`;
    const [row] = await tx`
      insert into articles (slug, title, summary, body, category, status, published_at, author_id)
      values (${ARTICLE_SLUG}, ${ARTICLE.title}, ${ARTICLE.summary}, ${ARTICLE.body}, 'NATIONAL_TEAMS', 'PUBLISHED', ${new Date()}, ${admin?.id ?? null})
      returning id`;
    await audit("CREATE", "article", row.id, { slug: ARTICLE_SLUG });
  }
});
console.log("Diables Rouges U-15 : sélection, calendrier du groupe E et article publiés.");
await sql.end();

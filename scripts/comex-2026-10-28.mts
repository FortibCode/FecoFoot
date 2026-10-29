import "dotenv/config";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import { articles, auditLogs, championshipDocuments, championships, competitions, governanceBodies, governanceMembers, trainings, users } from "../lib/db/schema";
import { putFile } from "../lib/storage";

/**
 * Communiqué du Comité exécutif du 28 octobre 2026 (relançable sans doublon) :
 *   npm run comex:2026-10-28 -- <chemin du PDF officiel>
 *  - championnat de première division : nom officiel « Direct Ligue 1 » (« Championnat National Direct Ligue I ») ;
 *    passage de 14 à 18 clubs en mode zonal acté, liste et zones à publier par la fédération ;
 *  - saison en cours renommée en conséquence (adresse publique alignée sur la saison 2026-2027) ;
 *  - PDF officiel publié dans « Documents et règlements » du championnat ;
 *  - communiqué publié dans Actualités (rubrique Communiqués), avec le lien vers le PDF ;
 *  - instances citées : Comité exécutif (président), nouvelle Commission d'arbitrage, Assemblée générale ;
 *  - formation FIFA des dirigeants (16-18 novembre 2026, Brazzaville, près de 80 participants).
 */
const pdfPath = process.argv[2];
if (!pdfPath) throw new Error("Usage : npm run comex:2026-10-28 -- <chemin du PDF>");
const pdf = new Uint8Array(await readFile(pdfPath));
if (String.fromCharCode(...pdf.slice(0, 5)) !== "%PDF-") throw new Error("Le fichier n'est pas un PDF.");

const audit = (action: string, entity: string, entityId: number, details: object) =>
  db.insert(auditLogs).values({ userId: null, action, entity, entityId: String(entityId), details: { ...details, script: "comex-2026-10-28" } });

const [ch] = await db.select().from(championships).where(eq(championships.code, "ligue-1")).limit(1);
if (!ch) throw new Error("Championnat Ligue 1 introuvable.");
const [season] = await db.select().from(competitions).where(eq(competitions.championshipId, ch.id)).orderBy(competitions.season).limit(50).then((r) => r.slice(-1));

const DESCRIPTION = `Championnat National Direct Ligue I : première division du football congolais.

Le Comité exécutif réuni le 28 octobre 2026 a acté le passage de 14 à 18 clubs, en mode zonal. Ce format répond à une exigence économique : la compétition par zones réduit la charge des déplacements pour les clubs. La liste des 18 clubs et la composition des zones seront publiées par la fédération ; la liste affichée ici est provisoire.

Le calendrier de la saison n'est pas encore publié. Dernier champion : AC Léopards de Dolisie (2023-2024) ; la saison 2024-2025 a été annulée.`;

await db.update(championships).set({ name: "Direct Ligue 1", description: DESCRIPTION, updatedAt: new Date() }).where(eq(championships.id, ch.id));
await audit("UPDATE", "championship", ch.id, { name: "Direct Ligue 1", source: "Communiqué du Comex du 28 octobre 2026" });
if (season) {
  const slug = `direct-ligue-1-${season.season}-${season.season + 1}`;
  await db.update(competitions).set({ name: "Direct Ligue 1", slug }).where(eq(competitions.id, season.id));
  await audit("UPDATE", "competition", season.id, { name: "Direct Ligue 1", slug });
}

// PDF officiel dans « Documents et règlements » du championnat.
const DOC_TITLE = "Communiqué du Comité exécutif du 28 octobre 2026";
let [doc] = await db.select().from(championshipDocuments).where(and(eq(championshipDocuments.championshipId, ch.id), eq(championshipDocuments.title, DOC_TITLE))).limit(1);
if (!doc) {
  const storageKey = `championships/${ch.id}/${randomUUID()}.pdf`;
  await putFile(storageKey, pdf);
  [doc] = await db
    .insert(championshipDocuments)
    .values({ championshipId: ch.id, season: season?.season ?? null, title: DOC_TITLE, storageKey, contentType: "application/pdf", size: pdf.length, published: true })
    .returning();
  await audit("CREATE", "championship_document", doc.id, { title: DOC_TITLE });
}

const SLUG = "communique-comite-executif-28-octobre-2026";
const BODY = `Sous l'autorité de son président, **Éric Alain Mantot**, le nouveau Comité exécutif de la FECOFOOT s'est réuni le mercredi 28 octobre 2026 à son siège de Brazzaville, pour sa première session.

## Mission du président à la FIFA

Le président a rendu compte de sa visite à la FIFA et souligné l'urgence de relancer, avant la fin de l'année, les projets initiés par l'ancien bureau et bloqués du fait de la restriction qui frappait la FECOFOOT.

Une **formation FIFA** destinée aux présidents et secrétaires généraux des clubs ainsi qu'aux présidents de ligues se tiendra **du 16 au 18 novembre 2026 à Brazzaville** (près de 80 participants) : leadership et management, gouvernance et questions juridiques, finances, opération du club et gestion du stade, marketing et communication. À l'issue de cette formation, une subvention exceptionnelle sera allouée aux clubs, après signature d'une convention les obligeant à rendre compte de l'utilisation des fonds. Le président a rappelé que la fédération n'a pas vocation à financer les clubs et que d'autres mécanismes doivent être explorés, notamment les sponsors et annonceurs.

## Projets d'investissement d'ici décembre 2026

- Ignié : achèvement du bâtiment d'hébergement des jeunes et réhabilitation des bâtiments existants
- Centre médico-sportif au siège de la FECOFOOT
- Sièges de deux ligues départementales
- Acquisition de deux bus
- Construction de deux stades FIFA Arena
- Réhabilitation de la pelouse et des vestiaires du complexe sportif de Pointe-Noire

## Nouvelle Commission d'arbitrage

- Président : KIBELO Jean Baptiste Marcel
- Vice-président : BANTABA Sabhas Ghislain
- Membres : MOUKOKO Jean Michel, YENGO Omerine Destinée, TSOTA Victoire, LOUVOUEZO Landry, NGOYI Hermann

## Règlement intérieur et règlement financier

Le Comité exécutif fera appel à un cabinet conseil pour une version des deux textes conforme aux Statuts de la FECOFOOT et aux exigences de la FIFA.

## Direct Ligue I : de 14 à 18 clubs, en mode zonal

Le passage de 14 à 18 clubs répond à une exigence économique, le choix d'une compétition zonale étant dicté par l'importance de la charge ; les clubs devront s'organiser différemment. Les Statuts autorisent le Comité exécutif à apporter cette modification ; la composition de l'Assemblée générale (45 délégués, dont « les 14 équipes du Championnat National Direct Ligue I ») sera précisée lors de la prochaine Assemblée générale extraordinaire.

## Jeunes, football féminin et UNIFFAC

- Tournois UNIFFAC U15 et U17, en masculin et en féminin
- Stratégie de relance à court et moyen terme du championnat national féminin
- Championnat national des jeunes (U15 et U17) ouvert aux équipes jeunes des clubs, aux académies et aux centres de formation

## Direction technique nationale et gouvernance

- Recrutement d'un **Directeur technique national** par appel à candidatures international, avec l'accompagnement de la FIFA, entre novembre et mi-décembre 2026
- Accord de principe pour une **Assemblée générale extraordinaire** avant la fin de l'année
- Le Comité exécutif n'est pas habilité à lever les sanctions prononcées par les commissions juridictionnelles
- Des groupes de réflexion sont mis en place pour rendre les commissions permanentes plus opérationnelles

[Télécharger le communiqué officiel (PDF)](${process.env.APP_URL ?? "http://localhost:3000"}/media/championnats/documents/${doc.id})

*Fait à Brazzaville, le 28 octobre 2026 — Le Comité exécutif.*`;

const [existing] = await db.select({ id: articles.id }).from(articles).where(eq(articles.slug, SLUG)).limit(1);
if (existing) {
  await db.update(articles).set({ body: BODY, updatedAt: new Date() }).where(eq(articles.id, existing.id));
} else {
  const [admin] = await db.select({ id: users.id }).from(users).where(eq(users.role, "SUPER_ADMIN")).limit(1);
  const [a] = await db
    .insert(articles)
    .values({
      slug: SLUG,
      title: "Communiqué du Comité exécutif du 28 octobre 2026",
      summary:
        "Première session du nouveau Comex : Direct Ligue I à 18 clubs en mode zonal, nouvelle Commission d'arbitrage, formation FIFA des dirigeants du 16 au 18 novembre, projets d'investissement et recrutement d'un DTN.",
      body: BODY,
      category: "COMMUNIQUE",
      status: "PUBLISHED",
      publishedAt: new Date(),
      authorId: admin?.id ?? null,
    })
    .returning({ id: articles.id });
  await audit("CREATE", "article", a.id, { slug: SLUG });
}
// Instances et commissions citées par le communiqué.
const SOURCE = "Communiqué du Comex du 28 octobre 2026";
const BODIES: { slug: string; name: string; kind: "EXECUTIVE" | "PERMANENT" | "GENERAL_ASSEMBLY"; sortOrder: number; description: string; members: { fullName: string; position: string; startDate: string | null }[] }[] = [
  {
    slug: "comite-executif",
    name: "Comité exécutif",
    kind: "EXECUTIVE",
    sortOrder: 0,
    description: "Instance dirigeante de la fédération. Le nouveau Comité exécutif a tenu sa première session le 28 octobre 2026 à Brazzaville.",
    members: [{ fullName: "Éric Alain MANTOT", position: "Président", startDate: null }],
  },
  {
    slug: "assemblee-generale",
    name: "Assemblée générale",
    kind: "GENERAL_ASSEMBLY",
    sortOrder: 5,
    description:
      "45 délégués, dont les équipes du Championnat National Direct Ligue I (Statuts de la FECOFOOT). Le Comité exécutif a donné son accord de principe pour une Assemblée générale extraordinaire avant la fin de l'année 2026.",
    members: [],
  },
  {
    slug: "commission-d-arbitrage",
    name: "Commission d'arbitrage",
    kind: "PERMANENT",
    sortOrder: 10,
    description: "Commission adoptée par le Comité exécutif le 28 octobre 2026.",
    members: [
      { fullName: "KIBELO Jean Baptiste Marcel", position: "Président", startDate: "2026-10-28" },
      { fullName: "BANTABA Sabhas Ghislain", position: "Vice-président", startDate: "2026-10-28" },
      { fullName: "MOUKOKO Jean Michel", position: "Membre", startDate: "2026-10-28" },
      { fullName: "YENGO Omerine Destinée", position: "Membre", startDate: "2026-10-28" },
      { fullName: "TSOTA Victoire", position: "Membre", startDate: "2026-10-28" },
      { fullName: "LOUVOUEZO Landry", position: "Membre", startDate: "2026-10-28" },
      { fullName: "NGOYI Hermann", position: "Membre", startDate: "2026-10-28" },
    ],
  },
];
for (const def of BODIES) {
  let [body] = await db.select().from(governanceBodies).where(eq(governanceBodies.slug, def.slug)).limit(1);
  if (!body) {
    [body] = await db.insert(governanceBodies).values({ slug: def.slug, name: def.name, kind: def.kind, sortOrder: def.sortOrder, description: def.description }).returning();
    await audit("CREATE", "governance_body", body.id, { name: def.name });
  }
  for (const m of def.members) {
    const [found] = await db
      .select({ id: governanceMembers.id })
      .from(governanceMembers)
      .where(and(eq(governanceMembers.bodyId, body.id), eq(governanceMembers.fullName, m.fullName), eq(governanceMembers.position, m.position)))
      .limit(1);
    if (found) continue;
    const [row] = await db.insert(governanceMembers).values({ ...m, bodyId: body.id, source: SOURCE }).returning({ id: governanceMembers.id });
    await audit("GOVERNANCE_MEMBER_ADD", "governance_member", row.id, { body: def.name, fullName: m.fullName, position: m.position });
  }
}

// Formation FIFA des présidents et secrétaires généraux de clubs et des présidents de ligues.
const TRAINING_SLUG = "formation-fifa-des-dirigeants-de-clubs-et-de-ligues-2026-11-16";
const [training] = await db.select({ id: trainings.id }).from(trainings).where(eq(trainings.slug, TRAINING_SLUG)).limit(1);
if (!training) {
  const [t] = await db
    .insert(trainings)
    .values({
      slug: TRAINING_SLUG,
      title: "Formation FIFA des dirigeants de clubs et de ligues",
      organizer: "FIFA · FECOFOOT",
      location: "Brazzaville",
      startDate: "2026-11-16",
      endDate: "2026-11-18",
      capacity: 80,
      modules: ["Leadership et management", "Gouvernance et questions juridiques", "Finances", "Opération du club et gestion du stade", "Marketing et communication"],
      description:
        "Formation prévue par la FIFA pour les présidents et secrétaires généraux des clubs, ainsi que les présidents de ligues. À son issue, une subvention exceptionnelle sera allouée aux clubs après signature d'une convention les obligeant à rendre compte de l'utilisation des fonds (communiqué du Comex du 28 octobre 2026).",
    })
    .returning({ id: trainings.id });
  await audit("CREATE", "training", t.id, { slug: TRAINING_SLUG });
}

console.log(`Direct Ligue 1 mis à jour, communiqué publié (/actualites/${SLUG}), PDF : /media/championnats/documents/${doc.id}`);
process.exit(0);

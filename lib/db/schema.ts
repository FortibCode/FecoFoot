import { sql } from "drizzle-orm";
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgSequence,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { ROLES } from "../auth/roles";
import { CLUB_STATUSES } from "../clubs";
import { DOCUMENT_TYPE_KEYS } from "../documents";
import { TRANSFER_STATUSES, TRANSFER_TYPES } from "../transfers";
import { COMPETITION_CATEGORIES, COMPETITION_STATUSES, COMPETITION_TYPES, DEFAULT_TIEBREAKERS, EVENT_TYPES, GENDERS, MATCH_STATUSES, TEAM_OUTCOMES } from "../competitions";
import { OFFICIAL_ROLES, REFEREE_GRADES } from "../referees";
import { FIXTURE_STATUSES, NATIONAL_TEAM_CODES, SELECTION_STATUSES } from "../national-teams";
import { ID_DOCUMENT_TYPES, MEMBERSHIP_TIERS } from "../supporters";
import { PAYMENT_METHODS, PAYMENT_PURPOSES, PAYMENT_STATUSES } from "../payments-rules";
import { EVENT_KINDS, ORDER_CHANNELS, ORDER_STATUSES, SALES_STATUSES, TICKET_STATUSES } from "../ticketing";
import { ACCREDITATION_STATUSES, PRESS_ROLES, PRESS_ZONES } from "../accreditations";
import { ARTICLE_CATEGORIES } from "../articles";
import { CASE_STATUSES, SANCTION_TYPES } from "../discipline";
import { CATEGORIES, CONSENT_STATUSES, IDENTITY_METHODS, LICENSE_STATUSES, LICENSE_TYPES, POSITIONS } from "../licenses";
import { BIOMETRIC_CHECK_RESULTS } from "../biometrics-rules";
import { EXTERNAL_PROVIDERS, LINK_ENTITIES, SCORE_SOURCES } from "../external-sync-rules";

// ─── Sécurité ────────────────────────────────────────────────────────────────

export const roleEnum = pgEnum("role", ROLES);

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    email: varchar("email", { length: 255 }).notNull(),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    phone: varchar("phone", { length: 32 }),
    passwordHash: text("password_hash").notNull(),
    role: roleEnum("role").notNull(),
    // Périmètre : obligatoire pour le profil LEAGUE (ligue) et CLUB (club).
    leagueId: integer("league_id").references(() => leagues.id),
    clubId: integer("club_id").references(() => clubs.id),
    active: boolean("active").notNull().default(true),
    // Verrouillage temporaire après échecs de connexion (EF-AUT-06).
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    // Incrémenté à chaque changement de mot de passe ou désactivation : invalide les sessions ouvertes.
    sessionVersion: integer("session_version").notNull().default(1),
    // Double authentification (EF-AUT-05) : secret chiffré, date d'activation, dernier pas utilisé (anti-rejeu).
    totpSecret: text("totp_secret"),
    totpEnabledAt: timestamp("totp_enabled_at", { withTimezone: true }),
    totpLastStep: integer("totp_last_step"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("users_email_uq").on(t.email)],
);

export const auditLogs = pgTable(
  "audit_logs",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id").references(() => users.id),
    action: varchar("action", { length: 64 }).notNull(),
    entity: varchar("entity", { length: 64 }).notNull(),
    entityId: varchar("entity_id", { length: 64 }),
    details: jsonb("details"),
    ip: varchar("ip", { length: 64 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("audit_logs_entity_idx").on(t.entity, t.entityId),
    index("audit_logs_created_idx").on(t.createdAt),
  ],
);

/** Liens de réinitialisation de mot de passe (EF-AUT-04) : seule l'empreinte est conservée. */
export const passwordResets = pgTable(
  "password_resets",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("password_resets_token_uq").on(t.tokenHash), index("password_resets_user_idx").on(t.userId)],
);

/** Compteurs de limitation des requêtes (ENF-13), partagés entre toutes les instances de l'application. */
export const rateLimits = pgTable("rate_limits", {
  key: varchar("key", { length: 200 }).primaryKey(),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull(),
  count: integer("count").notNull(),
});

/**
 * Journal des notifications SMS / e-mail (EF-NOT-01, EF-NOT-02).
 * En mode « log », le contenu est conservé pour être consulté ; en production, seul un résumé l'est
 * (les messages contiennent des liens personnels).
 */
export const notificationChannelEnum = pgEnum("notification_channel", ["SMS", "EMAIL"]);
export const notificationStatusEnum = pgEnum("notification_status", ["LOGGED", "SENT", "FAILED"]);

export const notifications = pgTable(
  "notifications",
  {
    id: serial("id").primaryKey(),
    channel: notificationChannelEnum("channel").notNull(),
    recipient: varchar("recipient", { length: 255 }).notNull(),
    subject: varchar("subject", { length: 200 }),
    body: text("body").notNull(),
    topic: varchar("topic", { length: 64 }).notNull(),
    status: notificationStatusEnum("status").notNull(),
    error: text("error"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("notifications_created_idx").on(t.createdAt), index("notifications_recipient_idx").on(t.recipient)],
);

// ─── Organisation ────────────────────────────────────────────────────────────

export const leagues = pgTable(
  "leagues",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 8 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    // Département administratif couvert par la ligue (une ligue ↔ un département).
    department: varchar("department", { length: 80 }),
    description: text("description"),
    president: varchar("president", { length: 160 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    logoKey: varchar("logo_key", { length: 255 }),
    logoType: varchar("logo_type", { length: 64 }),
    // Désactivée : masquée du portail et fermée aux nouveaux clubs, historique conservé.
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("leagues_code_uq").on(t.code)],
);

/** Source des numéros d'affiliation : jamais réutilisés, sans collision en cas de créations simultanées. */
export const clubAffiliationSeq = pgSequence("club_affiliation_seq", { startWith: 1 });

export const clubStatusEnum = pgEnum("club_status", CLUB_STATUSES);

export const clubs = pgTable(
  "clubs",
  {
    id: serial("id").primaryKey(),
    // Numéro d'affiliation automatique : FCF-CLB-0001 (EF-CLB-02).
    affiliationNumber: varchar("affiliation_number", { length: 16 }).notNull(),
    name: varchar("name", { length: 160 }).notNull(),
    shortName: varchar("short_name", { length: 16 }),
    slug: varchar("slug", { length: 180 }).notNull(),
    // Ligue départementale de rattachement ; null : club rattaché directement à la fédération (division nationale).
    leagueId: integer("league_id").references(() => leagues.id),
    city: varchar("city", { length: 120 }).notNull(),
    stadium: varchar("stadium", { length: 160 }),
    colors: varchar("colors", { length: 80 }),
    foundedYear: integer("founded_year"),
    status: clubStatusEnum("status").notNull().default("PENDING"),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("clubs_affiliation_uq").on(t.affiliationNumber),
    uniqueIndex("clubs_slug_uq").on(t.slug),
    index("clubs_league_idx").on(t.leagueId),
  ],
);

export const clubOfficials = pgTable(
  "club_officials",
  {
    id: serial("id").primaryKey(),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    position: varchar("position", { length: 80 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("club_officials_club_idx").on(t.clubId)],
);

// ─── Joueurs et licences (M04, M05) ──────────────────────────────────────────

export const playerFederalSeq = pgSequence("player_federal_seq", { startWith: 1 });
export const licenseNumberSeq = pgSequence("license_number_seq", { startWith: 1 });

export const genderEnum = pgEnum("gender", ["M", "F"]);
export const positionEnum = pgEnum("player_position", POSITIONS);

export const identityMethodEnum = pgEnum("identity_method", IDENTITY_METHODS);

export const players = pgTable(
  "players",
  {
    id: serial("id").primaryKey(),
    // Identifiant fédéral unique, jamais réutilisé (RG-01).
    federalId: varchar("federal_id", { length: 24 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    birthDate: date("birth_date", { mode: "date" }).notNull(),
    birthPlace: varchar("birth_place", { length: 120 }),
    gender: genderEnum("gender").notNull(),
    nationality: varchar("nationality", { length: 60 }).notNull().default("Congolaise"),
    position: positionEnum("position"),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    // Représentant légal, obligatoire pour un mineur (EF-ACC-01).
    guardianName: varchar("guardian_name", { length: 160 }),
    guardianPhone: varchar("guardian_phone", { length: 32 }),
    guardianEmail: varchar("guardian_email", { length: 255 }),
    clubId: integer("club_id").references(() => clubs.id),
    // Compte de l'espace personnel du joueur (consultation de ses propres données).
    userId: integer("user_id").references(() => users.id),
    // Contrôle d'identité par un agent habilité : sur pièces aujourd'hui, biométrique quand un prestataire sera intégré.
    identityVerifiedAt: timestamp("identity_verified_at", { withTimezone: true }),
    identityVerifiedBy: integer("identity_verified_by").references(() => users.id),
    identityMethod: identityMethodEnum("identity_method"),
    // Publication (accord du joueur ou de son représentant) : photo sur la vérification publique, date de naissance sur la carte.
    publishPhoto: boolean("publish_photo").notNull().default(false),
    showBirthDate: boolean("show_birth_date").notNull().default(true),
    // Contrôle anti-doublon (EF-LIC-02) : nom + prénom normalisés + date de naissance.
    identityKey: varchar("identity_key", { length: 200 }).notNull(),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("players_federal_id_uq").on(t.federalId),
    uniqueIndex("players_identity_uq").on(t.identityKey),
    uniqueIndex("players_user_uq").on(t.userId),
    index("players_club_idx").on(t.clubId),
    index("players_name_idx").on(t.lastName, t.firstName),
  ],
);

export const licenseStatusEnum = pgEnum("license_status", LICENSE_STATUSES);
export const licenseTypeEnum = pgEnum("license_type", LICENSE_TYPES);
export const categoryEnum = pgEnum("age_category", CATEGORIES);

export const licenses = pgTable(
  "licenses",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 24 }).notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    // Année de début de saison : 2026 = saison 2026-2027.
    season: integer("season").notNull(),
    category: categoryEnum("category").notNull(),
    type: licenseTypeEnum("type").notNull().default("AMATEUR"),
    status: licenseStatusEnum("status").notNull().default("PENDING"),
    medicalCheckDate: date("medical_check_date", { mode: "date" }).notNull(),
    // Droits de licence en FCFA, sans décimale (RG-17).
    feeAmount: integer("fee_amount").notNull(),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    paymentRef: varchar("payment_ref", { length: 64 }),
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    validatedBy: integer("validated_by").references(() => users.id),
    decisionReason: text("decision_reason"),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    // Jeton du QR code de vérification publique (EF-PUB-06, EF-LIC-07).
    verifyToken: varchar("verify_token", { length: 64 }).notNull(),
    requestedBy: integer("requested_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("licenses_number_uq").on(t.number),
    uniqueIndex("licenses_verify_token_uq").on(t.verifyToken),
    // Une seule licence active par joueur et par saison (RG-02). Une demande rejetée peut être refaite,
    // et une licence close par transfert laisse le club d'accueil en déposer une nouvelle (RG-06).
    // Liste positive : un index ne peut pas citer une valeur d'énumération ajoutée dans la même migration.
    uniqueIndex("licenses_player_season_uq")
      .on(t.playerId, t.season)
      .where(sql`${t.status} in ('PENDING', 'PAID', 'VALIDATED', 'SUSPENDED', 'EXPIRED')`),
    index("licenses_club_season_idx").on(t.clubId, t.season),
    index("licenses_status_idx").on(t.status),
  ],
);

export const consentRecipientEnum = pgEnum("consent_recipient", ["PLAYER", "GUARDIAN"]);
export const consentStatusEnum = pgEnum("consent_status", CONSENT_STATUSES);

export const playerConsents = pgTable(
  "player_consents",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    recipient: consentRecipientEnum("recipient").notNull(),
    recipientName: varchar("recipient_name", { length: 160 }).notNull(),
    recipientPhone: varchar("recipient_phone", { length: 32 }),
    recipientEmail: varchar("recipient_email", { length: 255 }),
    // Seule l'empreinte SHA-256 du lien est conservée.
    tokenHash: varchar("token_hash", { length: 64 }).notNull(),
    status: consentStatusEnum("status").notNull().default("PENDING"),
    requestedAt: timestamp("requested_at", { withTimezone: true }).notNull().defaultNow(),
    linkExpiresAt: timestamp("link_expires_at", { withTimezone: true }).notNull(),
    requestedBy: integer("requested_by").references(() => users.id),
    respondedAt: timestamp("responded_at", { withTimezone: true }),
    refusalReason: text("refusal_reason"),
    validUntil: timestamp("valid_until", { withTimezone: true }),
    declarations: jsonb("declarations"),
    respondentIp: varchar("respondent_ip", { length: 64 }),
    // Vérifications de date de naissance erronées : le lien est bloqué au-delà de CONSENT_MAX_FAILED_CHECKS.
    failedChecks: integer("failed_checks").notNull().default(0),
  },
  (t) => [
    uniqueIndex("player_consents_token_uq").on(t.tokenHash),
    index("player_consents_player_club_idx").on(t.playerId, t.clubId),
  ],
);

// ─── Transferts (M06) ────────────────────────────────────────────────────────

export const transferNumberSeq = pgSequence("transfer_number_seq", { startWith: 1 });
export const transferTypeEnum = pgEnum("transfer_type", TRANSFER_TYPES);
export const transferStatusEnum = pgEnum("transfer_status", TRANSFER_STATUSES);

export const transfers = pgTable(
  "transfers",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 24 }).notNull(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    // Club quitté (null : joueur sans club).
    fromClubId: integer("from_club_id").references(() => clubs.id),
    toClubId: integer("to_club_id")
      .notNull()
      .references(() => clubs.id),
    type: transferTypeEnum("type").notNull(),
    // Indemnité en FCFA (RG-17).
    fee: integer("fee").notNull().default(0),
    loanEndDate: date("loan_end_date", { mode: "date" }),
    season: integer("season").notNull(),
    status: transferStatusEnum("status").notNull().default("PENDING"),
    reviewOpinion: text("review_opinion"),
    reviewedBy: integer("reviewed_by").references(() => users.id),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    // Accord du club quitté (EF-TRF-05) : null tant qu'il n'a pas répondu.
    releaseGranted: boolean("release_granted"),
    releaseReason: text("release_reason"),
    releaseBy: integer("release_by").references(() => users.id),
    releaseAt: timestamp("release_at", { withTimezone: true }),
    decisionReason: text("decision_reason"),
    decidedBy: integer("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("transfers_number_uq").on(t.number),
    // Un seul transfert en cours par joueur (EF-TRF-02).
    uniqueIndex("transfers_one_active_uq")
      .on(t.playerId)
      .where(sql`${t.status} in ('PENDING', 'FORWARDED')`),
    index("transfers_status_idx").on(t.status),
    index("transfers_to_club_idx").on(t.toClubId),
    index("transfers_from_club_idx").on(t.fromClubId),
  ],
);

/** Fenêtres de transfert paramétrables (EF-TRF-04). */
export const transferWindows = pgTable(
  "transfer_windows",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    name: varchar("name", { length: 80 }).notNull(),
    opensOn: date("opens_on", { mode: "date" }).notNull(),
    closesOn: date("closes_on", { mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("transfer_windows_season_idx").on(t.season)],
);

// ─── Documents téléversés (EF-LIC-01, EF-LIC-09, EF-CLB-05) ─────────────────

export const documentTypeEnum = pgEnum("document_type", DOCUMENT_TYPE_KEYS as [string, ...string[]]);
export const documentOwnerEnum = pgEnum("document_owner", ["player", "club"]);

export const documents = pgTable(
  "documents",
  {
    id: serial("id").primaryKey(),
    ownerType: documentOwnerEnum("owner_type").notNull(),
    ownerId: integer("owner_id").notNull(),
    type: documentTypeEnum("type").notNull(),
    // Clé dans le stockage (disque en développement, stockage objet en production).
    storageKey: varchar("storage_key", { length: 200 }).notNull(),
    originalName: varchar("original_name", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    size: integer("size").notNull(),
    uploadedBy: integer("uploaded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("documents_storage_key_uq").on(t.storageKey),
    index("documents_owner_idx").on(t.ownerType, t.ownerId, t.type),
  ],
);

// ─── Compétitions (M07) ──────────────────────────────────────────────────────

export const competitionTypeEnum = pgEnum("competition_type", COMPETITION_TYPES);
export const competitionStatusEnum = pgEnum("competition_status", COMPETITION_STATUSES);
export const competitionGenderEnum = pgEnum("competition_gender", GENDERS);
export const matchStatusEnum = pgEnum("match_status", MATCH_STATUSES);
export const matchEventTypeEnum = pgEnum("match_event_type", EVENT_TYPES);
export const competitionCategoryEnum = pgEnum("competition_category", COMPETITION_CATEGORIES);

export const teamOutcomeEnum = pgEnum("team_outcome", TEAM_OUTCOMES);

/**
 * Championnats nationaux (Ligue 1, Ligue 2…) : la structure permanente, distincte des ligues
 * départementales. Chaque saison est une compétition rattachée (`competitions.championshipId`).
 */
export const championships = pgTable(
  "championships",
  {
    id: serial("id").primaryKey(),
    code: varchar("code", { length: 32 }).notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    // Niveau : 1 = première division ; sert aux montées et descentes entre championnats.
    tier: integer("tier").notNull(),
    description: text("description"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("championships_code_uq").on(t.code)],
);

export const officialStatusEnum = pgEnum("official_status", ["ACTIVE", "ENDED"]);

/**
 * Responsables des championnats nationaux et leurs mandats. `championshipId` null : responsable de
 * la structure commune aux championnats nationaux. Un mandat clos reste dans l'historique.
 */
export const championshipOfficials = pgTable(
  "championship_officials",
  {
    id: serial("id").primaryKey(),
    championshipId: integer("championship_id").references(() => championships.id),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    position: varchar("position", { length: 120 }).notNull(),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    startDate: date("start_date").notNull(),
    endDate: date("end_date"),
    status: officialStatusEnum("status").notNull().default("ACTIVE"),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("championship_officials_idx").on(t.championshipId, t.status)],
);

/** Documents officiels et règlements d'un championnat (PDF), pour une saison ou permanents (`season` null). */
export const championshipDocuments = pgTable(
  "championship_documents",
  {
    id: serial("id").primaryKey(),
    championshipId: integer("championship_id")
      .notNull()
      .references(() => championships.id),
    season: integer("season"),
    title: varchar("title", { length: 200 }).notNull(),
    storageKey: varchar("storage_key", { length: 255 }).notNull(),
    contentType: varchar("content_type", { length: 64 }).notNull(),
    size: integer("size").notNull(),
    published: boolean("published").notNull().default(true),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("championship_documents_idx").on(t.championshipId, t.season)],
);

export const competitions = pgTable(
  "competitions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    season: integer("season").notNull(),
    category: competitionCategoryEnum("category").notNull(),
    gender: competitionGenderEnum("gender").notNull().default("M"),
    // Ligue organisatrice (championnat départemental) ; null : compétition nationale.
    leagueId: integer("league_id").references(() => leagues.id),
    // Saison d'un championnat national (Ligue 1, Ligue 2) ; null : compétition indépendante.
    championshipId: integer("championship_id").references(() => championships.id),
    // Montées et descentes de la saison (par poule), selon le règlement : 0 = aucune.
    promotionSpots: integer("promotion_spots").notNull().default(0),
    relegationSpots: integer("relegation_spots").notNull().default(0),
    type: competitionTypeEnum("type").notNull(),
    status: competitionStatusEnum("status").notNull().default("DRAFT"),
    // Championnat : aller-retour ou aller simple (EF-CMP-03).
    doubleRound: boolean("double_round").notNull().default(true),
    // Barème de points paramétrable (EF-CMP-01).
    pointsWin: integer("points_win").notNull().default(3),
    pointsDraw: integer("points_draw").notNull().default(1),
    pointsLoss: integer("points_loss").notNull().default(0),
    // Cartons jaunes entraînant une suspension automatique (M18).
    yellowCardThreshold: integer("yellow_card_threshold").notNull().default(3),
    // Critères de départage à égalité de points, dans l'ordre (règlement de la compétition).
    tiebreakers: text("tiebreakers")
      .array()
      .notNull()
      .default(sql`'{${sql.raw(DEFAULT_TIEBREAKERS.join(","))}}'::text[]`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("competitions_slug_uq").on(t.slug),
    index("competitions_season_idx").on(t.season),
    index("competitions_league_idx").on(t.leagueId),
    // Une seule édition d'un championnat par saison.
    uniqueIndex("competitions_championship_season_uq").on(t.championshipId, t.season),
  ],
);

export const competitionTeams = pgTable(
  "competition_teams",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    // Poule (tournoi) ; null pour un championnat à poule unique.
    pool: varchar("pool", { length: 8 }),
    // Pénalité de points (EF-CMP-02).
    pointsPenalty: integer("points_penalty").notNull().default(0),
    penaltyReason: text("penalty_reason"),
    // Ordre du tirage au sort (coupes).
    drawOrder: integer("draw_order"),
    // Statut sportif dans la saison (champion, promu, maintenu, relégué…), fixé par l'organisateur.
    outcome: teamOutcomeEnum("outcome"),
    registeredAt: timestamp("registered_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("competition_teams_uq").on(t.competitionId, t.clubId)],
);

export const scoreSourceEnum = pgEnum("score_source", SCORE_SOURCES);

export const matches = pgTable(
  "matches",
  {
    id: serial("id").primaryKey(),
    competitionId: integer("competition_id")
      .notNull()
      .references(() => competitions.id, { onDelete: "cascade" }),
    // Journée (championnat) ou tour (coupe).
    round: integer("round").notNull(),
    pool: varchar("pool", { length: 8 }),
    // Position dans le tableau d'une coupe.
    bracketSlot: integer("bracket_slot"),
    // Null tant que l'équipe n'est pas connue (tour suivant d'une coupe) ou exemptée.
    homeClubId: integer("home_club_id").references(() => clubs.id),
    awayClubId: integer("away_club_id").references(() => clubs.id),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }),
    venue: varchar("venue", { length: 160 }),
    status: matchStatusEnum("status").notNull().default("SCHEDULED"),
    // Score calculé à partir des buts saisis (EF-CMP-05, RG-07).
    homeScore: integer("home_score"),
    awayScore: integer("away_score"),
    homePenalties: integer("home_penalties"),
    awayPenalties: integer("away_penalties"),
    attendance: integer("attendance"),
    report: text("report"),
    // Résultat officiel : seul un résultat validé compte au classement et s'affiche comme définitif.
    validatedAt: timestamp("validated_at", { withTimezone: true }),
    // Provenance du statut et du score affichés : saisie officielle, ou source externe synchronisée.
    scoreSource: scoreSourceEnum("score_source").notNull().default("OFFICIAL"),
    externalSyncedAt: timestamp("external_synced_at", { withTimezone: true }),
    validatedBy: integer("validated_by").references(() => users.id),
    updatedBy: integer("updated_by").references(() => users.id),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("matches_competition_idx").on(t.competitionId, t.round),
    index("matches_kickoff_idx").on(t.kickoffAt),
    uniqueIndex("matches_bracket_uq").on(t.competitionId, t.round, t.bracketSlot),
  ],
);

export const matchEvents = pgTable(
  "match_events",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    type: matchEventTypeEnum("type").notNull(),
    minute: integer("minute").notNull(),
    // Club du joueur (un but contre son camp est crédité à l'adversaire).
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    playerId: integer("player_id").references(() => players.id),
    // Remplacement : `playerId` sort, `playerInId` entre.
    playerInId: integer("player_in_id").references(() => players.id),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("match_events_match_idx").on(t.matchId), index("match_events_player_idx").on(t.playerId)],
);

/** Compositions d'équipe saisies par les clubs avant le match (EF-CMP-07). */
export const matchLineups = pgTable(
  "match_lineups",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    clubId: integer("club_id")
      .notNull()
      .references(() => clubs.id),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    starter: boolean("starter").notNull(),
    shirtNumber: integer("shirt_number"),
  },
  (t) => [uniqueIndex("match_lineups_player_uq").on(t.matchId, t.playerId), index("match_lineups_club_idx").on(t.matchId, t.clubId)],
);

// ─── Arbitrage (M08) ─────────────────────────────────────────────────────────

export const refereeGradeEnum = pgEnum("referee_grade", REFEREE_GRADES);
export const officialRoleEnum = pgEnum("official_role", OFFICIAL_ROLES);

export const referees = pgTable(
  "referees",
  {
    id: serial("id").primaryKey(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    grade: refereeGradeEnum("grade").notNull(),
    // Rattachement : une ligue départementale, ou un championnat national (Ligue 1, Ligue 2), ou aucun (fédération).
    leagueId: integer("league_id").references(() => leagues.id),
    championshipId: integer("championship_id").references(() => championships.id),
    phone: varchar("phone", { length: 32 }),
    email: varchar("email", { length: 255 }),
    active: boolean("active").notNull().default(true),
    // Compte de l'espace personnel (EF-ARB-04).
    userId: integer("user_id").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("referees_user_uq").on(t.userId), index("referees_name_idx").on(t.lastName)],
);

export const matchOfficials = pgTable(
  "match_officials",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    refereeId: integer("referee_id")
      .notNull()
      .references(() => referees.id),
    role: officialRoleEnum("role").notNull(),
    // Jour du match (Brazzaville), recopié pour garantir en base « pas deux matchs le même jour » (RG-08).
    matchDay: date("match_day").notNull(),
    report: text("report"),
    reportAt: timestamp("report_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("match_officials_role_uq").on(t.matchId, t.role),
    uniqueIndex("match_officials_referee_match_uq").on(t.matchId, t.refereeId),
    uniqueIndex("match_officials_referee_day_uq").on(t.refereeId, t.matchDay),
  ],
);

// ─── Équipes nationales (M09) ────────────────────────────────────────────────

export const nationalTeamCodeEnum = pgEnum("national_team_code", NATIONAL_TEAM_CODES);
export const selectionStatusEnum = pgEnum("selection_status", SELECTION_STATUSES);
export const fixtureStatusEnum = pgEnum("national_fixture_status", FIXTURE_STATUSES);

export const nationalTeams = pgTable(
  "national_teams",
  {
    id: serial("id").primaryKey(),
    code: nationalTeamCodeEnum("code").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    slug: varchar("slug", { length: 40 }).notNull(),
  },
  (t) => [uniqueIndex("national_teams_code_uq").on(t.code), uniqueIndex("national_teams_slug_uq").on(t.slug)],
);

export const nationalStaff = pgTable(
  "national_staff",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => nationalTeams.id, { onDelete: "cascade" }),
    fullName: varchar("full_name", { length: 160 }).notNull(),
    role: varchar("role", { length: 80 }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("national_staff_team_idx").on(t.teamId)],
);

export const selections = pgTable(
  "selections",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => nationalTeams.id),
    title: varchar("title", { length: 160 }).notNull(),
    purpose: text("purpose"),
    gatheringDate: date("gathering_date", { mode: "date" }),
    location: varchar("location", { length: 160 }),
    status: selectionStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("selections_team_idx").on(t.teamId, t.status)],
);

export const selectionPlayers = pgTable(
  "selection_players",
  {
    id: serial("id").primaryKey(),
    selectionId: integer("selection_id")
      .notNull()
      .references(() => selections.id, { onDelete: "cascade" }),
    // Joueur du registre national… ou joueur évoluant à l'étranger (EF-SEL-02).
    playerId: integer("player_id").references(() => players.id),
    externalName: varchar("external_name", { length: 160 }),
    externalClub: varchar("external_club", { length: 160 }),
    externalCountry: varchar("external_country", { length: 80 }),
    position: positionEnum("position"),
    shirtNumber: integer("shirt_number"),
  },
  (t) => [
    uniqueIndex("selection_players_player_uq").on(t.selectionId, t.playerId),
    uniqueIndex("selection_players_shirt_uq").on(t.selectionId, t.shirtNumber),
  ],
);

export const nationalFixtures = pgTable(
  "national_fixtures",
  {
    id: serial("id").primaryKey(),
    teamId: integer("team_id")
      .notNull()
      .references(() => nationalTeams.id),
    opponent: varchar("opponent", { length: 120 }).notNull(),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    venue: varchar("venue", { length: 160 }),
    competition: varchar("competition", { length: 160 }),
    isHome: boolean("is_home").notNull().default(true),
    goalsFor: integer("goals_for"),
    goalsAgainst: integer("goals_against"),
    status: fixtureStatusEnum("status").notNull().default("SCHEDULED"),
  },
  (t) => [index("national_fixtures_team_idx").on(t.teamId, t.kickoffAt)],
);

// ─── Paiements Mobile Money (M16) ────────────────────────────────────────────

export const paymentMethodEnum = pgEnum("payment_method", PAYMENT_METHODS);
export const paymentStatusEnum = pgEnum("payment_status", PAYMENT_STATUSES);
export const paymentPurposeEnum = pgEnum("payment_purpose", PAYMENT_PURPOSES);

/** Encaissements (adhésions, billets, droits de licence) : une ligne par demande de paiement. */
export const payments = pgTable(
  "payments",
  {
    id: serial("id").primaryKey(),
    // Référence transmise à l'opérateur et affichée au payeur.
    reference: varchar("reference", { length: 32 }).notNull(),
    purpose: paymentPurposeEnum("purpose").notNull(),
    // Objet payé (adhésion, commande…), selon `purpose`.
    targetId: integer("target_id").notNull(),
    method: paymentMethodEnum("method").notNull(),
    phone: varchar("phone", { length: 16 }).notNull(),
    // Supporter payeur (paiement en ligne) ; null pour un encaissement au guichet.
    supporterId: integer("supporter_id"),
    // Compte de l'espace fédéral à l'origine du paiement (droits de licence payés par un club).
    userId: integer("user_id"),
    // Montant en FCFA, sans décimale (RG-17).
    amount: integer("amount").notNull(),
    status: paymentStatusEnum("status").notNull().default("PENDING"),
    providerRef: varchar("provider_ref", { length: 64 }),
    failureReason: text("failure_reason"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  },
  (t) => [
    uniqueIndex("payments_reference_uq").on(t.reference),
    index("payments_target_idx").on(t.purpose, t.targetId),
    index("payments_supporter_idx").on(t.supporterId),
  ],
);

// ─── Supporters : Fan ID et club des supporters (M11) ────────────────────────

export const fanIdSeq = pgSequence("fan_id_seq", { startWith: 1 });
export const idDocumentTypeEnum = pgEnum("id_document_type", ID_DOCUMENT_TYPES);
export const membershipTierEnum = pgEnum("membership_tier", MEMBERSHIP_TIERS);
export const membershipStatusEnum = pgEnum("membership_status", ["PENDING", "ACTIVE", "CANCELLED"]);

export const supporters = pgTable(
  "supporters",
  {
    id: serial("id").primaryKey(),
    fanId: varchar("fan_id", { length: 16 }).notNull(),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    birthDate: date("birth_date", { mode: "date" }).notNull(),
    // Téléphone Mobile Money au format +242…, identifiant de connexion (EF-SUP-01).
    phone: varchar("phone", { length: 16 }).notNull(),
    email: varchar("email", { length: 255 }),
    passwordHash: text("password_hash").notNull(),
    idDocumentType: idDocumentTypeEnum("id_document_type").notNull(),
    idDocumentNumber: varchar("id_document_number", { length: 40 }).notNull(),
    // Photo d'identité (exigée avant le premier achat en ligne) et pièce vérifiée au guichet (EF-SUP-08).
    photoKey: varchar("photo_key", { length: 120 }),
    photoType: varchar("photo_type", { length: 32 }),
    idVerifiedAt: timestamp("id_verified_at", { withTimezone: true }),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    // Interdiction de stade (EF-SUP-07, RG-14).
    banned: boolean("banned").notNull().default(false),
    banReason: text("ban_reason"),
    bannedAt: timestamp("banned_at", { withTimezone: true }),
    bannedBy: integer("banned_by").references(() => users.id),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    sessionVersion: integer("session_version").notNull().default(1),
    // Créé au guichet par un agent (EF-BIL-08) plutôt qu'en ligne.
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("supporters_fan_id_uq").on(t.fanId),
    uniqueIndex("supporters_phone_uq").on(t.phone),
    uniqueIndex("supporters_id_document_uq").on(t.idDocumentType, t.idDocumentNumber),
    index("supporters_name_idx").on(t.lastName, t.firstName),
  ],
);

/** Formules d'adhésion au club des supporters, par saison (prix fixés par la billetterie). */
export const membershipPlans = pgTable(
  "membership_plans",
  {
    id: serial("id").primaryKey(),
    season: integer("season").notNull(),
    tier: membershipTierEnum("tier").notNull(),
    price: integer("price").notNull(),
    open: boolean("open").notNull().default(true),
  },
  (t) => [uniqueIndex("membership_plans_uq").on(t.season, t.tier)],
);

export const memberships = pgTable(
  "memberships",
  {
    id: serial("id").primaryKey(),
    supporterId: integer("supporter_id")
      .notNull()
      .references(() => supporters.id),
    season: integer("season").notNull(),
    tier: membershipTierEnum("tier").notNull(),
    price: integer("price").notNull(),
    status: membershipStatusEnum("status").notNull().default("PENDING"),
    activatedAt: timestamp("activated_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Une seule adhésion active par saison.
    uniqueIndex("memberships_active_uq")
      .on(t.supporterId, t.season)
      .where(sql`${t.status} = 'ACTIVE'`),
    index("memberships_supporter_idx").on(t.supporterId),
  ],
);

/** Registre des points de fidélité (RG-15) : chaque point est tracé avec son motif. */
export const supporterPoints = pgTable(
  "supporter_points",
  {
    id: serial("id").primaryKey(),
    supporterId: integer("supporter_id")
      .notNull()
      .references(() => supporters.id),
    points: integer("points").notNull(),
    reason: varchar("reason", { length: 32 }).notNull(),
    // Objet à l'origine des points (adhésion, match fréquenté…) : pas de double attribution.
    refId: integer("ref_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("supporter_points_uq").on(t.supporterId, t.reason, t.refId)],
);

// ─── Billetterie (M10) et contrôle d'accès (M12) ─────────────────────────────

export const salesStatusEnum = pgEnum("sales_status", SALES_STATUSES);
export const eventKindEnum = pgEnum("ticket_event_kind", EVENT_KINDS);
export const orderChannelEnum = pgEnum("order_channel", ORDER_CHANNELS);
export const orderStatusEnum = pgEnum("order_status", ORDER_STATUSES);
export const ticketStatusEnum = pgEnum("ticket_status", TICKET_STATUSES);
export const ticketNumberSeq = pgSequence("ticket_number_seq", { startWith: 1 });

export const ticketEvents = pgTable(
  "ticket_events",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 180 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    kind: eventKindEnum("kind").notNull(),
    venue: varchar("venue", { length: 160 }).notNull(),
    kickoffAt: timestamp("kickoff_at", { withTimezone: true }).notNull(),
    salesStatus: salesStatusEnum("sales_status").notNull().default("DRAFT"),
    // Plafond par Fan ID (RG-10) et points de présence (RG-15), paramétrables par match.
    maxTicketsPerFan: integer("max_tickets_per_fan").notNull().default(4),
    attendancePoints: integer("attendance_points").notNull().default(1),
    // Débit d'entrées par porte au-delà duquel la porte est signalée saturée (EF-CTL-07).
    gateFlowLimit: integer("gate_flow_limit").notNull().default(30),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("ticket_events_slug_uq").on(t.slug), index("ticket_events_kickoff_idx").on(t.kickoffAt)],
);

/** Tribunes : prix public, prix membre, capacité, porte d'accès (EF-BIL-02). */
export const ticketCategories = pgTable(
  "ticket_categories",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => ticketEvents.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 80 }).notNull(),
    gate: varchar("gate", { length: 40 }).notNull(),
    capacity: integer("capacity").notNull(),
    publicPrice: integer("public_price").notNull(),
    memberPrice: integer("member_price").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
  },
  (t) => [index("ticket_categories_event_idx").on(t.eventId)],
);

export const ticketOrders = pgTable(
  "ticket_orders",
  {
    id: serial("id").primaryKey(),
    reference: varchar("reference", { length: 24 }).notNull(),
    eventId: integer("event_id")
      .notNull()
      .references(() => ticketEvents.id),
    // L'acheteur a toujours un Fan ID, y compris au guichet (EF-BIL-08).
    supporterId: integer("supporter_id")
      .notNull()
      .references(() => supporters.id),
    channel: orderChannelEnum("channel").notNull(),
    status: orderStatusEnum("status").notNull().default("PENDING"),
    total: integer("total").notNull(),
    // Réservation des places pendant le paiement (EF-BIL-06).
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    // Agent du guichet (EF-BIL-08, clôture de caisse EF-BIL-12).
    soldBy: integer("sold_by").references(() => users.id),
    paidAt: timestamp("paid_at", { withTimezone: true }),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundedBy: integer("refunded_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("ticket_orders_reference_uq").on(t.reference),
    index("ticket_orders_event_idx").on(t.eventId, t.status),
    index("ticket_orders_supporter_idx").on(t.supporterId, t.eventId),
  ],
);

export const tickets = pgTable(
  "tickets",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 16 }).notNull(),
    orderId: integer("order_id")
      .notNull()
      .references(() => ticketOrders.id),
    eventId: integer("event_id")
      .notNull()
      .references(() => ticketEvents.id),
    categoryId: integer("category_id")
      .notNull()
      .references(() => ticketCategories.id),
    // Billet nominatif (EF-BIL-04) : le 1er au nom de l'acheteur, les suivants à des porteurs nommés.
    holderName: varchar("holder_name", { length: 160 }).notNull(),
    holderSupporterId: integer("holder_supporter_id").references(() => supporters.id),
    price: integer("price").notNull(),
    // Jeton du QR code présenté à l'entrée.
    token: varchar("token", { length: 64 }).notNull(),
    status: ticketStatusEnum("status").notNull().default("RESERVED"),
    usedAt: timestamp("used_at", { withTimezone: true }),
    usedGate: varchar("used_gate", { length: 40 }),
    scannedBy: integer("scanned_by").references(() => users.id),
  },
  (t) => [
    uniqueIndex("tickets_number_uq").on(t.number),
    uniqueIndex("tickets_token_uq").on(t.token),
    index("tickets_category_status_idx").on(t.categoryId, t.status),
    index("tickets_event_status_idx").on(t.eventId, t.status),
    index("tickets_order_idx").on(t.orderId),
  ],
);

/** Contrôles refusés, tracés (EF-AUD-01 : « scans refusés »). */
export const scanRefusals = pgTable(
  "scan_refusals",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => ticketEvents.id, { onDelete: "cascade" }),
    reason: varchar("reason", { length: 24 }).notNull(),
    ticketId: integer("ticket_id"),
    gate: varchar("gate", { length: 40 }),
    scannedBy: integer("scanned_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scan_refusals_event_idx").on(t.eventId)],
);

// ─── Accréditations médias (M13) ─────────────────────────────────────────────

export const accreditationNumberSeq = pgSequence("accreditation_number_seq", { startWith: 1 });
export const pressRoleEnum = pgEnum("press_role", PRESS_ROLES);
export const pressZoneEnum = pgEnum("press_zone", PRESS_ZONES);
export const accreditationStatusEnum = pgEnum("accreditation_status", ACCREDITATION_STATUSES);

export const accreditations = pgTable(
  "accreditations",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 16 }).notNull(),
    // Le match (événement du stade) concerné : un badge n'est valable que pour lui (RG-16).
    eventId: integer("event_id")
      .notNull()
      .references(() => ticketEvents.id),
    lastName: varchar("last_name", { length: 80 }).notNull(),
    firstName: varchar("first_name", { length: 80 }).notNull(),
    phone: varchar("phone", { length: 16 }).notNull(),
    email: varchar("email", { length: 255 }),
    outlet: varchar("outlet", { length: 160 }).notNull(),
    role: pressRoleEnum("role").notNull(),
    pressCardNumber: varchar("press_card_number", { length: 40 }).notNull(),
    requestedZones: pressZoneEnum("requested_zones").array().notNull(),
    grantedZones: pressZoneEnum("granted_zones").array(),
    status: accreditationStatusEnum("status").notNull().default("PENDING"),
    decisionReason: text("decision_reason"),
    decidedBy: integer("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    // Lien de suivi remis au demandeur (empreinte seule) et jeton du QR code du badge.
    trackingHash: varchar("tracking_hash", { length: 64 }).notNull(),
    badgeToken: varchar("badge_token", { length: 64 }).notNull(),
    entries: integer("entries").notNull().default(0),
    lastEntryAt: timestamp("last_entry_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("accreditations_number_uq").on(t.number),
    // Une demande par téléphone et par match (EF-MED-02).
    uniqueIndex("accreditations_event_phone_uq").on(t.eventId, t.phone),
    uniqueIndex("accreditations_tracking_uq").on(t.trackingHash),
    uniqueIndex("accreditations_badge_uq").on(t.badgeToken),
    index("accreditations_event_status_idx").on(t.eventId, t.status),
  ],
);

/** Quotas par zone et par match (EF-MED-05). */
export const accreditationQuotas = pgTable(
  "accreditation_quotas",
  {
    id: serial("id").primaryKey(),
    eventId: integer("event_id")
      .notNull()
      .references(() => ticketEvents.id, { onDelete: "cascade" }),
    zone: pressZoneEnum("zone").notNull(),
    quota: integer("quota").notNull(),
  },
  (t) => [uniqueIndex("accreditation_quotas_uq").on(t.eventId, t.zone)],
);

// ─── Actualités et communiqués (M14) ─────────────────────────────────────────

export const articleCategoryEnum = pgEnum("article_category", ARTICLE_CATEGORIES);
export const articleStatusEnum = pgEnum("article_status", ["DRAFT", "PUBLISHED"]);

export const articles = pgTable(
  "articles",
  {
    id: serial("id").primaryKey(),
    slug: varchar("slug", { length: 200 }).notNull(),
    title: varchar("title", { length: 200 }).notNull(),
    // Chapô : résumé affiché dans les listes et pour le partage sur les réseaux sociaux.
    summary: varchar("summary", { length: 400 }).notNull(),
    // Texte enrichi simple (lib/articles.ts).
    body: text("body").notNull(),
    category: articleCategoryEnum("category").notNull(),
    status: articleStatusEnum("status").notNull().default("DRAFT"),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    // Visuel de couverture (stockage des fichiers), servi publiquement une fois l'article publié.
    coverKey: varchar("cover_key", { length: 200 }),
    coverType: varchar("cover_type", { length: 32 }),
    authorId: integer("author_id").references(() => users.id),
    // Article repris de l'ancien site fecofoot.cg : adresse d'origine, pour ne jamais l'importer deux fois.
    sourceUrl: varchar("source_url", { length: 500 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("articles_slug_uq").on(t.slug),
    uniqueIndex("articles_source_uq").on(t.sourceUrl),
    index("articles_published_idx").on(t.status, t.publishedAt),
  ],
);

// ─── Discipline (M18) ────────────────────────────────────────────────────────

export const disciplineCaseSeq = pgSequence("discipline_case_seq", { startWith: 1 });
export const caseStatusEnum = pgEnum("discipline_case_status", CASE_STATUSES);
export const sanctionTypeEnum = pgEnum("sanction_type", SANCTION_TYPES);

/** Dossiers de la commission de discipline : faits, décision, sanction, publication (EF-DIS-01). */
export const disciplineCases = pgTable(
  "discipline_cases",
  {
    id: serial("id").primaryKey(),
    number: varchar("number", { length: 20 }).notNull(),
    competitionId: integer("competition_id").references(() => competitions.id),
    matchId: integer("match_id").references(() => matches.id),
    playerId: integer("player_id").references(() => players.id),
    clubId: integer("club_id").references(() => clubs.id),
    facts: text("facts").notNull(),
    hearingAt: timestamp("hearing_at", { withTimezone: true }),
    status: caseStatusEnum("status").notNull().default("OPEN"),
    decision: text("decision"),
    sanctionType: sanctionTypeEnum("sanction_type"),
    suspensionMatches: integer("suspension_matches"),
    suspensionUntil: date("suspension_until", { mode: "date" }),
    // Montant en FCFA (RG-17).
    fineAmount: integer("fine_amount"),
    pointsDeducted: integer("points_deducted"),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decidedBy: integer("decided_by").references(() => users.id),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("discipline_cases_number_uq").on(t.number),
    index("discipline_cases_player_idx").on(t.playerId),
    index("discipline_cases_status_idx").on(t.status),
  ],
);

export type User = typeof users.$inferSelect;
export type League = typeof leagues.$inferSelect;
export type Club = typeof clubs.$inferSelect;
export type Player = typeof players.$inferSelect;
export type License = typeof licenses.$inferSelect;
export type PlayerConsent = typeof playerConsents.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type Transfer = typeof transfers.$inferSelect;
export type Competition = typeof competitions.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Referee = typeof referees.$inferSelect;
export type Supporter = typeof supporters.$inferSelect;
export type Payment = typeof payments.$inferSelect;

// ─── Photothèque (M14) ───────────────────────────────────────────────────────

/** Photos officielles (sélections, matchs, entraînements) affichées sur le portail. */
export const photos = pgTable(
  "photos",
  {
    id: serial("id").primaryKey(),
    // Sélection nationale concernée ; null pour une photo générale.
    teamId: integer("team_id").references(() => nationalTeams.id),
    caption: varchar("caption", { length: 200 }).notNull().default(""),
    credit: varchar("credit", { length: 120 }).notNull().default("Équipe nationale du Congo"),
    storageKey: varchar("storage_key", { length: 200 }).notNull(),
    mimeType: varchar("mime_type", { length: 32 }).notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    published: boolean("published").notNull().default(true),
    // Mise en avant dans le bandeau de la page d'accueil (la plus récente l'emporte).
    featured: boolean("featured").notNull().default(false),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("photos_team_idx").on(t.teamId, t.published), index("photos_featured_idx").on(t.featured, t.published)],
);

// ─── Biométrie (architecture, inactive sans prestataire) ─────────────────────

export const biometricResultEnum = pgEnum("biometric_result", BIOMETRIC_CHECK_RESULTS);

/**
 * Enrôlement biométrique d'un joueur auprès d'un prestataire. Seule une référence opaque est conservée
 * (identifiant du gabarit chez le prestataire) : aucune empreinte ni donnée biométrique brute ici.
 */
export const biometricEnrollments = pgTable(
  "biometric_enrollments",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerRef: varchar("provider_ref", { length: 120 }).notNull(),
    consentAt: timestamp("consent_at", { withTimezone: true }).notNull(),
    enrolledBy: integer("enrolled_by").references(() => users.id),
    enrolledAt: timestamp("enrolled_at", { withTimezone: true }).notNull().defaultNow(),
    // Retrait (consentement retiré, fin de conservation) : la référence est révoquée chez le prestataire.
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
  },
  (t) => [index("biometric_enrollments_player_idx").on(t.playerId)],
);

/** Résultat d'une vérification biométrique (correspondance ou non), tel que renvoyé par le prestataire. */
export const biometricChecks = pgTable(
  "biometric_checks",
  {
    id: serial("id").primaryKey(),
    playerId: integer("player_id")
      .notNull()
      .references(() => players.id),
    licenseId: integer("license_id").references(() => licenses.id),
    provider: varchar("provider", { length: 40 }).notNull(),
    providerRef: varchar("provider_ref", { length: 120 }),
    result: biometricResultEnum("result").notNull(),
    context: varchar("context", { length: 60 }).notNull(),
    checkedBy: integer("checked_by").references(() => users.id),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("biometric_checks_player_idx").on(t.playerId)],
);

// ─── Sources sportives externes (scores, calendriers) ────────────────────────

export const externalProviderEnum = pgEnum("external_provider", EXTERNAL_PROVIDERS);
export const linkEntityEnum = pgEnum("external_link_entity", LINK_ENTITIES);

/**
 * Correspondance entre une fiche de la plateforme et son identifiant chez un fournisseur :
 * compétition (ligue + saison du fournisseur), club (équipe), match (rencontre).
 */
export const externalLinks = pgTable(
  "external_links",
  {
    id: serial("id").primaryKey(),
    provider: externalProviderEnum("provider").notNull(),
    entity: linkEntityEnum("entity").notNull(),
    entityId: integer("entity_id").notNull(),
    externalId: varchar("external_id", { length: 64 }).notNull(),
    // Compétition : saison du fournisseur (année de début) ; 0 pour un club ou un match (unicité sans valeur nulle).
    externalSeason: integer("external_season").notNull().default(0),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("external_links_external_uq").on(t.provider, t.entity, t.externalId, t.externalSeason),
    uniqueIndex("external_links_entity_uq").on(t.provider, t.entity, t.entityId),
  ],
);

/** Une exécution de synchronisation : compteurs et erreurs (consultables dans l'espace fédéral). */
export const externalSyncRuns = pgTable(
  "external_sync_runs",
  {
    id: serial("id").primaryKey(),
    provider: externalProviderEnum("provider").notNull(),
    competitionId: integer("competition_id").references(() => competitions.id),
    trigger: varchar("trigger", { length: 20 }).notNull(),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
    created: integer("created").notNull().default(0),
    updated: integer("updated").notNull().default(0),
    conflicts: integer("conflicts").notNull().default(0),
    skipped: integer("skipped").notNull().default(0),
    error: text("error"),
    notes: jsonb("notes"),
  },
  (t) => [index("external_sync_runs_started_idx").on(t.startedAt)],
);

/** Écart entre la donnée officielle et la source externe : jamais appliqué automatiquement, examiné par un responsable. */
export const externalConflicts = pgTable(
  "external_conflicts",
  {
    id: serial("id").primaryKey(),
    matchId: integer("match_id")
      .notNull()
      .references(() => matches.id, { onDelete: "cascade" }),
    provider: externalProviderEnum("provider").notNull(),
    officialValue: jsonb("official_value").notNull(),
    externalValue: jsonb("external_value").notNull(),
    reason: text("reason").notNull(),
    detectedAt: timestamp("detected_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    resolvedBy: integer("resolved_by").references(() => users.id),
    resolution: varchar("resolution", { length: 20 }),
  },
  (t) => [index("external_conflicts_open_idx").on(t.resolvedAt, t.matchId)],
);

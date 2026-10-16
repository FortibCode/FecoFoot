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
import { COMPETITION_STATUSES, COMPETITION_TYPES, EVENT_TYPES, GENDERS, MATCH_STATUSES } from "../competitions";
import { OFFICIAL_ROLES, REFEREE_GRADES } from "../referees";
import { FIXTURE_STATUSES, NATIONAL_TEAM_CODES, SELECTION_STATUSES } from "../national-teams";
import { CATEGORIES, CONSENT_STATUSES, LICENSE_STATUSES, LICENSE_TYPES, POSITIONS } from "../licenses";

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
    president: varchar("president", { length: 160 }),
    email: varchar("email", { length: 255 }),
    phone: varchar("phone", { length: 32 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
    leagueId: integer("league_id")
      .notNull()
      .references(() => leagues.id),
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
    // Contrôle anti-doublon (EF-LIC-02) : nom + prénom normalisés + date de naissance.
    identityKey: varchar("identity_key", { length: 200 }).notNull(),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("players_federal_id_uq").on(t.federalId),
    uniqueIndex("players_identity_uq").on(t.identityKey),
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

export const competitions = pgTable(
  "competitions",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 160 }).notNull(),
    slug: varchar("slug", { length: 180 }).notNull(),
    season: integer("season").notNull(),
    category: categoryEnum("category").notNull(),
    gender: competitionGenderEnum("gender").notNull().default("M"),
    type: competitionTypeEnum("type").notNull(),
    status: competitionStatusEnum("status").notNull().default("DRAFT"),
    // Championnat : aller-retour ou aller simple (EF-CMP-03).
    doubleRound: boolean("double_round").notNull().default(true),
    // Barème de points paramétrable (EF-CMP-01).
    pointsWin: integer("points_win").notNull().default(3),
    pointsDraw: integer("points_draw").notNull().default(1),
    pointsLoss: integer("points_loss").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("competitions_slug_uq").on(t.slug), index("competitions_season_idx").on(t.season)],
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
  },
  (t) => [uniqueIndex("competition_teams_uq").on(t.competitionId, t.clubId)],
);

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
    leagueId: integer("league_id").references(() => leagues.id),
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

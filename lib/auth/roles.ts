/**
 * Profils d'accès et matrice des droits — cahier des charges §3.1 et §3.3.
 * Ce fichier est pur (aucune dépendance serveur) : il est partagé par le schéma,
 * les contrôles serveur et l'interface.
 */

export const ROLES = [
  "SUPER_ADMIN",
  "FEDERATION_ADMIN",
  "LEAGUE",
  "CLUB",
  "DTN",
  "COMMUNICATION",
  "TICKETING",
  "REFEREEING",
  // Arbitres et commissaires : espace personnel (EF-ARB-04), feuille de match au stade (EF-CMP-09).
  "REFEREE",
  // Commission de discipline (M18).
  "DISCIPLINE",
] as const;

export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  SUPER_ADMIN: "Super administrateur",
  FEDERATION_ADMIN: "Administration fédérale",
  LEAGUE: "Ligue départementale",
  CLUB: "Secrétariat de club",
  DTN: "Direction technique nationale",
  COMMUNICATION: "Communication",
  TICKETING: "Billetterie & accès stade",
  REFEREEING: "Direction de l'arbitrage",
  REFEREE: "Arbitre / commissaire",
  DISCIPLINE: "Commission de discipline",
};

export const PERMISSIONS = [
  "dashboard.view",
  "leagues.manage",
  "clubs.manage",
  "clubs.affiliate",
  "clubs.read",
  "players.manage",
  "players.read",
  "licenses.validate",
  "licenses.request",
  "transfers.approve",
  "transfers.review",
  "transfers.release",
  "competitions.manage",
  "national_teams.manage",
  "communication.manage",
  "ticketing.manage",
  "refereeing.manage",
  "referee.self",
  "lineups.submit",
  "discipline.manage",
  "users.manage",
  "audit.read",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const ADMIN_COMMON: Permission[] = [
  "dashboard.view",
  "leagues.manage",
  "clubs.manage",
  "clubs.affiliate",
  "clubs.read",
  "players.manage",
  "players.read",
  "licenses.validate",
  "transfers.approve",
  "transfers.review",
  "competitions.manage",
  "national_teams.manage",
  "communication.manage",
  "ticketing.manage",
  "refereeing.manage",
  "discipline.manage",
  "audit.read",
];

const MATRIX: Record<Role, readonly Permission[]> = {
  SUPER_ADMIN: [...ADMIN_COMMON, "users.manage"],
  FEDERATION_ADMIN: ADMIN_COMMON,
  LEAGUE: [
    "dashboard.view",
    "clubs.manage",
    "clubs.read",
    "players.manage",
    "players.read",
    "licenses.validate",
    "transfers.review",
  ],
  // transfers.release : accord de sortie du club quitté (EF-TRF-05) ; lineups.submit : compositions d'équipe (EF-CMP-07).
  CLUB: ["dashboard.view", "clubs.read", "players.manage", "players.read", "licenses.request", "transfers.release", "lineups.submit"],
  DTN: ["dashboard.view", "players.read", "national_teams.manage"],
  COMMUNICATION: ["dashboard.view", "communication.manage"],
  TICKETING: ["dashboard.view", "ticketing.manage"],
  REFEREEING: ["dashboard.view", "refereeing.manage"],
  REFEREE: ["dashboard.view", "referee.self"],
  DISCIPLINE: ["dashboard.view", "discipline.manage"],
};

export function can(role: Role, permission: Permission): boolean {
  return MATRIX[role].includes(permission);
}

export function permissionsOf(role: Role): readonly Permission[] {
  return MATRIX[role];
}

/** Utilisateur réduit aux champs nécessaires au contrôle de périmètre. */
export type ScopedUser = { role: Role; leagueId: number | null; clubId: number | null };

/**
 * Périmètre de données (EF-CLB-04) : une ligue ne voit que les clubs de son
 * territoire, un club ne voit que sa propre fiche. Les autres profils
 * autorisés sur le module voient tout.
 */
export function canAccessClub(user: ScopedUser, club: { id: number; leagueId: number }): boolean {
  if (user.role === "LEAGUE") return user.leagueId !== null && user.leagueId === club.leagueId;
  if (user.role === "CLUB") return user.clubId !== null && user.clubId === club.id;
  return can(user.role, "clubs.read");
}

/** Profils créés par un module dédié, pas par la gestion des comptes (l'accès arbitre naît de sa fiche). */
export const ROLES_MANAGED_ELSEWHERE: Role[] = ["REFEREE"];

/** Vérifie la cohérence rôle ↔ périmètre à la création d'un compte. */
export function scopeError(user: ScopedUser): string | null {
  if (user.role === "LEAGUE" && user.leagueId === null) return "Un compte de ligue doit être rattaché à une ligue.";
  if (user.role === "CLUB" && user.clubId === null) return "Un compte de club doit être rattaché à un club.";
  if (user.role !== "LEAGUE" && user.leagueId !== null) return "Seul un compte de ligue peut être rattaché à une ligue.";
  if (user.role !== "CLUB" && user.clubId !== null) return "Seul un compte de club peut être rattaché à un club.";
  return null;
}

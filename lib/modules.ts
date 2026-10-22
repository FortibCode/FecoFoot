import { can, type Permission, type Role } from "@/lib/auth/roles";

/**
 * Modules de l'espace fédéral (cahier des charges §2.1).
 * `ready` passe à true quand la page du module est livrée.
 */
export type AdminModule = {
  code: string;
  label: string;
  href: string;
  /** Visible si l'utilisateur a au moins un de ces droits. */
  anyOf: Permission[];
  group: string;
  /** Sous-section dans le menu déroulant du groupe (Gestion sportive). */
  section?: string;
  ready: boolean;
  /** Profils exclus malgré le droit (ex. une ligue ne gère pas les championnats nationaux). */
  exceptRoles?: Role[];
};

export const ADMIN_MODULES: AdminModule[] = [
  { code: "M00", label: "Tableau de bord", href: "/admin", anyOf: ["dashboard.view"], group: "Tableau de bord", ready: true },
  // Gestion sportive : organisation, licences, compétitions, arbitrage (sous-sections du menu).
  { code: "M03", label: "Ligues", href: "/admin/ligues", anyOf: ["leagues.manage", "leagues.own"], group: "Gestion sportive", section: "Organisation", ready: true },
  { code: "M03", label: "Clubs", href: "/admin/clubs", anyOf: ["clubs.read"], group: "Gestion sportive", section: "Organisation", ready: true },
  { code: "M04", label: "Joueurs", href: "/admin/joueurs", anyOf: ["players.read"], group: "Gestion sportive", section: "Licences", ready: true },
  { code: "M04", label: "Licences des joueurs", href: "/admin/licences", anyOf: ["licenses.validate", "licenses.request"], group: "Gestion sportive", section: "Licences", ready: true },
  { code: "M06", label: "Transferts", href: "/admin/transferts", anyOf: ["transfers.approve", "transfers.review", "transfers.release"], group: "Gestion sportive", section: "Licences", ready: true },
  { code: "M04", label: "Mon espace joueur", href: "/admin/espace-joueur", anyOf: ["player.self"], group: "Gestion sportive", section: "Licences", ready: true },
  { code: "M07", label: "Championnats nationaux", href: "/admin/championnats", anyOf: ["competitions.manage"], group: "Gestion sportive", section: "Compétitions", ready: true, exceptRoles: ["LEAGUE"] },
  { code: "M07", label: "Compétitions", href: "/admin/competitions", anyOf: ["competitions.manage"], group: "Gestion sportive", section: "Compétitions", ready: true },
  { code: "M07", label: "Matchs", href: "/admin/matchs", anyOf: ["competitions.manage", "refereeing.manage", "lineups.submit", "referee.self"], group: "Gestion sportive", section: "Compétitions", ready: true },
  { code: "M09", label: "Équipes nationales", href: "/admin/selections", anyOf: ["national_teams.manage"], group: "Gestion sportive", section: "Compétitions", ready: true },
  { code: "M08", label: "Arbitres & désignations", href: "/admin/arbitres", anyOf: ["refereeing.manage"], group: "Gestion sportive", section: "Arbitrage", ready: true },
  { code: "M08", label: "Mon espace arbitre", href: "/admin/espace-arbitre", anyOf: ["referee.self"], group: "Gestion sportive", section: "Arbitrage", ready: true },
  { code: "M18", label: "Discipline", href: "/admin/discipline", anyOf: ["discipline.manage"], group: "Gestion sportive", section: "Arbitrage", ready: true },
  { code: "M14", label: "Actualités", href: "/admin/actualites", anyOf: ["communication.manage"], group: "Communication", ready: true },
  { code: "M14", label: "Photothèque", href: "/admin/photos", anyOf: ["communication.manage"], group: "Communication", ready: true },
  { code: "M13", label: "Accréditations médias", href: "/admin/accreditations", anyOf: ["communication.manage"], group: "Communication", ready: true },
  { code: "M10", label: "Billetterie", href: "/admin/billetterie", anyOf: ["ticketing.manage"], group: "Services et finances", ready: true },
  { code: "M11", label: "Supporters (Fan ID)", href: "/admin/supporters", anyOf: ["ticketing.manage"], group: "Services et finances", ready: true },
  { code: "M16", label: "Paiements", href: "/admin/paiements", anyOf: ["payments.manage"], group: "Services et finances", ready: true },
  { code: "M02", label: "Utilisateurs", href: "/admin/utilisateurs", anyOf: ["users.manage"], group: "Administration système", ready: true },
  { code: "M17", label: "Notifications", href: "/admin/notifications", anyOf: ["users.manage"], group: "Administration système", ready: true },
  {
    code: "M19",
    label: "Exports et états",
    href: "/admin/exports",
    anyOf: ["licenses.validate", "licenses.request", "competitions.manage", "national_teams.manage", "payments.manage", "audit.read"],
    group: "Administration système",
    ready: true,
  },
  { code: "M15", label: "Journal d'audit", href: "/admin/journal", anyOf: ["audit.read"], group: "Administration système", ready: true },
];

export function modulesFor(role: Role): AdminModule[] {
  return ADMIN_MODULES.filter((m) => !m.exceptRoles?.includes(role) && m.anyOf.some((p) => can(role, p)));
}

import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BrandLogo } from "@/components/brand-logo";
import { MonthLine } from "@/components/admin/month-line";
import { ClubLogo } from "@/components/public/club-logo";
import { requirePermission } from "@/lib/auth/guard";
import { can, ROLE_LABELS, type Permission } from "@/lib/auth/roles";
import { formatFcfa } from "@/lib/format";
import { seasonLabel } from "@/lib/licenses";
import { modulesFor } from "@/lib/modules";
import { MODULE_ICONS } from "@/lib/module-icons";
import { featuredPhotos, latestPhotos, photoUrl } from "@/lib/photos";
import { dashboardStats } from "@/lib/queries/dashboard";
import "./dashboard.css";

export const metadata: Metadata = { title: "Tableau de bord — FECOFOOT" };

/* ── Formats ─────────────────────────────────────────────── */
const nf = new Intl.NumberFormat("fr-FR");
const TZ = "Africa/Brazzaville";
const dayFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const shortFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  day: "2-digit",
  month: "short",
});
const timeFmt = new Intl.DateTimeFormat("fr-FR", {
  timeZone: TZ,
  hour: "2-digit",
  minute: "2-digit",
});
const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);

/** « il y a 5 min », « il y a 3 h », sinon la date. */
function ago(d: Date, now: Date) {
  const min = Math.round((now.getTime() - d.getTime()) / 60000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  if (min < 24 * 60) return `il y a ${Math.round(min / 60)} h`;
  return shortFmt.format(d);
}

/* ── Icônes ──────────────────────────────────────────────── */
const D = {
  joueurs:
    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  licences: "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z",
  clubs:
    "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  fans: "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z",
  transferts: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  calendar:
    "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  trophy:
    "M8 21h8m-4-4v4M7 4h10v5a5 5 0 01-10 0V4zM7 6H4a3 3 0 003 3m10-3h3a3 3 0 01-3 3",
  arrow: "M9 18l6-6-6-6",
  press:
    "M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0",
  disc: "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  pay: "M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z",
  check: "M5 13l4 4L19 7",
  plus: "M12 5v14M5 12h14",
  activity: "M22 12h-4l-3 9L9 3l-3 9H2",
  grid: "M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z",
};

function Icon({ d, size = 18 }: { d: string; size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden
    >
      {d.split(/(?=M)/).map((seg, i) => (
        <path key={i} d={seg} />
      ))}
    </svg>
  );
}

/** Carte de contenu du tableau de bord : titre, action, corps. */
function Panel({
  title,
  tone = "green",
  href,
  action,
  children,
  className = "",
}: {
  title: string;
  tone?: "green" | "yellow" | "red" | "ink";
  href?: string;
  action?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`db-panel ${className}`} aria-label={title}>
      <header className="db-panel-head">
        <h2 className="db-panel-title">
          <span className={`db-dot db-dot-${tone}`} aria-hidden />
          {title}
        </h2>
        {href && (
          <Link href={href} className="db-panel-link">
            {action ?? "Tout voir"} <Icon d={D.arrow} size={13} />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="db-empty">
      <span className="db-empty-icon">
        <Icon d={icon} size={22} />
      </span>
      {text}
    </div>
  );
}

/** Libellés lisibles des actions du journal. */
const ACTION_LABELS: Record<string, string> = {
  LOGIN: "Connexion",
  LOGIN_FAILED: "Échec de connexion",
  LOGOUT: "Déconnexion",
  CREATE: "Création",
  UPDATE: "Modification",
  DELETE: "Suppression",
  PUBLISH: "Publication",
  UPLOAD: "Pièce ajoutée",
  NEWS_SYNC: "Synchronisation des actualités",
  AUDIT_EXPORTED: "Export du journal",
  PAYMENTS_EXPORTED: "Export des paiements",
  LICENSE_VALIDATE: "Licence validée",
  LICENSE_PAY: "Droits encaissés",
  LICENSE_REJECT: "Licence rejetée",
};
const ENTITY_LABELS: Record<string, string> = {
  user: "compte",
  club: "club",
  player: "joueur",
  license: "licence",
  transfer: "transfert",
  article: "actualité",
  photo: "photo",
  competition: "compétition",
  match: "match",
  payment: "paiement",
  supporter: "supporter",
  ticket_event: "billetterie",
  ticket_order: "commande",
  document: "pièce",
  selection: "sélection",
  accreditation: "accréditation",
};
const actionLabel = (a: string, e: string) =>
  `${ACTION_LABELS[a] ?? a.replaceAll("_", " ").toLowerCase()}${ENTITY_LABELS[e] && !ACTION_LABELS[a]?.includes(ENTITY_LABELS[e]) ? ` · ${ENTITY_LABELS[e]}` : ""}`;

/* ═══════════════════════════════════════════════════════════ */
export default async function AdminDashboard() {
  const user = await requirePermission("dashboard.view");
  const [s, featured] = await Promise.all([dashboardStats(), featuredPhotos()]);
  const heroPhoto = featured[0] ?? (await latestPhotos(1))[0] ?? null;
  const now = new Date();
  const may = (p: Permission) => can(user.role, p);

  const hour = Number(
    new Intl.DateTimeFormat("fr-FR", {
      timeZone: TZ,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  const greeting =
    hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const firstName = user.fullName.split(" ")[0];
  const totalLicences = s.totalLicencesValidees + s.licencesEnAttente;
  const rate = pct(s.totalLicencesValidees, totalLicences);

  /* Actions rapides du bandeau, selon les droits. */
  const quick = [
    may("players.manage") && {
      href: "/admin/joueurs/nouveau",
      label: "Nouveau joueur",
    },
    may("clubs.manage") && {
      href: "/admin/clubs/nouveau",
      label: "Nouveau club",
    },
    may("communication.manage") && {
      href: "/admin/actualites/nouveau",
      label: "Nouvel article",
    },
    may("transfers.release") && {
      href: "/admin/transferts/nouveau",
      label: "Nouveau transfert",
    },
  ].filter(Boolean) as { href: string; label: string }[];

  /* Dossiers à traiter, selon les droits. */
  const todo = [
    may("clubs.affiliate") && {
      href: "/admin/clubs?status=PENDING",
      label: "Affiliations de clubs à instruire",
      n: s.clubsEnAttente,
      icon: D.clubs,
    },
    (may("licenses.validate") || may("licenses.request")) && {
      href: "/admin/licences",
      label: "Licences en attente",
      n: s.licencesEnAttente,
      icon: D.licences,
    },
    (may("transfers.review") ||
      may("transfers.approve") ||
      may("transfers.release")) && {
      href: "/admin/transferts",
      label: "Transferts à instruire",
      n: s.transfertsEnCours,
      icon: D.transferts,
    },
    may("communication.manage") && {
      href: "/admin/accreditations",
      label: "Accréditations à examiner",
      n: s.accreditationsEnAttente,
      icon: D.press,
    },
    may("discipline.manage") && {
      href: "/admin/discipline",
      label: "Dossiers disciplinaires ouverts",
      n: s.dossiersDiscipline,
      icon: D.disc,
    },
    may("competitions.manage") && {
      href: "/admin/matchs?etat=a-valider",
      label: "Résultats à valider",
      n: s.resultatsAValider,
      icon: D.licences,
    },
    may("refereeing.manage") && {
      href: "/admin/matchs?etat=sans-arbitre",
      label: "Matchs sans arbitre (14 j)",
      n: s.matchsSansArbitre,
      icon: D.disc,
    },
    may("payments.manage") && {
      href: "/admin/paiements?etat=PENDING",
      label: "Paiements en attente",
      n: s.paiementsEnAttente,
      icon: D.pay,
    },
  ].filter(Boolean) as {
    href: string;
    label: string;
    n: number;
    icon: string;
  }[];

  const kpis = [
    {
      tone: "green",
      icon: D.joueurs,
      value: s.totalJoueurs,
      label: "Joueurs enregistrés",
      progress: { value: pct(s.totalLicencesValidees, s.totalJoueurs), label: "licenciés cette saison" },
      delta: s.joueursCeMois,
      deltaLabel: "sur 30 jours",
      href: may("players.read") ? "/admin/joueurs" : undefined,
    },
    {
      tone: "yellow",
      icon: D.licences,
      value: s.totalLicencesValidees,
      label: `Licences validées ${seasonLabel(s.season)}`,
      progress: { value: rate, label: "des demandes validées" },
      delta: s.licences30j,
      deltaLabel: "sur 30 jours",
      href:
        may("licenses.validate") || may("licenses.request")
          ? "/admin/licences"
          : undefined,
    },
    {
      tone: "red",
      icon: D.clubs,
      value: s.totalClubs,
      label: "Clubs affiliés",
      progress: { value: pct(s.totalClubs, s.clubsTotal), label: "des clubs enregistrés" },
      sub: `${s.competitionsActives} compétition(s) en cours`,
      href: may("clubs.read") ? "/admin/clubs" : undefined,
    },
    may("payments.manage")
      ? {
          tone: "ink",
          icon: D.pay,
          value: s.encaisse30j,
          money: true,
          label: "Encaissé sur 30 jours",
          progress: {
            value: pct(s.paiementsReussis, s.paiementsReussis + s.paiementsEchoues),
            label: "des paiements aboutis",
          },
          sub: may("ticketing.manage")
            ? `${nf.format(s.billetsVendus30j)} billet(s) vendu(s) sur 30 jours`
            : `${nf.format(s.totalSupporters)} supporters Fan ID`,
          href: "/admin/paiements",
        }
      : {
          tone: "ink",
          icon: D.fans,
          value: s.totalSupporters,
          label: "Supporters Fan ID",
          delta: s.supporters30j,
          deltaLabel: "sur 30 jours",
          href: may("ticketing.manage") ? "/admin/supporters" : undefined,
        },
  ] as {
    tone: string;
    icon: string;
    value: number;
    money?: boolean;
    label: string;
    progress?: { value: number; label: string };
    delta?: number;
    deltaLabel?: string;
    sub?: string;
    href?: string;
  }[];

  const shortcuts = modulesFor(user.role).filter(
    (m) => m.ready && m.href !== "/admin",
  );

  return (
    <div className="db db-layout">
      <div className="db-col">
        {/* ══ Bandeau ═══════════════════════════════════════════ */}
        <section className="db-hero" aria-label="Bienvenue">
          {heroPhoto && (
            // eslint-disable-next-line @next/next/no-img-element -- image servie par la route des médias
            <img
              src={photoUrl(heroPhoto)}
              alt=""
              aria-hidden
              className="db-hero-photo"
            />
          )}
          <BrandLogo size={150} decorative className="db-hero-crest" />
          <div className="db-hero-body">
            <p className="db-hero-date">{dayFmt.format(now)}</p>
            <h1 className="db-hero-title">
              {greeting}, <span>{firstName}</span>
            </h1>
            <p className="db-hero-meta">
              {ROLE_LABELS[user.role]} <span aria-hidden>·</span> Saison{" "}
              {seasonLabel(s.season)}
            </p>
            {quick.length > 0 && (
              <div className="db-hero-actions">
                {quick.map((q, i) => (
                  <Link
                    key={q.href}
                    href={q.href}
                    className={
                      i === 0 ? "db-btn db-btn-yellow" : "db-btn db-btn-ghost"
                    }
                  >
                    <Icon d={D.plus} size={15} />
                    {q.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="db-hero-flag" aria-hidden />
        </section>

        {/* ══ Indicateurs ═══════════════════════════════════════ */}
        <section className="db-kpis" aria-label="Indicateurs clés">
          {kpis.map((k) => {
            const body = (
              <>
                <span className={`db-kpi-icon db-tone-${k.tone}`}>
                  <Icon d={k.icon} size={20} />
                </span>
                <span className="db-kpi-value">
                  {k.money ? formatFcfa(k.value) : nf.format(k.value)}
                </span>
                <span className="db-kpi-label">{k.label}</span>
                {k.progress && (
                  <span className="db-progress" title={`${k.progress.value} % ${k.progress.label}`}>
                    <span className="db-progress-track">
                      <span className="db-progress-fill" style={{ width: `${k.progress.value}%` }} />
                    </span>
                    <span className="db-progress-text">
                      <strong>{k.progress.value} %</strong> {k.progress.label}
                    </span>
                  </span>
                )}
                <span className="db-kpi-foot">
                  {k.delta !== undefined ? (
                    <>
                      <span
                        className={`db-delta${k.delta > 0 ? " is-up" : ""}`}
                      >
                        {k.delta > 0 ? `+${nf.format(k.delta)}` : "0"}
                      </span>{" "}
                      {k.deltaLabel}
                    </>
                  ) : (
                    k.sub
                  )}
                </span>
              </>
            );
            return k.href ? (
              <Link
                key={k.label}
                href={k.href}
                className={`db-kpi db-kpi-${k.tone}`}
              >
                {body}
              </Link>
            ) : (
              <div key={k.label} className={`db-kpi db-kpi-${k.tone}`}>
                {body}
              </div>
            );
          })}
        </section>

        {/* ══ Évolution + état des licences ═════════════════════ */}
        <div className="db-grid db-grid-wide">
          <Panel
            title="Licences validées — 6 derniers mois"
            href={kpis[1].href}
            action="Licences"
          >
            <div className="db-chart">
              <MonthLine
                data={s.evolution}
                unit="licences validées"
                label="Licences validées par mois"
              />
            </div>
          </Panel>
          <Panel title={`Licences ${seasonLabel(s.season)}`} tone="yellow">
            <div className="db-ring">
              <svg
                viewBox="0 0 120 120"
                width={132}
                height={132}
                role="img"
                aria-label={`${rate} % des demandes de licence validées`}
              >
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#edf2ee"
                  strokeWidth="12"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="48"
                  fill="none"
                  stroke="#009543"
                  strokeWidth="12"
                  strokeLinecap="round"
                  strokeDasharray={`${(2 * Math.PI * 48 * rate) / 100} ${2 * Math.PI * 48}`}
                  transform="rotate(-90 60 60)"
                  className="db-ring-arc"
                />
                <text
                  x="60"
                  y="56"
                  textAnchor="middle"
                  fontSize="26"
                  fontWeight="700"
                  fill="#0f1a14"
                  fontFamily="var(--font-heading)"
                >
                  {rate}%
                </text>
                <text
                  x="60"
                  y="76"
                  textAnchor="middle"
                  fontSize="10"
                  fill="#6b8c7b"
                >
                  validées
                </text>
              </svg>
            </div>
            <ul className="db-legend">
              <li>
                <span
                  className="db-legend-key"
                  style={{ background: "#009543" }}
                />{" "}
                Validées <strong>{nf.format(s.totalLicencesValidees)}</strong>
              </li>
              <li>
                <span
                  className="db-legend-key"
                  style={{ background: "#fbde4a" }}
                />{" "}
                En attente <strong>{nf.format(s.licencesEnAttente)}</strong>
              </li>
              <li className="db-legend-total">
                Total des demandes <strong>{nf.format(totalLicences)}</strong>
              </li>
            </ul>
          </Panel>
        </div>

        <div className="db-grid">
          <Panel title="Derniers résultats" href="/admin/matchs">
            {s.derniersResultats.length === 0 ? (
              <Empty icon={D.trophy} text="Aucun résultat pour l'instant." />
            ) : (
              <ul className="db-list">
                {s.derniersResultats.map(
                  ({ match, competition, home, away }) => (
                    <li key={match.id} className="db-result">
                      <span className="db-result-team">
                        <span className="truncate">{home?.shortName ?? home?.name}</span>
                        {home && <ClubLogo src={home.logo} name={home.name} className="size-7 text-[0.6rem]" />}
                      </span>
                      <span className="db-score">
                        {match.homeScore ?? 0} – {match.awayScore ?? 0}
                      </span>
                      <span className="db-result-team db-result-away">
                        {away && <ClubLogo src={away.logo} name={away.name} className="size-7 text-[0.6rem]" />}
                        <span className="truncate">{away?.shortName ?? away?.name}</span>
                      </span>
                      <span className="db-result-meta">
                        {competition.name} ·{" "}
                        {match.kickoffAt
                          ? shortFmt.format(match.kickoffAt)
                          : "—"}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            )}
          </Panel>
          {may("audit.read") ? (
            <Panel
              title="Activité récente"
              tone="ink"
              href="/admin/journal"
              action="Journal"
            >
              {s.activite.length === 0 ? (
                <Empty icon={D.activity} text="Aucune activité enregistrée." />
              ) : (
                <ol className="db-timeline">
                  {s.activite.map((a) => (
                    <li key={a.id}>
                      <span
                        className={`db-tl-dot${a.action.includes("FAILED") ? " is-bad" : ""}`}
                        aria-hidden
                      />
                      <span className="db-tl-body">
                        <span className="db-tl-action">
                          {actionLabel(a.action, a.entity)}
                        </span>
                        <span className="db-tl-meta">
                          {a.user ?? "Système"} · {ago(a.createdAt, now)}
                        </span>
                      </span>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          ) : (
            <Panel title="Mes modules" tone="ink">
              <ShortcutGrid items={shortcuts.slice(0, 8)} />
            </Panel>
          )}
        </div>

        {/* ══ Accès rapides ═════════════════════════════════════ */}
        {may("audit.read") && (
          <Panel title="Accès rapides" tone="green">
            <ShortcutGrid items={shortcuts} />
          </Panel>
        )}
      </div>

      {/* ══ Colonne de suivi ═══════════════════════════════════ */}
      <aside className="db-rail" aria-label="Suivi">
        {/* ══ À traiter ═════════════════════════════════════════ */}
        {todo.length > 0 && todo.every((t) => t.n === 0) && (
          <section className="db-allclear" aria-label="À traiter">
            <span className="db-allclear-icon">
              <Icon d={D.check} size={20} />
            </span>
            <span>
              <strong>Tout est à jour.</strong> Aucun dossier en attente :{" "}
              {todo.map((t) => t.label.toLowerCase()).join(", ")}.
            </span>
          </section>
        )}
        {todo.some((t) => t.n > 0) && (
          <section className="db-todo" aria-label="À traiter">
            {todo.map((t) => (
              <Link
                key={t.href}
                href={t.href}
                className={`db-todo-item${t.n > 0 ? " is-due" : ""}`}
              >
                <span className="db-todo-icon">
                  <Icon d={t.n > 0 ? t.icon : D.check} size={18} />
                </span>
                <span className="db-todo-text">
                  <span className="db-todo-n">
                    {t.n > 0 ? nf.format(t.n) : "À jour"}
                  </span>
                  <span className="db-todo-label">{t.label}</span>
                </span>
                <Icon d={D.arrow} size={15} />
              </Link>
            ))}
          </section>
        )}

        <Panel title="Prochains matchs" tone="yellow" href="/admin/matchs">
          {s.prochainsMatchs.length === 0 ? (
            <Empty icon={D.calendar} text="Aucun match programmé." />
          ) : (
            <ul className="db-list">
              {s.prochainsMatchs.map(({ match, competition, home, away }) => (
                <li key={match.id} className="db-match">
                  <span className="db-date-chip">
                    <strong>
                      {match.kickoffAt ? shortFmt.format(match.kickoffAt) : "—"}
                    </strong>
                    {match.kickoffAt ? timeFmt.format(match.kickoffAt) : ""}
                  </span>
                  <span className="db-match-body">
                    <span className="db-match-teams">
                      {home && <ClubLogo src={home.logo} name={home.name} className="size-6 text-[0.55rem]" />}
                      <span className="truncate">{home?.shortName ?? home?.name}</span> <em>vs</em>{" "}
                      <span className="truncate">{away?.shortName ?? away?.name}</span>
                      {away && <ClubLogo src={away.logo} name={away.name} className="size-6 text-[0.55rem]" />}
                    </span>
                    <span className="db-match-meta">
                      {competition.name}
                      {match.venue ? ` · ${match.venue}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Transferts récents" tone="red" href="/admin/transferts">
          {s.derniersTransferts.length === 0 ? (
            <Empty icon={D.transferts} text="Aucun transfert récent." />
          ) : (
            <ul className="db-list">
              {s.derniersTransferts.map((t) => (
                <li key={t.id} className="db-row">
                  <span className="db-avatar">
                    {`${t.playerFirstName[0] ?? ""}${t.playerLastName[0] ?? ""}`.toUpperCase()}
                  </span>
                  <span className="db-row-body">
                    <strong>
                      {t.playerFirstName} {t.playerLastName}
                    </strong>
                    <span>vers {t.toClubName}</span>
                  </span>
                  <span
                    className={`db-status db-status-${t.status === "APPROVED" ? "ok" : t.status === "REFUSED" || t.status === "CANCELLED" ? "bad" : "wait"}`}
                  >
                    {{
                      PENDING: "En attente",
                      FORWARDED: "Transmis",
                      APPROVED: "Approuvé",
                      REFUSED: "Refusé",
                      CANCELLED: "Annulé",
                    }[t.status] ?? t.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </aside>
    </div>
  );
}

/** Raccourcis vers les modules accessibles au compte (couleurs du drapeau en alternance). */
function ShortcutGrid({
  items,
}: {
  items: { href: string; label: string; group: string }[];
}) {
  const tones = ["green", "yellow", "red"];
  return (
    <ul className="db-shortcuts">
      {items.map((m, i) => (
        <li key={m.href}>
          <Link href={m.href} className="db-shortcut">
            <span className={`db-shortcut-icon db-tone-${tones[i % 3]}`}>
              <Icon d={MODULE_ICONS[m.href] ?? D.grid} size={17} />
            </span>
            <span className="db-shortcut-text">
              <strong>{m.label}</strong>
              <span>{m.group}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

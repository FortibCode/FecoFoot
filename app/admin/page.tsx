import type { Metadata } from "next";
import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import { requirePermission } from "@/lib/auth/guard";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { seasonLabel } from "@/lib/licenses";
import { dashboardStats } from "@/lib/queries/dashboard";
import "./dashboard.css";

export const metadata: Metadata = { title: "Tableau de bord — FECOFOOT" };

/* ── Helpers formatage ────────────────────────────────────── */
function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return String(n);
}
function pct(a: number, b: number) {
  if (!b) return 0;
  return Math.round((a / b) * 100);
}
function dateShort(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
}
function timeShort(d: Date | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}
function initials(last: string, first: string) {
  return `${(first[0] ?? "").toUpperCase()}${(last[0] ?? "").toUpperCase()}`;
}

/* ── Icônes SVG ──────────────────────────────────────────── */
const D = {
  joueurs:    "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z",
  licences:   "M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z",
  clock:      "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  fans:       "M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z",
  clubs:      "M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4",
  matchs:     "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z",
  transferts: "M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4",
  calendar:   "M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z",
  trophy:     "M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z",
  arrow:      "M9 18l6-6-6-6",
  warn:       "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  news:       "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z",
  photo:      "M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z",
  ticket:     "M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z",
  arbitres:   "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2",
  disc:       "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  flag:       "M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9",
  users:      "M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z",
};

function Icon({ d, size = 16 }: { d: string; size?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
      strokeLinecap="round" strokeLinejoin="round" width={size} height={size} aria-hidden>
      {d.split("M").filter(Boolean).map((seg, i) => <path key={i} d={"M" + seg} />)}
    </svg>
  );
}

/* ── Statut transfert ─────────────────────────────────────── */
const TRANSFER_STATUS: Record<string, { label: string; cls: string }> = {
  PENDING:   { label: "En attente", cls: "admin-badge admin-badge-wait" },
  FORWARDED: { label: "Transmis",   cls: "admin-badge admin-badge-wait" },
  APPROVED:  { label: "Approuvé",   cls: "admin-badge admin-badge-ok" },
  REFUSED:   { label: "Refusé",     cls: "admin-badge admin-badge-bad" },
  CANCELLED: { label: "Annulé",     cls: "admin-badge admin-badge-neutral" },
};

/* ── Donut ring SVG (CSS-animated) ───────────────────────── */
function RingChart({ value, total, color }: { value: number; total: number; color: string }) {
  const r = 34;
  const circ = 2 * Math.PI * r; // ≈ 213.6
  const ratio = total > 0 ? value / total : 0;
  const offset = circ * (1 - ratio);
  return (
    <svg viewBox="0 0 80 80" width={80} height={80} className="dash-ring-svg" aria-hidden>
      <circle cx="40" cy="40" r={r} fill="none" stroke="#f0f4f2" strokeWidth={10} />
      <circle
        cx="40" cy="40" r={r}
        fill="none"
        stroke={color}
        strokeWidth={10}
        strokeLinecap="round"
        strokeDasharray={circ}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.22,0.7,0.2,1) 0.5s" }}
      />
      <text x="40" y="38" textAnchor="middle" dominantBaseline="middle"
        fontSize="14" fontWeight="800" fill="#0f1a14" fontFamily="var(--font-heading)">
        {pct(value, total)}%
      </text>
      <text x="40" y="52" textAnchor="middle" dominantBaseline="middle"
        fontSize="7.5" fontWeight="600" fill="#8aaa97">
        validées
      </text>
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════
   PAGE PRINCIPALE
   ═══════════════════════════════════════════════════════════ */
export default async function AdminDashboard() {
  const user = await requirePermission("dashboard.view");
  const stats = await dashboardStats();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";
  const totalLicences = stats.totalLicencesValidees + stats.licencesEnAttente;
  const tauxValidation = pct(stats.totalLicencesValidees, totalLicences);
  const prenom = user.fullName.split(" ")[0];

  return (
    <>
      {/* ══ HERO ═══════════════════════════════════════════ */}
      <div className="dash-hero">
        <BrandLogo size={160} decorative className="dash-hero-logo" />
        <div className="dash-hero-inner">
          <div className="dash-hero-eyebrow">
            <span className="dash-hero-eyebrow-dot" />
            Fédération Congolaise de Football
          </div>
          <h1 className="dash-hero-name">
            {greeting}, <span>{prenom}</span> !
          </h1>
          <p className="dash-hero-meta">{ROLE_LABELS[user.role]}</p>
          <span className="dash-hero-saison">
            <Icon d={D.trophy} size={12} />
            Saison {seasonLabel(stats.season)}
          </span>

          <div className="dash-hero-stats">
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{fmt(stats.totalJoueurs)}</div>
              <div className="dash-hero-stat-lbl">Joueurs</div>
            </div>
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{fmt(stats.totalClubs)}</div>
              <div className="dash-hero-stat-lbl">Clubs affiliés</div>
            </div>
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{fmt(stats.totalLicencesValidees)}</div>
              <div className="dash-hero-stat-lbl">Licences validées</div>
            </div>
            <div className="dash-hero-stat">
              <div className="dash-hero-stat-val">{stats.competitionsActives}<span>actives</span></div>
              <div className="dash-hero-stat-lbl">Compétitions</div>
            </div>
          </div>
        </div>
      </div>

      {/* ══ ALERTE licences en attente ═════════════════════ */}
      {stats.licencesEnAttente > 0 && (
        <div className="dash-alert dash-alert-warn">
          <div className="dash-alert-icon">
            <Icon d={D.warn} size={18} />
          </div>
          <div className="dash-alert-body">
            <div className="dash-alert-title">
              {stats.licencesEnAttente} licence{stats.licencesEnAttente > 1 ? "s" : ""} en attente de validation
            </div>
            <div className="dash-alert-sub">
              Des demandes nécessitent votre action pour la saison {seasonLabel(stats.season)}.
            </div>
          </div>
          <Link href="/admin/licences" className="dash-alert-link">
            Traiter <Icon d={D.arrow} size={12} />
          </Link>
        </div>
      )}

      {/* ══ KPI CARDS GRADIENT ═════════════════════════════ */}
      <div className="dash-kpi-grid">
        {/* Joueurs */}
        <div className="dash-kpi dash-kpi-g1">
          <div className="dash-kpi-top">
            <div className="dash-kpi-icon-wrap">
              <Icon d={D.joueurs} size={20} />
            </div>
            <span className="dash-kpi-trend-pill dash-kpi-trend-up">
              ↑ +{stats.joueursCeMois} / 30j
            </span>
          </div>
          <div className="dash-kpi-val">{fmt(stats.totalJoueurs)}</div>
          <div className="dash-kpi-lbl">Joueurs enregistrés</div>
          <div className="dash-kpi-bar-wrap">
            <div className="dash-kpi-bar-track">
              <div className="dash-kpi-bar-fill" style={{ width: "72%" }} />
            </div>
            <div className="dash-kpi-bar-sub"><span>Registre fédéral</span><span>FCF</span></div>
          </div>
        </div>

        {/* Licences */}
        <div className="dash-kpi dash-kpi-g2">
          <div className="dash-kpi-top">
            <div className="dash-kpi-icon-wrap">
              <Icon d={D.licences} size={20} />
            </div>
            <span className="dash-kpi-trend-pill">
              {tauxValidation}% taux
            </span>
          </div>
          <div className="dash-kpi-val">{fmt(stats.totalLicencesValidees)}</div>
          <div className="dash-kpi-lbl">Licences validées — {seasonLabel(stats.season)}</div>
          <div className="dash-kpi-bar-wrap">
            <div className="dash-kpi-bar-track">
              <div className="dash-kpi-bar-fill" style={{ width: `${tauxValidation}%` }} />
            </div>
            <div className="dash-kpi-bar-sub">
              <span>{stats.licencesEnAttente} en attente</span>
              <span>{totalLicences} total</span>
            </div>
          </div>
        </div>

        {/* Transferts */}
        <div className="dash-kpi dash-kpi-g3">
          <div className="dash-kpi-top">
            <div className="dash-kpi-icon-wrap">
              <Icon d={D.transferts} size={20} />
            </div>
            {stats.transfertsEnCours > 0 && (
              <span className="dash-kpi-trend-pill dash-kpi-trend-warn">
                ⚠ En cours
              </span>
            )}
          </div>
          <div className="dash-kpi-val">{stats.transfertsEnCours}</div>
          <div className="dash-kpi-lbl">Transferts en cours</div>
          <div className="dash-kpi-bar-wrap">
            <div className="dash-kpi-bar-track">
              <div className="dash-kpi-bar-fill" style={{ width: stats.transfertsEnCours > 0 ? "60%" : "10%" }} />
            </div>
            <div className="dash-kpi-bar-sub"><span>Fenêtre ouverte</span><span>{seasonLabel(stats.season)}</span></div>
          </div>
        </div>

        {/* Supporters */}
        <div className="dash-kpi dash-kpi-g4">
          <div className="dash-kpi-top">
            <div className="dash-kpi-icon-wrap">
              <Icon d={D.fans} size={20} />
            </div>
            <span className="dash-kpi-trend-pill">Fan ID</span>
          </div>
          <div className="dash-kpi-val">{fmt(stats.totalSupporters)}</div>
          <div className="dash-kpi-lbl">Supporters enregistrés</div>
          <div className="dash-kpi-bar-wrap">
            <div className="dash-kpi-bar-track">
              <div className="dash-kpi-bar-fill" style={{ width: "55%" }} />
            </div>
            <div className="dash-kpi-bar-sub"><span>Carte numérique</span><span>Active</span></div>
          </div>
        </div>
      </div>

      {/* ══ STATS 3 COLONNES ════════════════════════════════ */}
      <div className="dash-stats3">
        <div className="dash-stat3">
          <div className="dash-stat3-icon"
            style={{ background: "rgba(0,149,67,0.1)", color: "#007a37" }}>
            <Icon d={D.clubs} size={20} />
          </div>
          <div className="dash-stat3-body">
            <div className="dash-stat3-val">{stats.totalClubs}</div>
            <div className="dash-stat3-lbl">Clubs affiliés</div>
          </div>
        </div>
        <div className="dash-stat3">
          <div className="dash-stat3-icon"
            style={{ background: "rgba(59,130,246,0.1)", color: "#1d4ed8" }}>
            <Icon d={D.matchs} size={20} />
          </div>
          <div className="dash-stat3-body">
            <div className="dash-stat3-val">{fmt(stats.matchsJoues)}</div>
            <div className="dash-stat3-lbl">Matchs joués</div>
          </div>
        </div>
        <div className="dash-stat3">
          <div className="dash-stat3-icon"
            style={{ background: "rgba(147,51,234,0.1)", color: "#7c3aed" }}>
            <Icon d={D.arbitres} size={20} />
          </div>
          <div className="dash-stat3-body">
            <div className="dash-stat3-val">{stats.arbitresActifs}</div>
            <div className="dash-stat3-lbl">Arbitres actifs</div>
          </div>
        </div>
      </div>

      {/* ══ GRILLE PRINCIPALE : Matchs + Taux licences ═════ */}
      <div className="dash-grid-main">

        {/* Prochains matchs */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2 className="dash-panel-title">
              <span className="dash-panel-title-dot" style={{ background: "#1d4ed8" }} />
              Prochains matchs
            </h2>
            <Link href="/admin/matchs" className="dash-panel-action">
              Tout voir <Icon d={D.arrow} size={11} />
            </Link>
          </div>
          {stats.prochainsMatchs.length === 0 ? (
            <div className="dash-match-empty">
              <Icon d={D.calendar} size={28} />
              <span>Aucun match programmé</span>
            </div>
          ) : (
            stats.prochainsMatchs.map(({ match, competition, home, away }) => (
              <div key={match.id} className="dash-match">
                <div>
                  <div className="dash-match-badge">
                    {competition.name.slice(0, 8)}
                  </div>
                </div>
                <div className="dash-match-content">
                  <div className="dash-match-teams-row">
                    <span className="dash-match-team">{home?.shortName ?? home?.name ?? "—"}</span>
                    <span className="dash-match-sep">vs</span>
                    <span className="dash-match-team dash-match-team-away">{away?.shortName ?? away?.name ?? "—"}</span>
                  </div>
                  <div className="dash-match-sub">
                    <Icon d={D.calendar} size={10} />
                    {dateShort(match.kickoffAt)} · {match.venue ?? "Lieu TBD"}
                  </div>
                </div>
                <div className="dash-match-right">
                  <div className="dash-match-time">{timeShort(match.kickoffAt)}</div>
                  <span className="dash-match-status">Programmé</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Taux de validation licences (donut) */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2 className="dash-panel-title">
              <span className="dash-panel-title-dot" style={{ background: "#0284c7" }} />
              Licences — {seasonLabel(stats.season)}
            </h2>
            <Link href="/admin/licences" className="dash-panel-action">
              Gérer <Icon d={D.arrow} size={11} />
            </Link>
          </div>

          {/* Donut SVG centré */}
          <div style={{ display: "flex", justifyContent: "center", padding: "1.25rem 1.375rem 0.5rem" }}>
            <RingChart
              value={stats.totalLicencesValidees}
              total={totalLicences}
              color="#0284c7"
            />
          </div>

          {/* Légende barres */}
          <div className="dash-hbar-wrap">
            <div className="dash-hbar-row">
              <div className="dash-hbar-header">
                <span className="dash-hbar-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#0284c7", display: "inline-block" }} />
                  Validées
                </span>
                <span className="dash-hbar-pct">{stats.totalLicencesValidees}</span>
              </div>
              <div className="dash-hbar-track">
                <div className="dash-hbar-fill"
                  style={{
                    width: totalLicences > 0 ? `${pct(stats.totalLicencesValidees, totalLicences)}%` : "0%",
                    background: "linear-gradient(90deg, #0284c7, #38bdf8)",
                  }} />
              </div>
            </div>

            <div className="dash-hbar-row">
              <div className="dash-hbar-header">
                <span className="dash-hbar-label" style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d97706", display: "inline-block" }} />
                  En attente
                </span>
                <span className="dash-hbar-pct">{stats.licencesEnAttente}</span>
              </div>
              <div className="dash-hbar-track">
                <div className="dash-hbar-fill"
                  style={{
                    width: totalLicences > 0 ? `${pct(stats.licencesEnAttente, totalLicences)}%` : "0%",
                    background: "linear-gradient(90deg, #d97706, #fbbf24)",
                  }} />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
              padding: "0.625rem 0 0", borderTop: "1px solid #f0f4f2", marginTop: "0.25rem" }}>
              <span style={{ fontSize: "0.72rem", color: "#8aaa97", fontWeight: 600 }}>
                Total demandes
              </span>
              <span style={{ fontSize: "0.875rem", fontWeight: 800, color: "#0f1a14",
                fontFamily: "var(--font-heading)" }}>
                {totalLicences}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══ DERNIERS RÉSULTATS + TRANSFERTS ════════════════ */}
      <div className="dash-grid-main">

        {/* Derniers résultats */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2 className="dash-panel-title">
              <span className="dash-panel-title-dot" style={{ background: "#009543" }} />
              Derniers résultats
            </h2>
            <Link href="/admin/matchs" className="dash-panel-action">
              Tout voir <Icon d={D.arrow} size={11} />
            </Link>
          </div>
          {stats.derniersResultats.length === 0 ? (
            <div className="dash-match-empty">
              <Icon d={D.trophy} size={28} />
              <span>Aucun résultat disponible</span>
            </div>
          ) : (
            stats.derniersResultats.map(({ match, competition, home, away }) => (
              <div key={match.id} className="dash-result">
                <div className="dash-result-comp">{competition.name}</div>
                <div className="dash-result-match">
                  <span className="dash-result-club">{home?.shortName ?? home?.name ?? "—"}</span>
                  <span className="dash-result-score">
                    {match.homeScore ?? 0} – {match.awayScore ?? 0}
                  </span>
                  <span className="dash-result-club dash-result-club-away">
                    {away?.shortName ?? away?.name ?? "—"}
                  </span>
                </div>
                <div className="dash-result-date">{dateShort(match.kickoffAt)}</div>
              </div>
            ))
          )}
        </div>

        {/* Transferts récents */}
        <div className="dash-panel">
          <div className="dash-panel-header">
            <h2 className="dash-panel-title">
              <span className="dash-panel-title-dot" style={{ background: "#dc241f" }} />
              Transferts récents
            </h2>
            <Link href="/admin/transferts" className="dash-panel-action">
              Tout voir <Icon d={D.arrow} size={11} />
            </Link>
          </div>
          {stats.derniersTransferts.length === 0 ? (
            <div className="dash-match-empty">
              <Icon d={D.transferts} size={28} />
              <span>Aucun transfert récent</span>
            </div>
          ) : (
            stats.derniersTransferts.map((t) => {
              const st = TRANSFER_STATUS[t.status] ?? { label: t.status, cls: "admin-badge admin-badge-neutral" };
              return (
                <div key={t.id} className="dash-transfer">
                  <div className="dash-transfer-av">
                    {initials(t.playerLastName, t.playerFirstName)}
                  </div>
                  <div className="dash-transfer-body">
                    <div className="dash-transfer-player">
                      {t.playerFirstName} {t.playerLastName}
                    </div>
                    <div className="dash-transfer-detail">
                      <span>Vers</span>
                      <span className="dash-transfer-arrow">→</span>
                      <span>{t.toClubName}</span>
                    </div>
                  </div>
                  <div className="dash-transfer-tail">
                    <span className={st.cls}>{st.label}</span>
                    <span className="dash-transfer-date">{dateShort(t.createdAt)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ══ RACCOURCIS MODULES ═════════════════════════════ */}
      <div className="dash-panel">
        <div className="dash-panel-header">
          <h2 className="dash-panel-title">
            <span className="dash-panel-title-dot" style={{ background: "#009543" }} />
            Accès rapides
          </h2>
        </div>
        <div className="dash-shortcuts-grid">
          {[
            { href: "/admin/licences",     d: D.licences,   label: "Licences",      bg: "rgba(2,132,199,.1)",   c: "#0284c7" },
            { href: "/admin/transferts",   d: D.transferts, label: "Transferts",    bg: "rgba(220,36,31,.1)",   c: "#b91c1c" },
            { href: "/admin/competitions", d: D.trophy,     label: "Compétitions",  bg: "rgba(0,149,67,.1)",    c: "#007a37" },
            { href: "/admin/matchs",       d: D.matchs,     label: "Matchs",        bg: "rgba(59,130,246,.1)",  c: "#1d4ed8" },
            { href: "/admin/actualites",   d: D.news,       label: "Actualités",    bg: "rgba(147,51,234,.1)",  c: "#7c3aed" },
            { href: "/admin/photos",       d: D.photo,      label: "Photothèque",   bg: "rgba(251,222,74,.2)",  c: "#92400e" },
            { href: "/admin/billetterie",  d: D.ticket,     label: "Billetterie",   bg: "rgba(249,115,22,.1)",  c: "#ea580c" },
            { href: "/admin/arbitres",     d: D.arbitres,   label: "Arbitres",      bg: "rgba(59,130,246,.1)",  c: "#1d4ed8" },
            { href: "/admin/joueurs",      d: D.joueurs,    label: "Joueurs",       bg: "rgba(0,149,67,.1)",    c: "#007a37" },
            { href: "/admin/discipline",   d: D.disc,       label: "Discipline",    bg: "rgba(220,36,31,.1)",   c: "#b91c1c" },
            { href: "/admin/selections",   d: D.flag,       label: "Équipes nat.",  bg: "rgba(0,149,67,.1)",    c: "#007a37" },
            { href: "/admin/utilisateurs", d: D.users,      label: "Utilisateurs",  bg: "rgba(107,114,128,.1)", c: "#374151" },
          ].map((s) => (
            <Link key={s.href} href={s.href} className="dash-sc">
              <div className="dash-sc-icon" style={{ background: s.bg, color: s.c }}>
                <Icon d={s.d} size={16} />
              </div>
              {s.label}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}

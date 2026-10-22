import Link from "next/link";

export type Stat = { label: string; value: string | number; sub?: string; href?: string; active?: boolean };

const TONES = ["green", "yellow", "red", "ink"] as const;

/**
 * Cartes d'indicateurs des modules (même style que le tableau de bord) : liseré aux couleurs du drapeau
 * en alternance, valeur en grand. Avec `href`, la carte devient un filtre (état `active`).
 * `testIdPrefix` : identifiant de test « <préfixe><libellé> » posé sur la valeur.
 */
export function StatCards({ stats, testIdPrefix, label = "Indicateurs" }: { stats: Stat[]; testIdPrefix?: string; label?: string }) {
  return (
    <ul className="stat-cards" aria-label={label} style={{ ["--stat-cols" as string]: String(Math.min(stats.length, 6)) }}>
      {stats.map((s, i) => {
        const tone = TONES[i % TONES.length];
        const body = (
          <>
            <span className="stat-card-label">{s.label}</span>
            <span className="stat-card-value" data-testid={testIdPrefix ? `${testIdPrefix}${s.label}` : undefined}>
              {s.value}
            </span>
            {s.sub && <span className="stat-card-sub">{s.sub}</span>}
          </>
        );
        return (
          <li key={s.label}>
            {s.href ? (
              <Link href={s.href} aria-current={s.active ? "true" : undefined} className={`stat-card stat-card-${tone} is-link`}>
                {body}
              </Link>
            ) : (
              <div className={`stat-card stat-card-${tone}`}>{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

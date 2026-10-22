import Link from "next/link";

/** Pages affichées : la première, la dernière et deux voisines de la page courante ; « … » pour le reste. */
function pageWindow(page: number, pages: number): (number | "…")[] {
  const keep = new Set([1, pages, page - 1, page, page + 1].filter((p) => p >= 1 && p <= pages));
  const out: (number | "…")[] = [];
  let prev = 0;
  for (const p of [...keep].sort((a, b) => a - b)) {
    if (p - prev > 1) out.push("…");
    out.push(p);
    prev = p;
  }
  return out;
}

/**
 * Pied de tableau paginé : « 1–5 sur 13 » et les numéros de page.
 * `hrefFor` pour une pagination côté serveur (liens), `onPage` pour une pagination dans le navigateur.
 */
export function Pager({
  page,
  pages,
  total,
  pageSize,
  hrefFor,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  pageSize: number;
  hrefFor?: (page: number) => string;
  onPage?: (page: number) => void;
}) {
  if (total === 0) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const go = (p: number, label: string, text: string, current = false) =>
    hrefFor ? (
      <Link key={label} href={hrefFor(p)} className={`admin-page-btn${current ? " is-active" : ""}`} aria-label={label} aria-current={current ? "page" : undefined}>
        {text}
      </Link>
    ) : (
      <button key={label} type="button" onClick={() => onPage?.(p)} className={`admin-page-btn${current ? " is-active" : ""}`} aria-label={label} aria-current={current ? "page" : undefined}>
        {text}
      </button>
    );
  return (
    <nav className="table-pager" aria-label="Pagination" data-testid="table-pager">
      <p className="table-pager-count">
        <strong>
          {from}–{to}
        </strong>{" "}
        sur {total}
      </p>
      {pages > 1 && (
        <div className="table-pager-pages">
          {page > 1 ? go(page - 1, "Page précédente", "‹") : <span className="admin-page-btn is-disabled" aria-hidden>‹</span>}
          {pageWindow(page, pages).map((p, i) =>
            p === "…" ? (
              <span key={`gap-${i}`} className="table-pager-gap" aria-hidden>
                …
              </span>
            ) : (
              go(p, `Page ${p}`, String(p), p === page)
            ),
          )}
          {page < pages ? go(page + 1, "Page suivante", "›") : <span className="admin-page-btn is-disabled" aria-hidden>›</span>}
        </div>
      )}
    </nav>
  );
}

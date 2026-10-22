import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge, licenseTone } from "@/components/admin/status-badge";
import { requireUser } from "@/lib/auth/guard";
import { LICENSE_STATUS_LABELS } from "@/lib/licenses";
import { globalSearch } from "@/lib/queries/search";

export const metadata: Metadata = { title: "Recherche — FECOFOOT" };

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  if (count === 0) return null;
  return (
    <section aria-label={title} className="flex flex-col">
      <h2>
        {title} <span className="text-sm font-normal text-muted-foreground">· {count}</span>
      </h2>
      <ul className="admin-search-results">{children}</ul>
    </section>
  );
}

function Hit({ href, title, meta, badge }: { href: string; title: string; meta?: string | null; badge?: ReactNode }) {
  return (
    <li>
      <Link href={href} className="admin-search-hit">
        <span className="min-w-0">
          <span className="block truncate font-semibold">{title}</span>
          {meta && <span className="block truncate text-xs text-muted-foreground">{meta}</span>}
        </span>
        {badge}
        <span aria-hidden className="admin-search-hit-arrow">→</span>
      </Link>
    </li>
  );
}

/** Résultats de la recherche de l'en-tête, regroupés par type, dans le périmètre du compte. */
export default async function SearchPage({ searchParams }: PageProps<"/admin/recherche">) {
  const user = await requireUser();
  const raw = (await searchParams).q;
  const q = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const r = await globalSearch(user, q);
  const total = r ? r.clubRows.length + r.playerRows.length + r.licenseRows.length + r.fanRows.length + r.userRows.length + r.articleRows.length : 0;

  return (
    <>
      <PageHeader
        eyebrow="Recherche"
        title={r ? `« ${r.q} »` : "Recherche"}
        description={!r ? "Saisissez au moins 2 caractères dans la barre de recherche." : `${total} résultat(s)`}
      />
      {r && total === 0 && (
        <div className="admin-empty">
          <p className="admin-empty-title">Aucun résultat</p>
          <p className="admin-empty-desc">Essayez un nom, un numéro de licence (LIC-…), un identifiant fédéral ou un numéro d&apos;affiliation (FCF-CLB-…).</p>
        </div>
      )}
      {r && total > 0 && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Group title="Clubs" count={r.clubRows.length}>
            {r.clubRows.map((c) => (
              <Hit key={c.id} href={`/admin/clubs/${c.id}`} title={c.name} meta={`${c.number} · ${c.city}`} />
            ))}
          </Group>
          <Group title="Joueurs" count={r.playerRows.length}>
            {r.playerRows.map((p) => (
              <Hit key={p.id} href={`/admin/joueurs/${p.id}`} title={`${p.lastName} ${p.firstName}`} meta={`${p.federalId}${p.club ? ` · ${p.club}` : ""}`} />
            ))}
          </Group>
          <Group title="Licences" count={r.licenseRows.length}>
            {r.licenseRows.map((l) => (
              <Hit
                key={l.id}
                href={`/admin/licences/${l.id}`}
                title={l.number}
                meta={`${l.lastName} ${l.firstName}`}
                badge={<StatusBadge tone={licenseTone(l.status)}>{LICENSE_STATUS_LABELS[l.status]}</StatusBadge>}
              />
            ))}
          </Group>
          <Group title="Supporters" count={r.fanRows.length}>
            {r.fanRows.map((f) => (
              <Hit key={f.id} href={`/admin/supporters/${f.id}`} title={`${f.lastName} ${f.firstName}`} meta={f.fanId} />
            ))}
          </Group>
          <Group title="Comptes" count={r.userRows.length}>
            {r.userRows.map((u) => (
              <Hit key={u.id} href={`/admin/utilisateurs/${u.id}`} title={u.fullName} meta={u.email} />
            ))}
          </Group>
          <Group title="Actualités" count={r.articleRows.length}>
            {r.articleRows.map((a) => (
              <Hit key={a.id} href={`/admin/actualites/${a.id}`} title={a.title} meta={a.status === "PUBLISHED" ? "Publié" : "Brouillon"} />
            ))}
          </Group>
        </div>
      )}
    </>
  );
}

import type { Metadata } from "next";
import { RowActions } from "@/components/admin/row-actions";
import { deleteReferee } from "./actions";
import { StatCards } from "@/components/admin/stat-cards";
import Link from "next/link";
import { asc, eq } from "drizzle-orm";
import { DataTable, PageHeader } from "@/components/admin/page-header";
import { requirePermission } from "@/lib/auth/guard";
import { db } from "@/lib/db";
import { championships, leagues, referees } from "@/lib/db/schema";
import { leagueOptions, nationalDivisionOptions } from "@/lib/queries/reference";
import { NATIONAL_LEVEL, parseScope, REFEREE_GRADE_LABELS, REFEREE_GRADES, scopeValue } from "@/lib/referees";
import { SelectField } from "@/components/ui/field";
import { textMatch } from "@/lib/text-search";
import { createReferee } from "./actions";
import { RefereeForm } from "./RefereeForm";

export const metadata: Metadata = { title: "Arbitres — FECOFOOT" };

/** Registre des arbitres (EF-ARB-01). */
export default async function RefereesPage({ searchParams }: PageProps<"/admin/arbitres">) {
  await requirePermission("refereeing.manage");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : undefined;
  const grade = REFEREE_GRADES.find((g) => g === sp.grade);
  // Rattachement filtré : « l:<id> » (ligue), « c:<id> » (division nationale) ou « federation » (aucun des deux).
  const scope = sp.scope === "federation" ? "federation" : typeof sp.scope === "string" && sp.scope && parseScope(sp.scope) ? sp.scope : undefined;
  const state = sp.state === "active" || sp.state === "inactive" ? sp.state : undefined;
  const [rows, allLeagues, divisions] = await Promise.all([
    db
      .select({ r: referees, league: leagues.name, division: championships.name })
      .from(referees)
      .leftJoin(leagues, eq(referees.leagueId, leagues.id))
      .leftJoin(championships, eq(referees.championshipId, championships.id))
      .orderBy(asc(referees.lastName), asc(referees.firstName)),
    leagueOptions(),
    nationalDivisionOptions(),
  ]);
  const shown = rows.filter(
    ({ r }) =>
      textMatch(q, `${r.lastName} ${r.firstName}`, r.email, r.phone) &&
      (!grade || r.grade === grade) &&
      (!scope || scopeValue(r) === (scope === "federation" ? "" : scope)) &&
      (!state || r.active === (state === "active")),
  );
  return (
    <>
      <PageHeader
        eyebrow="Arbitrage"
        title="Arbitres"
        description={`${rows.length} officiel(s). Les désignations se font depuis la page de chaque match.`}
        actions={
          <a href="#ajouter" className="admin-btn admin-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" width={14} height={14} aria-hidden><path d="M12 5v14m-7-7h14" /></svg>
            Nouvel officiel
          </a>
        }
      />
      <StatCards
        stats={[
          { label: "Officiels", value: rows.length },
          { label: "Actifs", value: rows.filter((x) => x.r.active).length },
          { label: "FIFA et élite", value: rows.filter((x) => x.r.grade === "FIFA" || x.r.grade === "ELITE").length },
          { label: "Stagiaires", value: rows.filter((x) => x.r.grade === "TRAINEE").length },
        ]}
      />
      <form aria-label="Filtres" className="text-sm">
        <label>
          Recherche
          <input name="q" defaultValue={q} placeholder="Nom, e-mail, téléphone" className="admin-input" style={{ maxWidth: 220 }} />
        </label>
        <SelectField label="Grade" name="grade" defaultValue={grade ?? ""}>
          <option value="">Tous</option>
          {REFEREE_GRADES.map((g) => (
            <option key={g} value={g}>
              {REFEREE_GRADE_LABELS[g]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Ligue ou division" name="scope" defaultValue={scope ?? ""}>
          <option value="">Toutes</option>
          <option value="federation">{NATIONAL_LEVEL}</option>
          <optgroup label="Divisions nationales">
            {divisions.map((d) => (
              <option key={d.id} value={`c:${d.id}`}>
                {d.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Ligues départementales">
            {allLeagues.map((l) => (
              <option key={l.id} value={`l:${l.id}`}>
                {l.name}
              </option>
            ))}
          </optgroup>
        </SelectField>
        <SelectField label="État" name="state" defaultValue={state ?? ""}>
          <option value="">Tous</option>
          <option value="active">Actifs</option>
          <option value="inactive">Inactifs</option>
        </SelectField>
        <button type="submit">Filtrer</button>
      </form>
      <DataTable head={["Nom", "Grade", "Ligue ou division", "Contact", "État", ""]} pageSize={5}>
        {shown.length === 0 && (
          <tr>
            <td colSpan={6} className="text-center text-muted-foreground">
              Aucun officiel ne correspond.
            </td>
          </tr>
        )}
        {shown.map(({ r, league, division }) => (
          <tr key={r.id}>
            <td className="px-3 py-2">
              <Link href={`/admin/arbitres/${r.id}`} className="font-medium underline-offset-2 hover:underline">
                {r.lastName} {r.firstName}
              </Link>
            </td>
            <td className="px-3 py-2">{REFEREE_GRADE_LABELS[r.grade]}</td>
            <td className="px-3 py-2">{division ? `${division} National` : (league ?? NATIONAL_LEVEL)}</td>
            <td className="px-3 py-2 text-xs">{[r.phone, r.email].filter(Boolean).join(" · ") || "—"}</td>
            <td className="px-3 py-2">{r.active ? "Actif" : "Inactif"}</td>
            <td>
              <RowActions name={`${r.lastName} ${r.firstName}`} viewHref={`/admin/arbitres/${r.id}`} editHref={`/admin/arbitres/${r.id}#modifier`} onDelete={deleteReferee.bind(null, r.id)} />
            </td>
          </tr>
        ))}
      </DataTable>
      <section id="ajouter" className="mt-6 flex flex-col gap-3">
        <h2 className="font-semibold">Ajouter un officiel</h2>
        <RefereeForm action={createReferee} leagues={allLeagues} divisions={divisions} submitLabel="Ajouter" />
      </section>
    </>
  );
}

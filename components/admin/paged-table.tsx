"use client";

import { Children, useState, type ReactNode } from "react";
import { Pager } from "./pager";

/** Tableau paginé dans le navigateur : toutes les lignes sont rendues par le serveur, `pageSize` à la fois sont affichées. */
export function PagedTable({ head, pageSize, children }: { head: string[]; pageSize: number; children: ReactNode }) {
  const rows = Children.toArray(children);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const [wanted, setPage] = useState(1);
  // Après un filtrage, la liste peut raccourcir : on ne reste jamais au-delà de la dernière page.
  const page = Math.min(wanted, pages);
  return (
    <>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={`${h}-${i}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody key={page} className="table-page-in">
            {rows.slice((page - 1) * pageSize, page * pageSize)}
          </tbody>
        </table>
      </div>
      <Pager page={page} pages={pages} total={rows.length} pageSize={pageSize} onPage={setPage} />
    </>
  );
}

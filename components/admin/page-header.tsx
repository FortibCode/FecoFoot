import type { ReactNode } from "react";

/**
 * En-tête de page standardisée pour l'espace admin.
 * Design premium avec eyebrow, titre Oswald, description et zone d'actions.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="admin-page-header">
      <div>
        <p className="admin-page-header-eyebrow">{eyebrow}</p>
        <h1 className="admin-page-header-title">{title}</h1>
        {description && (
          <p className="admin-page-header-desc">{description}</p>
        )}
      </div>
      {actions && (
        <div className="admin-page-header-actions">{actions}</div>
      )}
    </div>
  );
}

/**
 * Tableau de données premium — défilement horizontal sur mobile,
 * en-tête épinglé, rangées avec hover, bords arrondis.
 */
export function DataTable({
  head,
  children,
}: {
  head: string[];
  children: ReactNode;
}) {
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead>
          <tr>
            {head.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

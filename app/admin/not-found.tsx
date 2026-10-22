import { EmptyState } from "@/components/admin/empty-state";

/** Élément introuvable dans l'espace fédéral (fiche supprimée, lien ancien, identifiant erroné). */
export default function AdminNotFound() {
  return (
    <div className="pt-8">
      <EmptyState icon="document" title="Élément introuvable" action={{ href: "/admin", label: "Retour au tableau de bord" }}>
        Cette fiche n’existe pas ou a été supprimée. Le lien que vous avez suivi est peut-être ancien : repartez de la liste du module concerné.
      </EmptyState>
    </div>
  );
}

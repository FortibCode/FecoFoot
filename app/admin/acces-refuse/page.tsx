import { EmptyState } from "@/components/admin/empty-state";

export default function AccesRefuse() {
  return (
    <div className="pt-8">
      <EmptyState icon="lock" title="Accès refusé" action={{ href: "/admin", label: "Retour au tableau de bord" }}>
        Votre profil ne donne pas accès à cette page. Si vous pensez qu’il s’agit d’une erreur, contactez l’administrateur de la plateforme.
      </EmptyState>
    </div>
  );
}

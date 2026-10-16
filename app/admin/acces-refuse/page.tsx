import Link from "next/link";

export default function AccesRefuse() {
  return (
    <>
      <h1 className="text-2xl font-bold">Accès refusé</h1>
      <p className="mt-2 text-muted-foreground">Votre profil ne donne pas accès à cette page.</p>
      <Link href="/admin" className="mt-4 inline-block text-sm font-medium underline">
        Retour au tableau de bord
      </Link>
    </>
  );
}

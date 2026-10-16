import Link from "next/link";

// Page provisoire : le portail public (M01) sera construit dans un lot ultérieur.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="h-1.5 w-40 bg-[linear-gradient(90deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
      <h1 className="text-3xl font-extrabold tracking-tight md:text-5xl">FECOFOOT Platform</h1>
      <p className="max-w-md text-muted-foreground">
        Plateforme numérique de la Fédération Congolaise de Football — portail public en construction.
      </p>
      <Link href="/connexion" className="rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground">
        Espace fédéral
      </Link>
    </main>
  );
}

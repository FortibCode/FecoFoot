import Link from "next/link";
import type { ReactNode } from "react";

/** Mise en page sobre des pages publiques ponctuelles (accord, vérification), en attendant le portail M01. */
export function PublicShell({ eyebrow, title, children, wide = false }: { eyebrow: string; title: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="h-1.5 bg-[linear-gradient(90deg,var(--flag-green)_33%,var(--flag-yellow)_33%_66%,var(--flag-red)_66%)]" />
      <header className="border-b px-4 py-3">
        <nav className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <Link href="/" className="mr-auto font-bold tracking-tight">
            FECOFOOT
          </Link>
          <Link href="/competitions" className="hover:underline">Compétitions</Link>
          <Link href="/equipes-nationales" className="hover:underline">Équipes nationales</Link>
          <Link href="/verifier" className="hover:underline">Vérifier une licence</Link>
        </nav>
      </header>
      <main className={`mx-auto w-full flex-1 px-4 py-8 ${wide ? "max-w-5xl" : "max-w-xl"}`}>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h1 className="mb-6 text-2xl font-bold">{title}</h1>
        {children}
      </main>
    </div>
  );
}

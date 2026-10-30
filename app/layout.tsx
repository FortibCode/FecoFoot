import type { Metadata } from "next";
import { Inter, Oswald } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";
import { DevPerformanceGuard } from "@/components/dev-performance-guard";
import { RevealObserver } from "@/components/reveal-observer";
import { DivisionsProvider } from "@/components/public/divisions";
import { SocialsProvider } from "@/components/public/site-settings";
import { publicDivisions, siteSettingsRow } from "@/lib/queries/reference";

// next/font auto-héberge la police au build : aucun appel à Google côté visiteur.
// Inter : toute l'interface, titres (700-800) et chiffres (scores, statistiques en chiffres alignés).
// Police variable : un seul fichier pour toutes les graisses, léger en 3G (ENF-01).
const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
// Oswald, étroite : affiches et visuels sportifs (noms d'équipes, « Congo vs Comores », billet, badge).
const oswald = Oswald({ variable: "--font-oswald", subsets: ["latin"], weight: ["500", "600", "700"], display: "swap" });

export const metadata: Metadata = {
  // Adresses absolues des images de partage (EF-PUB-08).
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  openGraph: { siteName: "FECOFOOT", locale: "fr_FR", type: "website" },
  title: {
    default: "FECOFOOT — Fédération Congolaise de Football",
    template: "%s",
  },
  description: "Plateforme numérique de la Fédération Congolaise de Football.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Rendu à chaque requête : nécessaire pour que Next applique le nonce CSP de la requête à ses scripts (ENF-09).
  await connection();
  const [divisions, settings] = await Promise.all([publicDivisions(), siteSettingsRow()]);
  const socials = { facebook: settings?.facebookUrl ?? null, instagram: settings?.instagramUrl ?? null, x: settings?.xUrl ?? null, youtube: settings?.youtubeUrl ?? null };
  return (
    <html lang="fr" className={`${inter.variable} ${oswald.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <DevPerformanceGuard />
        <DivisionsProvider divisions={divisions}>
          <SocialsProvider socials={socials}>{children}</SocialsProvider>
        </DivisionsProvider>
        <RevealObserver />
      </body>
    </html>
  );
}

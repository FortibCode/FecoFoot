import type { Metadata } from "next";
import { Oswald, Poppins } from "next/font/google";
import { connection } from "next/server";
import "./globals.css";

// next/font auto-héberge la police au build : aucun appel à Google côté visiteur.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});
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
  return (
    <html lang="fr" className={`${poppins.variable} ${oswald.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

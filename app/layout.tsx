import type { Metadata } from "next";
import { Poppins } from "next/font/google";
import "./globals.css";

// next/font auto-héberge la police au build : aucun appel à Google côté visiteur.
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "FECOFOOT — Fédération Congolaise de Football",
    template: "%s",
  },
  description: "Plateforme numérique de la Fédération Congolaise de Football.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${poppins.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">{children}</body>
    </html>
  );
}

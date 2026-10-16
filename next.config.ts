import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Le bouton flottant des outils de développement masque des boutons sur téléphone (et gêne les tests).
  devIndicators: false,
  // Exports PDF / Excel (EF-EXP-01) : pdfkit lit ses polices sur le disque, on ne l'empaquette pas.
  serverExternalPackages: ["pdfkit", "exceljs"],
  experimental: {
    serverActions: {
      // Pièces justificatives et photos : 5 Mo par fichier (lib/documents.ts) + marge multipart.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;

import type { NextConfig } from "next";
import { servedOverHttps, staticSecurityHeaders } from "./lib/security-headers";

const nextConfig: NextConfig = {
  // Serveur autonome et compact pour l'image Docker (Dockerfile).
  output: "standalone",
  // Le bouton flottant des outils de développement masque des boutons sur téléphone (et gêne les tests).
  devIndicators: false,
  // Exports PDF / Excel (EF-EXP-01) : pdfkit lit ses polices sur le disque, on ne l'empaquette pas.
  serverExternalPackages: ["pdfkit", "exceljs"],
  // En-têtes de sécurité fixes sur toutes les réponses (ENF-09) ; la CSP, propre à chaque requête, est posée par proxy.ts.
  async headers() {
    return [{ source: "/:path*", headers: staticSecurityHeaders({ https: servedOverHttps(process.env.APP_URL) }) }];
  },
  poweredByHeader: false,
  experimental: {
    serverActions: {
      // Pièces justificatives et photos : 5 Mo par fichier (lib/documents.ts) + marge multipart.
      bodySizeLimit: "6mb",
    },
  },
};

export default nextConfig;

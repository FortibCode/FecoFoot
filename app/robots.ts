import type { MetadataRoute } from "next";

/** Référencement (EF-PUB-08) : pages privées ou personnelles exclues de l'indexation. */
export default function robots(): MetadataRoute.Robots {
  const base = process.env.APP_URL ?? "http://localhost:3000";
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin", "/connexion", "/paiement", "/billet/", "/accord/", "/reinitialiser/", "/accreditations/suivi/", "/accreditations/badge/", "/supporters/espace", "/verifier/", "/media/"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}

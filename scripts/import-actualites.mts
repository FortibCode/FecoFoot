import "dotenv/config";
import { syncNews, WP_SITE } from "../lib/news-sync";

/**
 * Reprise des actualités de l'ancien site (npm run actualites:import) : tout l'historique au premier passage,
 * puis seulement les nouveaux articles. Rien n'est écrasé ; tout reste modifiable dans Administration › Actualités.
 */
console.log(`Synchronisation avec ${WP_SITE}…`);
const report = await syncNews({ mode: "all", onProgress: (m) => console.log(`  ${m}`) });
console.log(`Terminé : ${report.imported} importé(s), ${report.skipped} déjà présent(s), ${report.failed.length} en échec.`);
for (const f of report.failed) console.log(`  ✗ ${f}`);
process.exit(0);

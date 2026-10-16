import "server-only";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Stockage des fichiers téléversés.
 * Développement : disque local (UPLOAD_DIR, par défaut ./uploads).
 * Production : remplacer ces trois fonctions par un stockage objet sauvegardé (§8.2),
 * sans rien changer au reste de l'application.
 */

// Le dossier est lu à l'exécution : on l'exclut de l'analyse du bundler (sinon tout le projet serait embarqué).
const ROOT = path.resolve(/* turbopackIgnore: true */ process.env.UPLOAD_DIR ?? "uploads");

/** Les clés sont générées par l'application ; on refuse tout chemin qui sortirait du dossier. */
function resolveKey(key: string): string {
  if (!/^[a-z]+\/\d+\/[a-f0-9-]{36}\.(jpeg|png|webp|pdf)$/.test(key)) throw new Error(`Clé de stockage invalide : ${key}`);
  return path.join(/* turbopackIgnore: true */ ROOT, key);
}

export async function putFile(key: string, bytes: Uint8Array): Promise<void> {
  const file = resolveKey(key);
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes, { flag: "wx" });
}

export async function getFile(key: string): Promise<Buffer> {
  return readFile(resolveKey(key));
}

export async function deleteFile(key: string): Promise<void> {
  await rm(resolveKey(key), { force: true });
}

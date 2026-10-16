import "server-only";
import { createHash, randomBytes } from "node:crypto";

/** Jeton aléatoire utilisable dans une URL (256 bits). */
export const randomToken = () => randomBytes(32).toString("base64url");

/** Empreinte SHA-256 : seule forme sous laquelle un lien personnel est stocké. */
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

import "server-only";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "./cookie";

/** Session interne : cookie httpOnly signé, expiration 10 h (EF-AUT-01). */

export { SESSION_COOKIE };
const SESSION_TTL_SECONDS = 10 * 60 * 60;

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET doit être défini et faire au moins 32 caractères.");
  }
  return new TextEncoder().encode(secret);
}

/** `sv` = version de session de l'utilisateur : un changement de mot de passe invalide les anciens jetons. */
export async function signSession(userId: number, sessionVersion: number): Promise<string> {
  return new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(secretKey());
}

/** Renvoie l'utilisateur et la version de session, ou null si le jeton est absent, invalide ou expiré. */
export async function verifySession(token: string | undefined): Promise<{ userId: number; sessionVersion: number } | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const userId = Number(payload.sub);
    const sessionVersion = Number(payload.sv);
    return Number.isInteger(userId) && userId > 0 && Number.isInteger(sessionVersion) ? { userId, sessionVersion } : null;
  } catch {
    return null;
  }
}

export async function createSession(userId: number, sessionVersion: number): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE, await signSession(userId, sessionVersion), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function deleteSession(): Promise<void> {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

// ─── Étape intermédiaire de la double authentification (EF-AUT-05) ───────────

const PENDING_COOKIE = "fcf_2fa";
const PENDING_TTL_SECONDS = 5 * 60;

/** Mot de passe vérifié, code à usage unique attendu : jeton court, sans accès à l'espace fédéral. */
export async function createPendingTwoFactor(userId: number, sessionVersion: number): Promise<void> {
  const token = await new SignJWT({ sv: sessionVersion, purpose: "2fa" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${PENDING_TTL_SECONDS}s`)
    .sign(secretKey());
  (await cookies()).set(PENDING_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/connexion",
    maxAge: PENDING_TTL_SECONDS,
  });
}

export async function readPendingTwoFactor(): Promise<{ userId: number; sessionVersion: number } | null> {
  const token = (await cookies()).get(PENDING_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    if (payload.purpose !== "2fa") return null;
    return { userId: Number(payload.sub), sessionVersion: Number(payload.sv) };
  } catch {
    return null;
  }
}

export async function deletePendingTwoFactor(): Promise<void> {
  (await cookies()).delete({ name: PENDING_COOKIE, path: "/connexion" });
}

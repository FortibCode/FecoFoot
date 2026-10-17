import "server-only";
import { eq } from "drizzle-orm";
import { jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { db } from "@/lib/db";
import { supporters } from "@/lib/db/schema";

/**
 * Session supporter (Fan ID), distincte de la session de l'espace fédéral (§8.1) :
 * cookie et audience propres, un jeton de l'un n'ouvre jamais l'autre.
 */
const FAN_COOKIE = "fcf_fan";
const FAN_TTL_SECONDS = 30 * 24 * 60 * 60;
const AUDIENCE = "fecofoot-supporter";

function secretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) throw new Error("AUTH_SECRET doit être défini et faire au moins 32 caractères.");
  return new TextEncoder().encode(secret);
}

export async function createFanSession(supporterId: number, sessionVersion: number): Promise<void> {
  const token = await new SignJWT({ sv: sessionVersion })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(supporterId))
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${FAN_TTL_SECONDS}s`)
    .sign(secretKey());
  (await cookies()).set(FAN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: FAN_TTL_SECONDS,
  });
}

export async function deleteFanSession(): Promise<void> {
  (await cookies()).delete(FAN_COOKIE);
}

export const getCurrentSupporter = cache(async () => {
  const token = (await cookies()).get(FAN_COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"], audience: AUDIENCE });
    const [s] = await db.select().from(supporters).where(eq(supporters.id, Number(payload.sub))).limit(1);
    return s && s.sessionVersion === Number(payload.sv) ? s : null;
  } catch {
    return null;
  }
});

export async function requireSupporter() {
  const s = await getCurrentSupporter();
  if (!s) redirect("/supporters/connexion");
  return s;
}

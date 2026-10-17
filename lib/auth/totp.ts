import { createHmac, randomBytes } from "node:crypto";

/**
 * Codes à usage unique basés sur le temps (TOTP, RFC 6238) — compatibles avec
 * Google Authenticator, Microsoft Authenticator, FreeOTP… (EF-AUT-05).
 */

export const TOTP_PERIOD = 30;
export const TOTP_DIGITS = 6;
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of bytes) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Secret base32 invalide.");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

/** Code HOTP (RFC 4226) pour un compteur donné. */
export function hotp(secret: string, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", Buffer.from(base32Decode(secret))).update(buf).digest();
  const offset = mac[mac.length - 1] & 0xf;
  const code = (mac.readUInt32BE(offset) & 0x7fffffff) % 10 ** TOTP_DIGITS;
  return String(code).padStart(TOTP_DIGITS, "0");
}

export const totpStep = (at: Date = new Date()) => Math.floor(at.getTime() / 1000 / TOTP_PERIOD);
export const totp = (secret: string, at: Date = new Date()) => hotp(secret, totpStep(at));

/**
 * Vérifie un code, en tolérant un pas de décalage d'horloge (±30 s).
 * Renvoie le pas utilisé, ou null. Un pas déjà consommé est refusé (pas de rejeu).
 */
export function verifyTotp(secret: string, code: string, opts: { at?: Date; lastStep?: number | null } = {}): number | null {
  const clean = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return null;
  const now = totpStep(opts.at);
  for (const step of [now, now - 1, now + 1]) {
    if (opts.lastStep != null && step <= opts.lastStep) continue;
    if (hotp(secret, step) === clean) return step;
  }
  return null;
}

/** Lien à scanner par l'application d'authentification. */
export function otpauthUri(secret: string, account: string, issuer = "FECOFOOT"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_PERIOD}`;
}

/**
 * Profils pour lesquels la double authentification est obligatoire (EF-AUT-05 : profils fédéraux
 * et billetterie). Réglable par TWO_FACTOR_REQUIRED_ROLES (liste séparée par des virgules, vide = aucun).
 */
export const DEFAULT_TWO_FACTOR_ROLES = "SUPER_ADMIN,FEDERATION_ADMIN,TICKETING";

export function twoFactorRequired(role: string, setting = process.env.TWO_FACTOR_REQUIRED_ROLES ?? DEFAULT_TWO_FACTOR_ROLES): boolean {
  const roles = setting.split(",").map((r) => r.trim()).filter(Boolean);
  return roles.includes(role);
}

import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { deleteCookie, getCookie, setCookie } from "@tanstack/react-start/server";
import { sql } from "./db.server";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;
const COOKIE = "anchor_session";
const SESSION_DAYS = 30;

export async function hashPassword(pw: string) {
  const salt = randomBytes(16);
  const key = await scrypt(pw, salt, 64);
  return `scrypt$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function verifyPassword(pw: string, stored: string) {
  const [alg, s, k] = stored.split("$");
  if (alg !== "scrypt" || !s || !k) return false;
  const key = await scrypt(pw, Buffer.from(s, "base64"), 64);
  const want = Buffer.from(k, "base64");
  return want.length === key.length && timingSafeEqual(want, key);
}

const tokenId = (token: string) => createHash("sha256").update(token).digest("hex");

export async function startSession(userId: string, orgId: string | null) {
  const db = await sql();
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await db`insert into sessions (id, user_id, org_id, expires_at) values (${tokenId(token)}, ${userId}, ${orgId}, ${expires})`;
  setCookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endSession() {
  const token = getCookie(COOKIE);
  if (token) {
    const db = await sql();
    await db`delete from sessions where id = ${tokenId(token)}`;
  }
  deleteCookie(COOKIE, { path: "/" });
}

export type SessionUser = {
  sessionId: string;
  orgId: string | null;
  user: { id: string; email: string; name: string; phone: string | null; is_platform_admin: boolean };
};

export async function readSession(): Promise<SessionUser | null> {
  const token = getCookie(COOKIE);
  if (!token) return null;
  const db = await sql();
  const id = tokenId(token);
  const [row] = await db<
    { org_id: string | null; uid: string; email: string; name: string; phone: string | null; is_platform_admin: boolean }[]
  >`
    select s.org_id, u.id as uid, u.email, u.name, u.phone, u.is_platform_admin
    from sessions s join users u on u.id = s.user_id
    where s.id = ${id} and s.expires_at > now()`;
  if (!row) return null;
  return {
    sessionId: id,
    orgId: row.org_id,
    user: { id: row.uid, email: row.email, name: row.name, phone: row.phone, is_platform_admin: row.is_platform_admin },
  };
}

export async function setSessionOrg(sessionId: string, orgId: string) {
  const db = await sql();
  await db`update sessions set org_id = ${orgId} where id = ${sessionId}`;
}

/* Tiny in-memory throttle for sign-in attempts (per email, per server instance). */
const attempts = new Map<string, { n: number; until: number }>();
export function checkThrottle(key: string) {
  const a = attempts.get(key);
  if (a && a.until > Date.now() && a.n >= 6) throw new Error("Too many attempts. Wait a few minutes and try again.");
}
export function noteFailure(key: string) {
  const a = attempts.get(key);
  const until = Date.now() + 10 * 60_000;
  attempts.set(key, { n: a && a.until > Date.now() ? a.n + 1 : 1, until });
}
export function clearFailures(key: string) {
  attempts.delete(key);
}

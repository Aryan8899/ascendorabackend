import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { VercelRequest, VercelResponse } from "@vercel/node";

const TTL_MS = 12 * 60 * 60 * 1000; // admin login 12 ghante valid
const secret = () => process.env.ADMIN_SECRET || "";

export function safeEqual(a: string, b: string) {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

const sign = (payload: string) =>
  createHmac("sha256", secret()).update(payload).digest("base64url");

export function signToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + TTL_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function verify(token: string) {
  const [payload, sig] = token.split(".");
  if (!payload || !sig || !secret()) return false;
  if (!safeEqual(sig, sign(payload))) return false;
  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString());
    return typeof exp === "number" && exp > Date.now();
  } catch {
    return false;
  }
}

export function requireAdmin(req: VercelRequest, res: VercelResponse): boolean {
  const h = String(req.headers.authorization || "");
  const t = h.startsWith("Bearer ") ? h.slice(7) : "";
  if (t && verify(t)) return true;
  res.status(401).json({ ok: false, error: "Unauthorized" });
  return false;
}

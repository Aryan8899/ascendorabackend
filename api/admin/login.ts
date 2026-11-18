import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../../lib/cors";
import { safeEqual, signToken } from "../../lib/auth";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const user = process.env.ADMIN_USER || "";
  const pass = process.env.ADMIN_PASSWORD || "";
  if (!user || !pass || !process.env.ADMIN_SECRET) {
    console.error("ADMIN_USER / ADMIN_PASSWORD / ADMIN_SECRET not set");
    return res.status(500).json({ ok: false, error: "Server not configured" });
  }

  const body = (typeof req.body === "object" && req.body) || {};
  const u = String(body.username || "");
  const p = String(body.password || "");

  if (safeEqual(u, user) && safeEqual(p, pass)) {
    return res.status(200).json({ ok: true, token: signToken() });
  }

  // brute-force thoda slow karne ke liye
  await new Promise((r) => setTimeout(r, 500));
  return res.status(401).json({ ok: false, error: "Wrong username or password" });
}

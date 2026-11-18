import type { VercelRequest, VercelResponse } from "@vercel/node";

export function setCors(req: VercelRequest, res: VercelResponse, methods: string) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  const origin = String(req.headers.origin || "");
  const list = allowed.split(",").map((s) => s.trim());
  const allowOrigin =
    allowed === "*" ? "*" : list.includes(origin) ? origin : list[0];
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Vary", "Origin");
  res.setHeader("Cache-Control", "no-store");
}

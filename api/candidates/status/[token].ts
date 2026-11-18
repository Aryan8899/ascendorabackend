import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../../../lib/cors";
import { supabase } from "../../../lib/supabase";

// Public route: sirf status, reason aur ref. Koi personal data nahi.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res, "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });

  const token = String(req.query.token || "");
  if (!/^[\w-]{20,64}$/.test(token)) {
    return res.status(404).json({ ok: false, error: "Not found" });
  }

  try {
    const { data, error } = await supabase
      .from("candidates")
      .select("status, reject_reason, ref")
      .eq("token", token)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ ok: false, error: "Not found" });

    return res.status(200).json({
      ok: true,
      status: data.status,
      reason: data.reject_reason || undefined,
      ref: data.ref,
    });
  } catch (err) {
    console.error("Status error:", err);
    return res.status(500).json({ ok: false, error: "Could not load status" });
  }
}

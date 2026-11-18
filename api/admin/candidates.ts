import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../../lib/cors";
import { requireAdmin } from "../../lib/auth";
import { supabase, BUCKET } from "../../lib/supabase";

const STATUSES = ["PENDING", "APPROVED", "REJECTED"];

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res, "GET, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  try {
    const status = String(req.query.status || "");

    let q = supabase
      .from("candidates")
      .select(
        "id, ref, name, education, exp, location, notice, domain, phone, email, linkedin, source, utr, resume_path, screenshot_path, status, reject_reason, created_at, reviewed_at"
      )
      .order("created_at", { ascending: false })
      .limit(300);
    if (STATUSES.includes(status)) q = q.eq("status", status);

    const { data, error } = await q;
    if (error) throw error;
    const rows = data || [];

    // Private files ke liye 1 ghante wale signed links
    const paths = rows.flatMap((r) => [r.resume_path, r.screenshot_path]);
    const urlOf = new Map<string, string>();
    if (paths.length) {
      const { data: signed, error: sErr } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, 3600);
      if (sErr) throw sErr;
      (signed || []).forEach((s) => s.path && urlOf.set(s.path, s.signedUrl));
    }

    const candidates = rows.map((r) => ({
      id: r.id,
      ref: r.ref,
      name: r.name,
      education: r.education,
      exp: r.exp,
      location: r.location,
      notice: r.notice,
      domain: r.domain,
      phone: r.phone,
      email: r.email,
      linkedin: r.linkedin,
      source: r.source,
      utr: r.utr,
      status: r.status,
      rejectReason: r.reject_reason,
      createdAt: r.created_at,
      reviewedAt: r.reviewed_at,
      resumeUrl: urlOf.get(r.resume_path) || null,
      screenshotUrl: urlOf.get(r.screenshot_path) || null,
    }));

    return res.status(200).json({ ok: true, candidates });
  } catch (err) {
    console.error("Admin list error:", err);
    return res.status(500).json({ ok: false, error: "Could not load candidates" });
  }
}

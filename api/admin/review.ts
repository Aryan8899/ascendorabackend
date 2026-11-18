import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../../lib/cors";
import { requireAdmin } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { sendApproved, sendRejected } from "../../lib/mail";

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const body = (typeof req.body === "object" && req.body) || {};
  const id = String(body.id || "");
  const action = String(body.action || "");
  const reason = String(body.reason || "").trim().slice(0, 300);

  if (!id || !["approve", "reject"].includes(action)) {
    return res.status(400).json({ ok: false, error: "Invalid request" });
  }
  if (action === "reject" && !reason) {
    return res.status(400).json({ ok: false, error: "Reject reason is required" });
  }

  try {
    // Sirf PENDING wali row badalti hai, to double-click pe dobara mail nahi jayegi
    const { data, error } = await supabase
      .from("candidates")
      .update({
        status: action === "approve" ? "APPROVED" : "REJECTED",
        reject_reason: action === "reject" ? reason : null,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", id)
      .eq("status", "PENDING")
      .select("name, email, ref, token")
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(409).json({ ok: false, error: "Already reviewed or not found" });

    try {
      if (action === "approve") await sendApproved(data);
      else await sendRejected({ ...data, reason });
    } catch (mailErr) {
      console.error("Mail error:", mailErr); // status save ho chuka hai
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("Review error:", err);
    return res.status(500).json({ ok: false, error: "Could not update" });
  }
}
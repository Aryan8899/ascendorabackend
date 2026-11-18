import type { VercelRequest, VercelResponse } from "@vercel/node";
import { setCors } from "../../../lib/cors";
import { requireAdmin } from "../../../lib/auth";
import { supabase } from "../../../lib/supabase";
import { sendApproved, sendRejected } from "../../../lib/mail";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// PATCH body: { action: "approve" } ya { action: "reject", reason: "..." }
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res, "PATCH, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "PATCH") return res.status(405).json({ ok: false, error: "Method not allowed" });
  if (!requireAdmin(req, res)) return;

  const id = String(req.query.id || "");
  if (!UUID.test(id)) return res.status(400).json({ ok: false, error: "Invalid id" });

  const body = (typeof req.body === "object" && req.body) || {};
  const action = String(body.action || "");
  const reason = String(body.reason || "").trim().slice(0, 300);

  if (action !== "approve" && action !== "reject") {
    return res.status(400).json({ ok: false, error: "action must be approve or reject" });
  }
  if (action === "reject" && reason.length < 3) {
    return res.status(400).json({ ok: false, error: "Please give a reason for rejection" });
  }

  try {
    // Sirf PENDING wali entry change hoti hai, taaki double email na jaye
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
    if (!data) {
      return res.status(409).json({ ok: false, error: "Already reviewed, or not found" });
    }

    let emailSent = true;
    try {
      if (action === "approve") await sendApproved(data);
      else await sendRejected({ ...data, reason });
    } catch (mailErr) {
      emailSent = false;
      console.error("Decision mail error:", mailErr);
    }

    return res.status(200).json({
      ok: true,
      status: action === "approve" ? "APPROVED" : "REJECTED",
      emailSent,
    });
  } catch (err) {
    console.error("Admin update error:", err);
    return res.status(500).json({ ok: false, error: "Could not update" });
  }
}

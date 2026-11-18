import type { VercelRequest, VercelResponse } from "@vercel/node";
import { randomBytes, randomUUID } from "crypto";
import { setCors } from "../lib/cors";
import { parseForm, MAX_RESUME, MAX_SHOT } from "../lib/parseForm";
import { supabase, BUCKET } from "../lib/supabase";
import { sendSubmissionEmails } from "../lib/mail";

export const config = {
  api: {
    bodyParser: false,
  },
};

const RESUME_TYPES: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

const safeName = (n: string) => n.replace(/[^\w.\-]+/g, "_").slice(-80);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCors(req, res, "POST, OPTIONS");

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });

  try {
    const { fields: f, files } = await parseForm(req);
    const get = (k: string) => f[k] || "";
    const resume = files.resume;
    const shot = files.paymentScreenshot;
    const utr = get("utr");

    // ---- validation ----
    if (!get("name") || !get("email") || !get("phone")) {
      return res.status(400).json({ ok: false, error: "Missing fields" });
    }
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(get("email"))) {
      return res.status(400).json({ ok: false, error: "Invalid email" });
    }
    if (!/^\d{12}$/.test(utr)) {
      return res.status(400).json({ ok: false, error: "Enter a valid 12-digit UTR" });
    }
    const ext = resume ? (resume.name.split(".").pop() || "").toLowerCase() : "";
    if (!resume || !RESUME_TYPES[ext]) {
      return res.status(400).json({ ok: false, error: "Please upload a PDF or DOC/DOCX resume" });
    }
    if (resume.truncated || resume.data.length > MAX_RESUME) {
      return res.status(413).json({ ok: false, error: "Resume must be under 2 MB" });
    }
    if (!shot || !/^image\/(png|jpe?g|webp)$/i.test(shot.mime)) {
      return res.status(400).json({ ok: false, error: "Please upload a payment screenshot (PNG, JPG or WEBP)" });
    }
    if (shot.truncated || shot.data.length > MAX_SHOT) {
      return res.status(413).json({ ok: false, error: "Screenshot must be under 1.5 MB" });
    }

    // ---- duplicate UTR (sirf active entries: PENDING / APPROVED) ----
    const dup = await supabase
      .from("candidates")
      .select("id")
      .eq("utr", utr)
      .neq("status", "REJECTED")
      .limit(1);
    if (dup.error) throw dup.error;
    if (dup.data && dup.data.length) {
      return res.status(409).json({ ok: false, error: "This UTR has already been used" });
    }

    // ---- upload files (private bucket) ----
    const id = randomUUID();
    const resumePath = `${id}/resume-${safeName(resume.name)}`;
    const shotPath = `${id}/payment-${safeName(shot.name || "screenshot.jpg")}`;
    const storage = supabase.storage.from(BUCKET);

    const up1 = await storage.upload(resumePath, resume.data, { contentType: RESUME_TYPES[ext] });
    if (up1.error) throw up1.error;
    const up2 = await storage.upload(shotPath, shot.data, { contentType: shot.mime });
    if (up2.error) {
      await storage.remove([resumePath]);
      throw up2.error;
    }

    // ---- save as PENDING ----
    const token = randomBytes(24).toString("base64url");
    const ref = `ASC-${randomBytes(4).toString("hex").toUpperCase()}`;

    const ins = await supabase.from("candidates").insert({
      id,
      token,
      ref,
      name: get("name"),
      education: get("education"),
      exp: get("exp"),
      location: get("location"),
      notice: get("notice"),
      domain: get("domain"),
      phone: get("phone"),
      email: get("email"),
      linkedin: get("linkedin"),
      source: get("source"),
      utr,
      resume_path: resumePath,
      screenshot_path: shotPath,
    });

    if (ins.error) {
      await storage.remove([resumePath, shotPath]);
      // 23505 = unique violation (kisi ne same time pe wahi UTR bheja)
      if (ins.error.code === "23505") {
        return res.status(409).json({ ok: false, error: "This UTR has already been used" });
      }
      throw ins.error;
    }

    // ---- emails (fail ho jaye toh bhi submission save hai) ----
    await sendSubmissionEmails({
      fields: f,
      ref,
      token,
      files: [
        { name: resume.name, data: resume.data },
        { name: shot.name || "payment-screenshot.jpg", data: shot.data },
      ],
    });

    return res.status(200).json({ ok: true, token, ref });
  } catch (err) {
    console.error("Submit error:", err);
    const detail =
      process.env.VERCEL_ENV === "production"
        ? undefined
        : err instanceof Error
          ? err.message
          : JSON.stringify(err);
    return res.status(500).json({ ok: false, error: "Could not submit. Please try again.", detail });
  }
}

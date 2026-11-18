import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export const runtime = "nodejs";
export const maxDuration = 30;

// Vercel serverless request body limit is ~4.5 MB, so keep files under 4 MB.
const MAX_SIZE = 4 * 1024 * 1024;

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function corsHeaders(req: Request) {
  const allowed = process.env.ALLOWED_ORIGIN || "*";
  const origin = req.headers.get("origin") || "";
  const allowOrigin =
    allowed === "*" ? "*" : origin === allowed || origin === allowed.replace("://", "://www.") ? origin : allowed;
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

export async function OPTIONS(req: Request) {
  return new NextResponse(null, { status: 204, headers: corsHeaders(req) });
}

export async function POST(req: Request) {
  const headers = corsHeaders(req);
  const fail = (error: string, status: number) =>
    NextResponse.json({ ok: false, error }, { status, headers });

  try {
    const fd = await req.formData();
    const get = (k: string) => String(fd.get(k) ?? "").trim();

    const name = get("name");
    const email = get("email");
    const phone = get("phone");
    const resume = fd.get("resume");

    if (!name || !email || !phone) return fail("Missing fields", 400);
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Invalid email", 400);
    if (!(resume instanceof File) || !/\.(pdf|docx?)$/i.test(resume.name)) {
      return fail("Please upload a PDF or DOC/DOCX resume", 400);
    }
    if (resume.size > MAX_SIZE) return fail("Resume must be under 4 MB", 413);

    const pick = (k: string) =>
      get(k) === "Other" ? `Other: ${get(k + "Other")}` : get(k);

    const rows: [string, string][] = [
      ["Full Name", name],
      ["Education", get("education")],
      ["Experience", get("exp")],
      ["Location", get("location")],
      ["Notice Period", pick("notice")],
      ["Domain", pick("domain")],
      ["Phone", phone],
      ["Email", email],
      ["LinkedIn", get("linkedin")],
      ["Found via", pick("source")],
    ];

    const html = `
      <h2>New candidate registration</h2>
      <table cellpadding="8" style="border-collapse:collapse;font-family:Arial,sans-serif">
        ${rows
          .map(
            ([k, v]) =>
              `<tr><td style="border:1px solid #ddd"><b>${k}</b></td><td style="border:1px solid #ddd">${esc(v)}</td></tr>`
          )
          .join("")}
      </table>`;

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });

    await transporter.sendMail({
      from: `"Ascendora Form" <${process.env.SMTP_USER}>`,
      to: process.env.TO_EMAIL,
      replyTo: email,
      subject: `New Candidate: ${name} (${pick("domain")})`,
      html,
      attachments: [
        { filename: resume.name, content: Buffer.from(await resume.arrayBuffer()) },
      ],
    });

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    console.error("Mail error:", err);
    return fail("Could not send. Please try again.", 500);
  }
}

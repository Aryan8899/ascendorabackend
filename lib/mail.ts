import nodemailer from "nodemailer";

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Ek baar banta hai (cold start pe), har request pe nahi
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
function tx() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: false,
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

const FROM = () => `"Ascendora Talent Solutions" <${process.env.SMTP_USER}>`;
const statusUrl = (token: string) =>
  `${(process.env.FRONTEND_URL || "").replace(/\/$/, "")}/status/${token}`;

const wrap = (title: string, body: string) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#1e293b;line-height:1.55">
    <h2 style="color:#14284f;margin:0 0 12px">${title}</h2>
    ${body}
    <p style="margin-top:28px;color:#64748b;font-size:13px">Ascendora Talent Solutions</p>
  </div>`;

const button = (href: string, label: string) =>
  `<p><a href="${href}" style="display:inline-block;background:#14284f;color:#fff;text-decoration:none;padding:12px 22px;border-radius:8px;font-weight:600">${label}</a></p>`;

type Person = { name: string; email: string; ref: string; token: string };

export async function sendSubmissionEmails(args: {
  fields: Record<string, string>;
  ref: string;
  token: string;
  files: { name: string; data: Buffer }[];
}) {
  const { fields: f, ref, token, files } = args;

  const rows: [string, string][] = [
    ["Reference", ref],
    ["Full Name", f.name],
    ["Education", f.education],
    ["Experience", f.exp],
    ["Location", f.location],
    ["Notice Period", f.notice],
    ["Domain", f.domain],
    ["Phone", f.phone],
    ["Email", f.email],
    ["LinkedIn", f.linkedin],
    ["Found via", f.source],
    ["UTR", f.utr],
  ];

  const adminHtml = wrap(
    "New registration: payment pending",
    `<p>Check the UTR in your bank / GPay statement, then approve or reject in the admin panel.</p>
     <table cellpadding="8" style="border-collapse:collapse;font-size:14px">
       ${rows
         .map(
           ([k, v]) =>
             `<tr><td style="border:1px solid #ddd"><b>${k}</b></td><td style="border:1px solid #ddd">${esc(v || "-")}</td></tr>`
         )
         .join("")}
     </table>`
  );

  const userHtml = wrap(
    "We received your details",
    `<p>Hi ${esc(f.name)},</p>
     <p>Thank you for registering. We are verifying your payment and will email you once it is confirmed.</p>
     <p>Your reference: <b>${esc(ref)}</b></p>
     ${button(statusUrl(token), "Check status")}`
  );

  const results = await Promise.allSettled([
    tx().sendMail({
      from: FROM(),
      to: process.env.TO_EMAIL,
      replyTo: f.email,
      subject: `New Candidate (payment pending): ${f.name} (${f.domain})`,
      html: adminHtml,
      attachments: files.map((x) => ({ filename: x.name, content: x.data })),
    }),
    tx().sendMail({
      from: FROM(),
      to: f.email,
      subject: "We received your details | Ascendora Talent Solutions",
      html: userHtml,
    }),
  ]);
  results.forEach((r) => r.status === "rejected" && console.error("Mail error:", r.reason));
}

export async function sendApproved(p: Person) {
  await tx().sendMail({
    from: FROM(),
    to: p.email,
    subject: "Form submitted and payment verified | Ascendora Talent Solutions",
    html: wrap(
      "Form submitted",
      `<p>Hi ${esc(p.name)},</p>
       <p>Your payment is verified and your registration is confirmed. Our team will reach out when a suitable role comes up.</p>
       <p>Reference: <b>${esc(p.ref)}</b></p>
       ${button(statusUrl(p.token), "View status")}`
    ),
  });
}

export async function sendRejected(p: Person & { reason: string }) {
  await tx().sendMail({
    from: FROM(),
    to: p.email,
    subject: "Payment could not be verified | Ascendora Talent Solutions",
    html: wrap(
      "Payment could not be verified",
      `<p>Hi ${esc(p.name)},</p>
       <p>We could not verify your payment.</p>
       <p><b>Reason:</b> ${esc(p.reason)}</p>
       <p>Please register again with the correct payment details.</p>
       <p>Reference: <b>${esc(p.ref)}</b></p>
       ${button((process.env.FRONTEND_URL || "").replace(/\/$/, "") + "/", "Register again")}`
    ),
  });
}

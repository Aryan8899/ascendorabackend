import type { VercelRequest } from "@vercel/node";
import Busboy from "busboy";

// Vercel ka total request body limit ~4.5 MB hai.
// Resume (2 MB) + screenshot (1.5 MB) = 3.5 MB, multipart overhead ke saath safe.
export const MAX_RESUME = 2 * 1024 * 1024;
export const MAX_SHOT = 1.5 * 1024 * 1024;

export type UploadedFile = { name: string; mime: string; data: Buffer; truncated: boolean };
export type Parsed = {
  fields: Record<string, string>;
  files: Record<string, UploadedFile>;
};

export function parseForm(req: VercelRequest): Promise<Parsed> {
  return new Promise((resolve, reject) => {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_RESUME, files: 2, fields: 30 },
    });
    const out: Parsed = { fields: {}, files: {} };

    bb.on("field", (name, val) => {
      out.fields[name] = String(val).trim().slice(0, 300);
    });

    bb.on("file", (name, stream, info) => {
      const filename = info.filename;
      if (!filename) {
        stream.resume();
        return;
      }
      const chunks: Buffer[] = [];
      let truncated = false;
      stream.on("data", (c: Buffer) => chunks.push(c));
      stream.on("limit", () => (truncated = true));
      stream.on("close", () => {
        out.files[name] = {
          name: filename,
          mime: info.mimeType || "",
          data: Buffer.concat(chunks),
          truncated,
        };
      });
    });
    bb.on("error", reject);
    bb.on("close", () => resolve(out));
    req.pipe(bb);
  });
}

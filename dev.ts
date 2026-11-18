import http from "http";
import candidates from "./api/candidates";
import status from "./api/candidates/status/[token]";
import adminLogin from "./api/admin/login";
import adminCandidates from "./api/admin/candidates";
import adminReview from "./api/admin/review";

http
  .createServer(async (req, res) => {
    const r: any = res;
    const q: any = req;

    r.status = (c: number) => {
      res.statusCode = c;
      return r;
    };
    r.json = (o: any) => {
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify(o));
      return r;
    };

    const url = new URL(req.url || "/", "http://localhost");
    q.query = Object.fromEntries(url.searchParams);
    const path = url.pathname.replace(/\/$/, "");

    // JSON body padho (login ke liye). Multipart ko haath nahi lagate.
    const ct = String(req.headers["content-type"] || "");
    if (ct.includes("application/json")) {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      try {
        q.body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
      } catch {
        q.body = {};
      }
    }

    try {
      const m = path.match(/^\/api\/candidates\/status\/([^/]+)$/);
      if (m) {
        q.query.token = m[1];
        return await status(q, r);
      }
      if (path === "/api/candidates") return await candidates(q, r);
      if (path === "/api/admin/login") return await adminLogin(q, r);
      if (path === "/api/admin/candidates") return await adminCandidates(q, r);
      if (path === "/api/admin/review") return await adminReview(q, r);
      res.statusCode = 404;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
    } catch (e) {
      console.error(e);
      res.statusCode = 500;
      res.end("error");
    }
  })
  .listen(4000, () => console.log("Backend: http://localhost:4000"));
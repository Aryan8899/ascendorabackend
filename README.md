# Ascendora Backend

Receives candidate form submissions and emails the details + resume.

**Endpoint:** `POST /api/candidates` (multipart/form-data)

## Env variables
See `.env.example`. Add the same variables in Vercel -> Project -> Settings -> Environment Variables.

## Run locally
```
npm install
cp .env.example .env.local   # then fill SMTP_PASS
npm run dev
```

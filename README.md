# Chadrey Wholesale

A quote-based B2B wholesale ordering site. No fixed prices — customers pick a product and
preferences, request a quote, and receive three separate documents as the order progresses:
**Quote Request → Quotation → Invoice**.

## Structure

```
frontend/       Static click-through prototype (HTML/CSS/vanilla JS, fake data — no backend yet)
worker/         Cloudflare Worker API scaffold (KV storage, quote/quotation/invoice endpoints)
apps-script/    Google Apps Script web app that sends SMTP email notifications via Gmail
```

## Current status

`frontend/` is a working click-through prototype with hardcoded sample data — good for
reviewing flow and design, not yet wired to anything real. `worker/` and `apps-script/` are
starter scaffolds for the planned backend (see below) — not deployed yet.

## Planned architecture

- **Cloudflare Pages** — hosts `frontend/` (or a rebuilt version of it once the API is live).
- **Cloudflare Worker** (`worker/`) — the API. Handles quote request submission, stores
  records in Workers KV, and exposes admin endpoints to attach a quotation and later an
  invoice to each request.
- **Google Apps Script** (`apps-script/`) — deployed as a Web App, called by the Worker
  whenever something needs to email the customer or admin (new request received, quotation
  sent, invoice sent). Uses Gmail's `MailApp` service, so no separate SMTP credentials needed
  beyond a Google account.

### Setting it up

1. **Apps Script**
   - Create a new Apps Script project, paste in `apps-script/Code.gs`.
   - Set `ADMIN_EMAIL` at the top to the real inbox.
   - Project Settings → Script Properties → add `SHARED_SECRET` (any random string).
   - Deploy → New deployment → type "Web app" → Execute as **Me** → Who has access **Anyone**.
   - Copy the resulting `/exec` URL.

2. **Cloudflare Worker**
   - `cd worker && npx wrangler kv namespace create QUOTES`, paste the returned id into
     `wrangler.toml`.
   - `npx wrangler secret put APPS_SCRIPT_WEBHOOK_URL` → paste the Apps Script `/exec` URL.
   - `npx wrangler secret put APPS_SCRIPT_SHARED_SECRET` → same value as `SHARED_SECRET` above.
   - `npx wrangler secret put ADMIN_TOKEN` → any random string, used to gate `/api/admin/*`.
   - `npx wrangler deploy`.

3. **Frontend**
   - Currently reads hardcoded data from `frontend/data.js`. Once the Worker is deployed,
     replace the fake-submit logic in `request-quote.html` with a real `fetch()` POST to
     `https://<your-worker>.workers.dev/api/quote-requests`, and have `my-quotes.html` /
     `quotation.html` / `invoice.html` fetch real records instead of the `FAKE_QUOTES` array.
   - Deploy via Cloudflare Pages (connect this repo, build command: none, output directory:
     `frontend`).

## Not yet built

Real customer auth (My Quotes is currently unguarded), payment processing, a proper admin UI
(the `admin.html` cost-entry form is disabled/illustrative only), and PDF generation for the
quotation/invoice documents.

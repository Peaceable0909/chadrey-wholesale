# Chadrey Wholesale

A mobile-first (iPhone-style) wholesale catalogue for goods sourced from Thai dealers. Like 1688,
products have a **minimum order** and **cheaper prices for bigger quantities** — but prices aren't
fixed: customers see *today's* price, request a quote, and receive three documents as the order
progresses: **Quote Request → Quotation → Invoice**.

## What's in the repo

```
frontend/       The website (plain HTML/CSS/JS, no build step) — customer shop + owner admin
worker/         Cloudflare Worker API (products, photos, quotes) — stores everything in Workers KV
apps-script/    Optional Google Apps Script that sends email notifications via Gmail
```

### Pages

| Page | For | What it does |
| --- | --- | --- |
| `index.html` | customers | Home: search, categories, new arrivals |
| `products.html` | customers | Browse with search, category filter, sort |
| `product.html` | customers | Photos, quantity price tiers, live total, request quote / WhatsApp |
| `request-quote.html` | customers | Quote form → `confirmation.html` |
| `my-quotes.html`, `quotation.html`, `invoice.html` | customers | Track and accept quotes, view/print invoices |
| `more.html`, `how-it-works.html`, `contact.html` | customers | Info and contact |
| **`admin.html`** | **you** | **Add dealer products + photos + prices, quotes/invoices, settings** |

## Try it right now (demo mode)

Open `frontend/index.html` through any static server (e.g. `cd frontend && python3 -m http.server`).
With `apiBase` empty in `frontend/config.js` everything is stored **in your browser only**: open
**More → Manage products & prices** and you can add products, photos and prices, and run a quote
through to an invoice. Nothing is shared with other people until you connect the API below.

## Adding products and prices (admin)

1. Open **More → Manage products & prices** (`admin.html`).
2. Tap **+ Add**: photos, name, category, description.
3. **Price (Thai baht)**: price per unit at the minimum order, plus optional **bulk price breaks**
   (e.g. 200+ pcs → ฿115, 500+ pcs → ฿99).
4. Fill **Dealer name / contact** under *Private* — customers never see it.
5. **Prices change often**, so you have two tools:
   - Edit a product's price any time (the shop shows "price updated <date>").
   - **Settings → Change all prices** moves *every* price up/down by a percentage when the
     exchange rate or dealer prices shift.
6. **Settings → show prices in your customers' currency**: enter e.g. `NGN`, `₦` and how many
   naira equal ฿1; customers then also see "≈ ₦4,950" under each price.

## Going live (so customers see your products)

### 1. Worker API

```bash
cd worker
npx wrangler kv namespace create QUOTES          # paste the returned id into wrangler.toml
npx wrangler secret put ADMIN_TOKEN              # your owner access code — long and random
npx wrangler deploy                              # prints https://chadrey-wholesale-api.<you>.workers.dev
```

### 2. Point the website at it

Edit `frontend/config.js`:

```js
window.CHADREY_CONFIG = { apiBase: "https://chadrey-wholesale-api.<you>.workers.dev" };
```

Then deploy `frontend/` (Cloudflare Pages: no build command, output directory `frontend`; or the
included GitHub Pages workflow, which serves the site at `/frontend/`). Open `admin.html`, enter your
`ADMIN_TOKEN` as the access code, and add your products.

### 3. (Optional) Email notifications

1. Create an Apps Script project, paste in `apps-script/Code.gs`, set `ADMIN_EMAIL`.
2. Script Properties → add `SHARED_SECRET` (any random string).
3. Deploy → New deployment → Web app → Execute as **Me**, access **Anyone**; copy the `/exec` URL.
4. `npx wrangler secret put APPS_SCRIPT_WEBHOOK_URL` (that URL) and
   `npx wrangler secret put APPS_SCRIPT_SHARED_SECRET` (same value as `SHARED_SECRET`).

## Good to know

- Photos are shrunk in the browser before upload (≈150 KB each) and stored in KV.
- Customer quotes are remembered on their own device and can be re-opened with the reference number.
- The admin quote list shows the latest 45 requests (a Cloudflare free-plan limit on reads per request).
- The owner code is a simple shared secret — fine to start, but keep it private. Real accounts,
  payments and PDF generation aren't built yet (invoices can be printed / saved as PDF from the browser).

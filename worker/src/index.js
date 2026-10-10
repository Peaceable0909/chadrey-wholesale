/**
 * Chadrey Wholesale — API Worker
 *
 * Public
 *   GET  /api/products                       catalogue (dealer details stripped)
 *   GET  /api/products/:id
 *   GET  /api/settings                       contact + display-currency settings
 *   GET  /api/images/:key                    product photos
 *   POST /api/quote-requests                 customer submits a quote request
 *   GET  /api/quote-requests/:ref            look up one request/quotation/invoice by its reference
 *   POST /api/quote-requests/:ref/accept     customer accepts the quotation
 *
 * Admin (Authorization: Bearer ADMIN_TOKEN)
 *   GET    /api/admin/products               full catalogue incl. hidden items + dealer
 *   PUT    /api/admin/products/:id           create or update a product
 *   DELETE /api/admin/products/:id
 *   POST   /api/admin/products/adjust        { percent } raise/lower every price
 *   POST   /api/admin/images                 raw image body -> { url }
 *   GET    /api/admin/settings   PUT /api/admin/settings
 *   GET    /api/admin/quote-requests         newest first (?limit=, max 45)
 *   POST   /api/admin/quote-requests/:ref/quotation | /invoice | /paid
 *
 * Storage: one Workers KV namespace (binding QUOTES):
 *   catalog        JSON array of products        settings   JSON object
 *   img:<key>      photo bytes (+ content type)  quote-refs JSON array of refs, newest first
 *   WR-…           one quote request each
 */

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET,POST,PUT,DELETE,OPTIONS",
  "access-control-allow-headers": "content-type,authorization",
};

function json(data, status = 200, extra = {}) {
  return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", ...CORS, ...extra } });
}
const fail = (msg, status = 400) => json({ error: msg }, status);

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

/* ---------- small helpers ---------- */
function randomString(len, alphabet) {
  const bytes = crypto.getRandomValues(new Uint8Array(len));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
const newRef = () => `WR-${new Date().getFullYear()}-${randomString(8, "ABCDEFGHJKLMNPQRSTUVWXYZ23456789")}`;
const newImageKey = () => randomString(24, "abcdef0123456789");

async function readJson(request, maxBytes = 64 * 1024) {
  const text = await request.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large");
  try { return text ? JSON.parse(text) : {}; } catch (e) { throw new HttpError(400, "Invalid JSON"); }
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}
function requireAdmin(request, env) {
  if (!env.ADMIN_TOKEN) throw new HttpError(503, "ADMIN_TOKEN is not configured on the Worker");
  const auth = request.headers.get("authorization") || "";
  if (!safeEqual(auth, `Bearer ${env.ADMIN_TOKEN}`)) throw new HttpError(401, "unauthorized");
}

const str = (v, max) => String(v == null ? "" : v).trim().slice(0, max);
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const strList = (v, maxItems = 30) =>
  (Array.isArray(v) ? v : String(v || "").split(",")).map((x) => str(x, 40)).filter(Boolean).slice(0, maxItems);

async function notifyViaAppsScript(env, ctx, payload) {
  if (!env.APPS_SCRIPT_WEBHOOK_URL) return; // not configured yet, skip silently
  const send = fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    // Apps Script can't read request headers, so the shared secret travels in the body.
    body: JSON.stringify({ ...payload, secret: env.APPS_SCRIPT_SHARED_SECRET || "" }),
  }).catch(() => {}); // an email problem must never fail the request
  if (ctx && ctx.waitUntil) ctx.waitUntil(send); else await send;
}

/* ---------- products ---------- */
const IMAGE_URL = /^(\/api\/images\/[a-f0-9]{16,64}|https:\/\/[^\s"'<>]{4,500})$/;
const roundPrice = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 100) / 100);

function cleanProduct(input, id, existing) {
  const name = str(input.name, 120);
  if (!name) throw new HttpError(400, "Product name is required");
  const moq = Math.min(1_000_000, Math.max(1, Math.round(num(input.moq, 1))));
  let tiers = (Array.isArray(input.tiers) ? input.tiers : [])
    .map((t) => ({ min: Math.round(num(t && t.min)), price: num(t && t.price) }))
    .filter((t) => t.min > 0 && t.price > 0 && t.price <= 10_000_000)
    .sort((a, b) => a.min - b.min).slice(0, 10);
  if (!tiers.length) throw new HttpError(400, "A price greater than 0 is required");
  tiers[0].min = moq;
  tiers = tiers.filter((t, i) => i === 0 || t.min > tiers[i - 1].min);

  const now = new Date().toISOString();
  const sameTiers = existing && JSON.stringify(existing.tiers) === JSON.stringify(tiers);
  return {
    id,
    name,
    category: str(input.category, 40) || "Other",
    desc: str(input.desc, 2000),
    icon: str(input.icon, 20),
    images: (Array.isArray(input.images) ? input.images : []).filter((u) => typeof u === "string" && IMAGE_URL.test(u)).slice(0, 8),
    moq, unit: str(input.unit, 12) || "pc", tiers,
    origin: str(input.origin, 60), lead: str(input.lead, 40),
    colors: strList(input.colors), sizes: strList(input.sizes), packaging: strList(input.packaging), customization: strList(input.customization),
    dealer: str(input.dealer, 200), // private: stripped from every public response
    active: input.active !== false,
    createdAt: (existing && existing.createdAt) || now,
    updatedAt: now,
    priceUpdated: sameTiers ? existing.priceUpdated : now,
  };
}
const publicProduct = (p) => { const { dealer, sample, ...rest } = p; return rest; };
const localImageKeys = (p) => (p.images || []).map((u) => (u.match(/^\/api\/images\/([a-f0-9]+)$/) || [])[1]).filter(Boolean);

async function getCatalog(env) { return (await env.QUOTES.get("catalog", "json")) || []; }
const putCatalog = (env, list) => env.QUOTES.put("catalog", JSON.stringify(list));

async function dropImages(env, keys) { await Promise.all(keys.map((k) => env.QUOTES.delete("img:" + k))); }

/* ---------- settings ---------- */
const PUBLIC_SETTINGS = ["shopName", "whatsapp", "email", "displayCode", "displaySymbol", "rate"];
async function getSettings(env) { return (await env.QUOTES.get("settings", "json")) || {}; }
function cleanSettings(input) {
  return {
    shopName: str(input.shopName, 60) || "Chadrey Wholesale",
    whatsapp: str(input.whatsapp, 20).replace(/[^\d+]/g, ""),
    email: str(input.email, 120),
    paymentInfo: str(input.paymentInfo, 1000),
    displayCode: str(input.displayCode, 3).toUpperCase(),
    displaySymbol: str(input.displaySymbol, 4),
    rate: Math.max(0, num(input.rate)),
  };
}

/* ---------- quotes ---------- */
async function getQuote(env, ref) { return env.QUOTES.get(ref, "json"); }
const putQuote = (env, q) => env.QUOTES.put(q.ref, JSON.stringify(q));

function cleanQuoteRequest(b) {
  const qty = Math.round(num(b.qty));
  if (!(qty > 0)) throw new HttpError(400, "Quantity is required");
  const out = {
    productId: str(b.productId, 80), product: str(b.product, 160), qty,
    color: str(b.color, 40), sizes: strList(b.sizes), packaging: str(b.packaging, 60), customization: str(b.customization, 60),
    notes: str(b.notes, 1000), estUnitPrice: num(b.estUnitPrice), estCurrency: str(b.estCurrency, 3) || "THB",
    company: str(b.company, 120), email: str(b.email, 120), phone: str(b.phone, 40), whatsapp: str(b.whatsapp, 40), address: str(b.address, 500),
  };
  if (!out.product || !out.company || !out.email || !out.phone || !out.address) throw new HttpError(400, "Please fill in all required fields");
  return out;
}

async function listQuotes(env, limit) {
  const refs = ((await env.QUOTES.get("quote-refs", "json")) || []).slice(0, limit);
  const rows = await Promise.all(refs.map((r) => getQuote(env, r)));
  return rows.filter(Boolean);
}

/* ---------- router ---------- */
export default {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      return fail("Server error", 500);
    }
  },
};

async function route(request, env, ctx) {
  const url = new URL(request.url);
  const { pathname } = url;
  const method = request.method;
  let m;

  if (method === "OPTIONS") return new Response(null, { headers: CORS });

  /* ===== public: catalogue ===== */
  if (pathname === "/api/products" && method === "GET") {
    return json((await getCatalog(env)).filter((p) => p.active).map(publicProduct));
  }
  if ((m = pathname.match(/^\/api\/products\/([a-z0-9-]+)$/)) && method === "GET") {
    const p = (await getCatalog(env)).find((x) => x.id === m[1] && x.active);
    return p ? json(publicProduct(p)) : fail("not found", 404);
  }
  if (pathname === "/api/settings" && method === "GET") {
    const s = await getSettings(env);
    return json(Object.fromEntries(PUBLIC_SETTINGS.filter((k) => k in s).map((k) => [k, s[k]])));
  }
  if ((m = pathname.match(/^\/api\/images\/([a-f0-9]{16,64})$/)) && method === "GET") {
    const { value, metadata } = await env.QUOTES.getWithMetadata("img:" + m[1], "arrayBuffer");
    if (!value) return fail("not found", 404);
    return new Response(value, { headers: { "content-type": (metadata && metadata.type) || "image/jpeg", "cache-control": "public, max-age=31536000, immutable", ...CORS } });
  }

  /* ===== public: quotes ===== */
  if (pathname === "/api/quote-requests" && method === "POST") {
    const clean = cleanQuoteRequest(await readJson(request));
    const ref = newRef();
    // fixed fields come first-class here: a customer can never set status/quotation/invoice themselves
    const record = { ...clean, ref, status: "pending", createdAt: new Date().toISOString() };
    await putQuote(env, record);
    const refs = (await env.QUOTES.get("quote-refs", "json")) || [];
    refs.unshift(ref);
    await env.QUOTES.put("quote-refs", JSON.stringify(refs.slice(0, 2000)));
    await notifyViaAppsScript(env, ctx, { type: "quote_request_received", ref, to: record.email, record });
    return json({ ok: true, ref });
  }
  if ((m = pathname.match(/^\/api\/quote-requests\/([\w-]+)$/)) && method === "GET") {
    const q = await getQuote(env, m[1]);
    return q ? json(q) : fail("not found", 404);
  }
  if ((m = pathname.match(/^\/api\/quote-requests\/([\w-]+)\/accept$/)) && method === "POST") {
    const q = await getQuote(env, m[1]);
    if (!q) return fail("not found", 404);
    if (q.status !== "quoted") throw new HttpError(409, "There is no quotation to accept");
    if (!q.acceptedAt) {
      q.acceptedAt = new Date().toISOString();
      await putQuote(env, q);
      await notifyViaAppsScript(env, ctx, { type: "quotation_accepted", ref: q.ref, to: "", record: q });
    }
    return json({ ok: true });
  }

  /* ===== admin ===== */
  if (pathname.startsWith("/api/admin/")) {
    requireAdmin(request, env);

    if (pathname === "/api/admin/products" && method === "GET") return json(await getCatalog(env));

    if (pathname === "/api/admin/products/adjust" && method === "POST") {
      const pct = num((await readJson(request)).percent, NaN);
      if (!Number.isFinite(pct) || pct <= -90 || pct > 500) throw new HttpError(400, "Percent must be between -90 and 500");
      const now = new Date().toISOString();
      const list = await getCatalog(env);
      list.forEach((p) => { p.tiers.forEach((t) => { t.price = roundPrice(t.price * (1 + pct / 100)); }); p.priceUpdated = now; });
      await putCatalog(env, list);
      return json({ ok: true, count: list.length });
    }

    if ((m = pathname.match(/^\/api\/admin\/products\/([a-z0-9-]{1,60})$/))) {
      const id = m[1];
      const list = await getCatalog(env);
      const i = list.findIndex((p) => p.id === id);
      if (method === "PUT") {
        const product = cleanProduct(await readJson(request), id, list[i]);
        if (i >= 0) {
          const keep = localImageKeys(product);
          await dropImages(env, localImageKeys(list[i]).filter((k) => !keep.includes(k)));
          list[i] = product;
        } else list.unshift(product);
        await putCatalog(env, list);
        return json(product);
      }
      if (method === "DELETE") {
        if (i < 0) return fail("not found", 404);
        await dropImages(env, localImageKeys(list[i]));
        list.splice(i, 1);
        await putCatalog(env, list);
        return json({ ok: true });
      }
    }

    if (pathname === "/api/admin/images" && method === "POST") {
      const type = (request.headers.get("content-type") || "").split(";")[0].trim();
      if (!["image/jpeg", "image/png", "image/webp"].includes(type)) throw new HttpError(415, "Only JPEG, PNG or WebP photos");
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength === 0 || bytes.byteLength > 2 * 1024 * 1024) throw new HttpError(413, "Photo must be under 2 MB");
      const key = newImageKey();
      await env.QUOTES.put("img:" + key, bytes, { metadata: { type } });
      return json({ ok: true, url: "/api/images/" + key });
    }

    if (pathname === "/api/admin/settings") {
      if (method === "GET") return json(await getSettings(env));
      if (method === "PUT") { const s = cleanSettings(await readJson(request)); await env.QUOTES.put("settings", JSON.stringify(s)); return json(s); }
    }

    if (pathname === "/api/admin/quote-requests" && method === "GET") {
      return json(await listQuotes(env, Math.min(45, Math.max(1, parseInt(url.searchParams.get("limit"), 10) || 40))));
    }

    if ((m = pathname.match(/^\/api\/admin\/quote-requests\/([\w-]+)\/(quotation|invoice|paid)$/)) && method === "POST") {
      const [, ref, action] = m;
      const record = await getQuote(env, ref);
      if (!record) return fail("not found", 404);
      const body = await readJson(request);

      if (action === "quotation") {
        if (record.status !== "pending" && record.status !== "quoted") throw new HttpError(409, "This quote already has an invoice");
        const unitPrice = num(body.unitPrice), qty = Math.round(num(body.qty));
        if (!(unitPrice > 0) || !(qty > 0)) throw new HttpError(400, "Unit price and quantity are required");
        record.status = "quoted";
        record.quotation = { currency: str(body.currency, 3).toUpperCase() || "THB", unitPrice, qty, notes: str(body.notes, 1000), issuedAt: new Date().toISOString() };
        delete record.acceptedAt; // a revised quotation needs a fresh acceptance
        await putQuote(env, record);
        await notifyViaAppsScript(env, ctx, { type: "quotation_sent", ref, to: record.email, record });
      } else if (action === "invoice") {
        if (record.status !== "quoted" && record.status !== "invoiced") throw new HttpError(409, "Send a quotation first");
        const unitPrice = num(body.unitPrice), qty = Math.round(num(body.qty));
        if (!(unitPrice > 0) || !(qty > 0)) throw new HttpError(400, "Unit price and quantity are required");
        const settings = await getSettings(env);
        record.status = "invoiced";
        record.invoice = {
          currency: str(body.currency, 3).toUpperCase() || "THB", unitPrice, qty,
          shipping: Math.max(0, num(body.shipping)), tax: Math.max(0, num(body.tax)), other: Math.max(0, num(body.other)),
          shipDate: str(body.shipDate, 10), deliveryWindow: str(body.deliveryWindow, 60),
          paymentInfo: settings.paymentInfo || "", // snapshot: payment details are only shown to customers who hold an invoice
          issuedAt: new Date().toISOString(),
        };
        await putQuote(env, record);
        await notifyViaAppsScript(env, ctx, { type: "invoice_sent", ref, to: record.email, record });
      } else {
        if (record.status !== "invoiced") throw new HttpError(409, "Only an issued invoice can be marked paid");
        record.status = "paid";
        record.paidAt = new Date().toISOString();
        await putQuote(env, record);
      }
      return json({ ok: true });
    }
  }

  return fail("not found", 404);
}

/**
 * Chadrey Wholesale — API Worker (starter scaffold)
 *
 * Routes:
 *   POST /api/quote-requests        customer submits a quote request
 *   GET  /api/quote-requests/:ref   look up a single request/quotation/invoice
 *   GET  /api/admin/quote-requests  (bearer ADMIN_TOKEN) list all requests
 *   POST /api/admin/quote-requests/:ref/quotation   set the quotation
 *   POST /api/admin/quote-requests/:ref/invoice     set the invoice
 *
 * Storage: Workers KV (swap for D1 once you need real relational queries —
 * this is intentionally simple to get the flow working end to end first).
 */

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json", "access-control-allow-origin": "*" },
  });
}

function newRef() {
  const n = Math.floor(100000 + Math.random() * 900000);
  return `WR-${new Date().getFullYear()}-${n}`;
}

async function notifyViaAppsScript(env, payload) {
  if (!env.APPS_SCRIPT_WEBHOOK_URL) return; // not configured yet, skip silently
  await fetch(env.APPS_SCRIPT_WEBHOOK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-shared-secret": env.APPS_SCRIPT_SHARED_SECRET || "",
    },
    body: JSON.stringify(payload),
  });
}

function requireAdmin(request, env) {
  const auth = request.headers.get("authorization") || "";
  return auth === `Bearer ${env.ADMIN_TOKEN}`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET,POST,OPTIONS",
          "access-control-allow-headers": "content-type,authorization",
        },
      });
    }

    // --- Customer: submit a quote request ---
    if (pathname === "/api/quote-requests" && request.method === "POST") {
      const body = await request.json();
      const ref = newRef();
      const record = {
        ref,
        status: "pending",
        createdAt: new Date().toISOString(),
        ...body, // product, qty, color, size, packaging, customization, notes,
                 // company, email, phone, whatsapp, address
      };
      await env.QUOTES.put(ref, JSON.stringify(record));

      await notifyViaAppsScript(env, {
        type: "quote_request_received",
        ref,
        to: body.email,
        record,
      });

      return json({ ok: true, ref });
    }

    // --- Anyone with the ref: look up a request/quotation/invoice ---
    const lookupMatch = pathname.match(/^\/api\/quote-requests\/([\w-]+)$/);
    if (lookupMatch && request.method === "GET") {
      const raw = await env.QUOTES.get(lookupMatch[1]);
      if (!raw) return json({ error: "not found" }, 404);
      return json(JSON.parse(raw));
    }

    // --- Admin: list all requests ---
    if (pathname === "/api/admin/quote-requests" && request.method === "GET") {
      if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
      const list = await env.QUOTES.list();
      const records = await Promise.all(
        list.keys.map(async (k) => JSON.parse(await env.QUOTES.get(k.name)))
      );
      return json(records);
    }

    // --- Admin: attach a quotation to a request ---
    const quoteMatch = pathname.match(/^\/api\/admin\/quote-requests\/([\w-]+)\/quotation$/);
    if (quoteMatch && request.method === "POST") {
      if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
      const ref = quoteMatch[1];
      const raw = await env.QUOTES.get(ref);
      if (!raw) return json({ error: "not found" }, 404);
      const record = JSON.parse(raw);
      const quotation = await request.json(); // { unitPrice, qty, notes }
      record.status = "quoted";
      record.quotation = { ...quotation, issuedAt: new Date().toISOString() };
      await env.QUOTES.put(ref, JSON.stringify(record));

      await notifyViaAppsScript(env, {
        type: "quotation_sent",
        ref,
        to: record.email,
        record,
      });

      return json({ ok: true });
    }

    // --- Admin: attach a final invoice to a request ---
    const invoiceMatch = pathname.match(/^\/api\/admin\/quote-requests\/([\w-]+)\/invoice$/);
    if (invoiceMatch && request.method === "POST") {
      if (!requireAdmin(request, env)) return json({ error: "unauthorized" }, 401);
      const ref = invoiceMatch[1];
      const raw = await env.QUOTES.get(ref);
      if (!raw) return json({ error: "not found" }, 404);
      const record = JSON.parse(raw);
      const invoice = await request.json(); // { lineItems, shipping, tax, other, shipDate, deliveryWindow }
      record.status = "invoiced";
      record.invoice = { ...invoice, issuedAt: new Date().toISOString() };
      await env.QUOTES.put(ref, JSON.stringify(record));

      await notifyViaAppsScript(env, {
        type: "invoice_sent",
        ref,
        to: record.email,
        record,
      });

      return json({ ok: true });
    }

    return json({ error: "not found" }, 404);
  },
};

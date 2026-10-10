/* Chadrey Wholesale — data layer.
 *
 * One small API (window.Store) used by every page. It runs in one of two modes:
 *   - LIVE: CHADREY_CONFIG.apiBase points at the Cloudflare Worker; everything is shared.
 *   - DEMO: no apiBase; everything is kept in this browser's localStorage.
 * Pages never need to know which one they are in.
 */
(function () {
  const cfg = window.CHADREY_CONFIG || {};
  const API = (cfg.apiBase || "").replace(/\/+$/, "");
  const REMOTE = !!API;

  const K = {
    products: "chadrey.products.v1",
    settings: "chadrey.settings.v1",
    quotes: "chadrey.quotes.v1",
    refs: "chadrey.myrefs.v1",
    token: "chadrey.admintoken",
  };

  /* ---------- tiny safe storage ---------- */
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) {
      try { localStorage.setItem(k, JSON.stringify(v)); }
      catch (e) { throw new Error("Browser storage is full. Remove a photo, or connect the live API (see README)."); }
    },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} },
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) {} },
  };

  /* ---------- sample products (demo mode only; delete freely) ---------- */
  function seedProducts() {
    const now = new Date().toISOString();
    const mk = (id, name, category, icon, moq, tiers, origin, lead, extra) => Object.assign({
      id, name, category, icon, moq, unit: "pc", origin, lead,
      tiers: tiers.map(([min, price]) => ({ min, price })),
      images: [], desc: "", colors: [], sizes: [], packaging: [], customization: [],
      dealer: "", active: true, sample: true, createdAt: now, updatedAt: now, priceUpdated: now,
    }, extra);
    return [
      mk("oversized-tshirt", "100% Cotton Oversized T-Shirt", "Apparel", "shirt", 50,
        [[50, 129], [200, 115], [500, 99]], "Bangkok", "7–10 days", {
          desc: "Heavyweight cotton, drop-shoulder fit, pre-shrunk fabric. Retail-ready quality.",
          colors: ["Black", "White", "Grey"], sizes: ["S", "M", "L", "XL", "XXL"],
          packaging: ["Individual poly bag", "Bulk carton"], customization: ["Plain (no branding)", "Custom print / logo"] }),
      mk("fleece-hoodie", "Premium Fleece Hoodie", "Apparel", "hoodie", 30,
        [[30, 420], [100, 385], [300, 350]], "Bangkok", "10–14 days", {
          desc: "Brushed-fleece interior, ribbed cuffs and hem, double-lined hood.",
          colors: ["Black", "Navy", "Heather Grey"], sizes: ["S", "M", "L", "XL", "XXL"],
          packaging: ["Individual poly bag", "Bulk carton"], customization: ["Plain (no branding)", "Custom print / logo", "Embroidered logo"] }),
      mk("classic-polo", "Classic Piqué Polo Shirt", "Apparel", "polo", 50,
        [[50, 189], [200, 170], [500, 155]], "Samut Prakan", "10 days", {
          desc: "Breathable piqué knit, reinforced collar, three-button placket, colourfast dye.",
          colors: ["White", "Navy", "Red"], sizes: ["S", "M", "L", "XL", "XXL"],
          packaging: ["Individual poly bag", "Bulk carton"], customization: ["Plain (no branding)", "Embroidered logo"] }),
      mk("canvas-tote", "Heavy Canvas Tote Bag", "Bags", "bag", 100,
        [[100, 45], [500, 38]], "Chiang Mai", "7 days", {
          desc: "12oz cotton canvas, reinforced handles, inner pocket. Great for printing.",
          colors: ["Natural", "Black"], packaging: ["Bulk carton"], customization: ["Plain (no branding)", "Custom print / logo"] }),
      mk("rubber-flipflops", "Natural Rubber Flip-Flops", "Footwear", "shoe", 60,
        [[60, 75], [300, 65]], "Bangkok", "7–10 days", {
          desc: "Soft natural-rubber sole, non-slip, light and durable.",
          colors: ["Black", "Blue", "Pink"], sizes: ["36–40", "41–45"], packaging: ["Bulk carton"] }),
      mk("silk-cushion", "Thai Silk Cushion Cover", "Home", "home", 40,
        [[40, 210], [200, 185]], "Chiang Mai", "14 days", {
          desc: "Hand-woven Thai silk, concealed zip, 45×45cm. Gift-ready.",
          colors: ["Gold", "Teal", "Burgundy"], packaging: ["Individual gift box", "Bulk carton"] }),
    ];
  }

  const DEFAULT_SETTINGS = {
    shopName: "Chadrey Wholesale",
    whatsapp: "", email: "", paymentInfo: "",
    displayCode: "", displaySymbol: "", rate: 0,
  };

  /* ---------- helpers ---------- */
  const num = (v, d = 0) => { const n = parseFloat(v); return isFinite(n) ? n : d; };
  const list = (v) => Array.isArray(v) ? v.map((x) => String(x).trim()).filter(Boolean)
    : String(v || "").split(",").map((x) => x.trim()).filter(Boolean);
  const uid = (name) => (String(name || "item").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "item")
    + "-" + Math.random().toString(36).slice(2, 6);

  function normalize(p) {
    const moq = Math.max(1, Math.round(num(p.moq, 1)));
    let tiers = (Array.isArray(p.tiers) ? p.tiers : []).map((t) => ({ min: Math.round(num(t.min, 0)), price: num(t.price, 0) }))
      .filter((t) => t.price > 0 && t.min > 0).sort((a, b) => a.min - b.min);
    if (!tiers.length) tiers = [{ min: moq, price: 0 }];
    tiers[0].min = moq; // the first price always starts at the minimum order
    tiers = tiers.filter((t, i) => i === 0 || t.min > tiers[i - 1].min);
    return {
      id: p.id || uid(p.name),
      name: String(p.name || "").trim(),
      category: String(p.category || "Other").trim() || "Other",
      desc: String(p.desc || "").trim(),
      icon: p.icon || "",
      images: (Array.isArray(p.images) ? p.images : []).filter(Boolean).slice(0, 8),
      moq, unit: String(p.unit || "pc").trim() || "pc", tiers,
      origin: String(p.origin || "").trim(), lead: String(p.lead || "").trim(),
      colors: list(p.colors), sizes: list(p.sizes), packaging: list(p.packaging), customization: list(p.customization),
      dealer: String(p.dealer || "").trim(), // private: never sent to customers
      active: p.active !== false,
      sample: !!p.sample,
      createdAt: p.createdAt || "", updatedAt: p.updatedAt || "", priceUpdated: p.priceUpdated || "",
    };
  }
  const publicView = (p) => { const c = Object.assign({}, p); delete c.dealer; delete c.sample; return c; };
  const sameTiers = (a, b) => JSON.stringify((a || []).map((t) => [t.min, t.price])) === JSON.stringify((b || []).map((t) => [t.min, t.price]));
  const roundPrice = (n) => (n >= 10 ? Math.round(n) : Math.round(n * 100) / 100);

  async function api(path, opts) {
    const o = opts || {};
    const headers = {};
    if (o.admin) headers.authorization = "Bearer " + (ss.get(K.token) || "");
    let body;
    if (o.raw) { body = o.raw; headers["content-type"] = o.raw.type || "application/octet-stream"; }
    else if (o.body !== undefined) { body = JSON.stringify(o.body); headers["content-type"] = "application/json"; }
    let res;
    try { res = await fetch(API + path, { method: o.method || "GET", headers, body }); }
    catch (e) { throw new Error("Can't reach the server. Check your connection and try again."); }
    if (!res.ok) {
      let msg = res.statusText;
      try { msg = (await res.json()).error || msg; } catch (e) {}
      const err = new Error(msg); err.status = res.status; throw err;
    }
    return res.json();
  }

  /* ---------- products ---------- */
  function localProducts() {
    let arr = ls.get(K.products, null);
    if (!arr) { arr = seedProducts(); ls.set(K.products, arr); }
    return arr.map(normalize);
  }

  async function products(opts) {
    const admin = !!(opts && opts.admin);
    if (REMOTE) {
      const arr = await api(admin ? "/api/admin/products" : "/api/products", { admin });
      return arr.map(normalize);
    }
    const all = localProducts();
    return admin ? all : all.filter((p) => p.active).map(publicView);
  }

  async function product(id) {
    if (REMOTE) { try { return normalize(await api("/api/products/" + encodeURIComponent(id))); } catch (e) { if (e.status === 404) return null; throw e; } }
    return (await products()).find((p) => p.id === id) || null;
  }

  async function saveProduct(input) {
    const p = normalize(input);
    if (!p.name) throw new Error("Give the product a name.");
    if (!(p.tiers[0].price > 0)) throw new Error("Enter a price greater than 0.");
    if (REMOTE) return normalize(await api("/api/admin/products/" + encodeURIComponent(p.id), { method: "PUT", admin: true, body: p }));
    const all = localProducts();
    const i = all.findIndex((x) => x.id === p.id);
    const now = new Date().toISOString();
    if (i >= 0) {
      p.createdAt = all[i].createdAt || now;
      p.priceUpdated = sameTiers(all[i].tiers, p.tiers) ? (all[i].priceUpdated || now) : now;
      p.sample = false;
      all[i] = Object.assign(p, { updatedAt: now });
    } else {
      all.unshift(Object.assign(p, { createdAt: now, updatedAt: now, priceUpdated: now }));
    }
    ls.set(K.products, all);
    return p;
  }

  async function deleteProduct(id) {
    if (REMOTE) { await api("/api/admin/products/" + encodeURIComponent(id), { method: "DELETE", admin: true }); return; }
    ls.set(K.products, localProducts().filter((p) => p.id !== id));
  }

  // Move every price up or down by a percentage (e.g. when the exchange rate changes).
  async function adjustPrices(percent) {
    const pct = num(percent, NaN);
    if (!isFinite(pct) || pct <= -90 || pct > 500) throw new Error("Enter a percentage between -90 and 500.");
    if (REMOTE) return api("/api/admin/products/adjust", { method: "POST", admin: true, body: { percent: pct } });
    const all = localProducts(), now = new Date().toISOString();
    all.forEach((p) => { p.tiers.forEach((t) => { t.price = roundPrice(t.price * (1 + pct / 100)); }); p.priceUpdated = now; });
    ls.set(K.products, all);
    return { ok: true, count: all.length };
  }

  async function uploadImage(blob) {
    if (REMOTE) return (await api("/api/admin/images", { method: "POST", admin: true, raw: blob })).url;
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Couldn't read that photo."));
      r.readAsDataURL(blob);
    });
  }

  // Shrink a photo before upload so pages stay fast on mobile data.
  async function resizeImage(file, max, quality) {
    max = max || 960; quality = quality || 0.82;
    let bmp;
    try { bmp = await createImageBitmap(file, { imageOrientation: "from-image" }); }
    catch (e) {
      bmp = await new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("That file isn't a photo.")); im.src = URL.createObjectURL(file); });
    }
    const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
    const s = Math.min(1, max / Math.max(w, h));
    const c = document.createElement("canvas");
    c.width = Math.round(w * s); c.height = Math.round(h * s);
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("Couldn't process that photo."))), "image/jpeg", quality));
  }

  const img = (url) => (url && url.startsWith("/api/") ? API + url : url || "");

  /* ---------- pricing helpers ---------- */
  function priceFor(p, qty) {
    let price = p.tiers[0].price;
    p.tiers.forEach((t) => { if (qty >= t.min) price = t.price; });
    return price;
  }
  function tierIndexFor(p, qty) {
    let idx = 0;
    p.tiers.forEach((t, i) => { if (qty >= t.min) idx = i; });
    return idx;
  }
  function money(n, code) {
    code = code || "THB";
    const v = num(n, 0);
    const opts = { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 };
    if (code === "THB") return "฿" + v.toLocaleString("en-US", opts);
    try { return new Intl.NumberFormat("en-US", Object.assign({ style: "currency", currency: code }, opts)).format(v); }
    catch (e) { return code + " " + v.toLocaleString("en-US", opts); }
  }
  function approx(thb, s) {
    if (!s || !(s.rate > 0) || !s.displayCode) return "";
    const v = Math.round(thb * s.rate);
    return "≈ " + (s.displaySymbol || s.displayCode + " ") + v.toLocaleString("en-US");
  }
  function categories(arr) {
    const m = new Map();
    arr.forEach((p) => m.set(p.category, (m.get(p.category) || 0) + 1));
    return [...m.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  }
  function fmtDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  /* ---------- settings ---------- */
  let settingsCache = null;
  async function settings() {
    if (settingsCache) return settingsCache;
    let s;
    // The owner (signed in) gets the full settings incl. payment details; customers only get the public ones.
    if (REMOTE) { try { s = await api(ss.get(K.token) ? "/api/admin/settings" : "/api/settings", { admin: !!ss.get(K.token) }); } catch (e) { s = {}; } }
    else s = ls.get(K.settings, {});
    settingsCache = Object.assign({}, DEFAULT_SETTINGS, s);
    return settingsCache;
  }
  async function saveSettings(s) {
    const clean = Object.assign({}, DEFAULT_SETTINGS, s);
    clean.rate = Math.max(0, num(clean.rate, 0));
    clean.displayCode = String(clean.displayCode || "").trim().toUpperCase().slice(0, 3);
    clean.whatsapp = String(clean.whatsapp || "").replace(/[^\d+]/g, "");
    if (REMOTE) await api("/api/admin/settings", { method: "PUT", admin: true, body: clean });
    else ls.set(K.settings, clean);
    settingsCache = clean;
    return clean;
  }

  /* ---------- quotes ---------- */
  const localQuotes = () => ls.get(K.quotes, []);
  const myRefs = () => ls.get(K.refs, []);
  function rememberRef(ref) {
    const r = myRefs().filter((x) => x !== ref); r.unshift(ref);
    try { ls.set(K.refs, r.slice(0, 50)); } catch (e) {}
  }

  async function submitQuote(data) {
    let ref;
    if (REMOTE) ref = (await api("/api/quote-requests", { method: "POST", body: data })).ref;
    else {
      const all = localQuotes();
      do { ref = "WR-" + new Date().getFullYear() + "-" + String(Math.floor(10000 + Math.random() * 90000)); } while (all.some((q) => q.ref === ref));
      all.unshift(Object.assign({}, data, { ref, status: "pending", createdAt: new Date().toISOString() }));
      ls.set(K.quotes, all);
    }
    rememberRef(ref);
    return { ref };
  }
  async function quote(ref) {
    ref = String(ref || "").trim();
    if (!ref) return null;
    if (REMOTE) { try { return await api("/api/quote-requests/" + encodeURIComponent(ref)); } catch (e) { if (e.status === 404) return null; throw e; } }
    return localQuotes().find((q) => q.ref.toLowerCase() === ref.toLowerCase()) || null;
  }
  async function myQuotes() {
    const out = await Promise.all(myRefs().map((r) => quote(r).catch(() => null)));
    return out.filter(Boolean).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
  }
  async function acceptQuotation(ref) {
    if (REMOTE) return api("/api/quote-requests/" + encodeURIComponent(ref) + "/accept", { method: "POST", body: {} });
    const all = localQuotes(), q = all.find((x) => x.ref === ref);
    if (q) { q.acceptedAt = new Date().toISOString(); ls.set(K.quotes, all); }
    return { ok: true };
  }

  /* ---------- admin ---------- */
  function localUpdate(ref, fn) {
    const all = localQuotes(), q = all.find((x) => x.ref === ref);
    if (!q) throw new Error("Quote not found.");
    fn(q); ls.set(K.quotes, all); return q;
  }
  const admin = {
    needsLogin: () => REMOTE && !ss.get(K.token),
    async login(token) {
      ss.set(K.token, String(token || "").trim());
      try { await api("/api/admin/products", { admin: true }); }
      catch (e) { ss.del(K.token); throw new Error(e.status === 401 ? "That access code isn't right." : e.message); }
    },
    logout() { ss.del(K.token); },
    async quotes() {
      if (REMOTE) return (await api("/api/admin/quote-requests", { admin: true })).sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return localQuotes();
    },
    async sendQuotation(ref, d) {
      const body = { currency: String(d.currency || "THB").toUpperCase().slice(0, 3), unitPrice: num(d.unitPrice), qty: Math.round(num(d.qty)), notes: String(d.notes || "") };
      if (!(body.unitPrice > 0) || !(body.qty > 0)) throw new Error("Enter a unit price and quantity.");
      if (REMOTE) return api("/api/admin/quote-requests/" + encodeURIComponent(ref) + "/quotation", { method: "POST", admin: true, body });
      localUpdate(ref, (q) => { q.status = "quoted"; q.quotation = Object.assign(body, { issuedAt: new Date().toISOString() }); });
      return { ok: true };
    },
    async sendInvoice(ref, d) {
      const body = {
        currency: String(d.currency || "THB").toUpperCase().slice(0, 3), unitPrice: num(d.unitPrice), qty: Math.round(num(d.qty)),
        shipping: num(d.shipping), tax: num(d.tax), other: num(d.other),
        shipDate: String(d.shipDate || ""), deliveryWindow: String(d.deliveryWindow || ""),
      };
      if (!(body.unitPrice > 0) || !(body.qty > 0)) throw new Error("Enter the final unit price and quantity.");
      if (REMOTE) return api("/api/admin/quote-requests/" + encodeURIComponent(ref) + "/invoice", { method: "POST", admin: true, body });
      const pay = (await settings()).paymentInfo || "";
      localUpdate(ref, (q) => { q.status = "invoiced"; q.invoice = Object.assign(body, { paymentInfo: pay, issuedAt: new Date().toISOString() }); });
      return { ok: true };
    },
    async markPaid(ref) {
      if (REMOTE) return api("/api/admin/quote-requests/" + encodeURIComponent(ref) + "/paid", { method: "POST", admin: true, body: {} });
      localUpdate(ref, (q) => { q.status = "paid"; q.paidAt = new Date().toISOString(); });
      return { ok: true };
    },
  };

  function resetDemo() { [K.products, K.settings, K.quotes, K.refs].forEach(ls.del); settingsCache = null; }

  window.Store = {
    remote: REMOTE, products, product, saveProduct, deleteProduct, adjustPrices, uploadImage, resizeImage, img,
    priceFor, tierIndexFor, money, approx, categories, fmtDate, settings, saveSettings,
    submitQuote, quote, myQuotes, rememberRef, acceptQuotation, admin, resetDemo,
    invoiceTotal: (inv) => num(inv.unitPrice) * num(inv.qty) + num(inv.shipping) + num(inv.tax) + num(inv.other),
  };
})();

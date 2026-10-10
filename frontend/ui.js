/* Chadrey Wholesale — shared UI shell.
 * Every page calls UI.mount({...}) once; the navigation bar, tab bar, icons, toast and the
 * product card all live here so no page repeats markup. */
(function () {
  const ICONS = {
    house: '<path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
    doc: '<path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',
    more: '<circle cx="12" cy="12" r="9"/><path d="M8 12h.01M12 12h.01M16 12h.01" stroke-width="2.6"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>',
    chev: '<path d="m9 6 6 6-6 6"/>',
    back: '<path d="m15 5-7 7 7 7"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    x: '<path d="M6 6l12 12M18 6 6 18"/>',
    clear: '<circle cx="12" cy="12" r="9" fill="currentColor" stroke="none"/><path d="m9 9 6 6M15 9l-6 6" stroke="#fff"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    camera: '<path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13" r="3.5"/>',
    trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01" stroke-width="2.2"/>',
    chat: '<path d="M4 5h16v11H10l-5 4v-4H4z"/>',
    truck: '<path d="M2 6h11v10H2zM13 9h4l3 3v4h-7"/><circle cx="7" cy="18" r="1.8"/><circle cx="17" cy="18" r="1.8"/>',
    shield: '<path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/>',
    tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
    tune: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
    lock: '<rect x="5" y="10" width="14" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
    mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.6 2.2c-.7.4-1.1.9-1.1 1.8M12 17h.01" stroke-width="2"/>',
    shirt: '<path d="M8 3 3 6l2 4 3-1.5V21h8V8.5L19 10l2-4-5-3c-.5 1.5-2 2.5-4 2.5S8.5 4.5 8 3z"/>',
    hoodie: '<path d="M8 3 3 6l2 4 3-1.5V21h8V8.5L19 10l2-4-5-3"/><path d="M8 3c.5 3 3 4.5 4 4.5S15.5 6 16 3M12 9v3"/>',
    polo: '<path d="M8 3 3 6l2 4 3-1.5V21h8V8.5L19 10l2-4-5-3-4 4z"/><path d="M12 7v5"/>',
    tank: '<path d="M8 3v5c0 2-2 3-2 6v7h12v-7c0-3-2-4-2-6V3"/><path d="M8 3c1 2.5 7 2.5 8 0"/>',
    bag: '<path d="M5 8h14l-1 12H6z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/>',
    shoe: '<path d="M3 17v-3.5c0-1 .6-1.7 1.6-1.9L8 11l2 2.5 4 1c3 .7 6 1.5 6 4V19a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/>',
    sparkle: '<path d="m11 3 1.8 5.2L18 10l-5.2 1.8L11 17l-1.8-5.2L4 10l5.2-1.8z"/><path d="m19 15 .7 2 2 .7-2 .7L19 21l-.7-1.6-2-.7 2-.7z"/>',
    food: '<path d="M6 3v7a2 2 0 0 0 2 2v9M10 3v7a2 2 0 0 1-2 2M8 3v7"/><path d="M17 3c-2 1.5-3 4-3 7h3v11"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
    box: '<path d="M3 7.5 12 3l9 4.5v9L12 21l-9-4.5z"/><path d="m3 7.5 9 4.5 9-4.5M12 12v9"/>',
  };

  function icon(name, size, extra) {
    return '<svg width="' + (size || 22) + '" height="' + (size || 22) + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"' + (extra || "") + '>' + (ICONS[name] || ICONS.box) + "</svg>";
  }

  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const qs = (name) => new URLSearchParams(location.search).get(name);

  /* ---------- category look (icon + colour) ---------- */
  const PALETTE = ["blue", "orange", "green", "indigo", "pink", "teal", "red"];
  const CAT_RULES = [
    [/shoe|foot|sandal|slipper/i, "shoe", "green"],
    [/apparel|cloth|fashion|shirt|garment/i, "shirt", "blue"],
    [/bag|luggage|backpack/i, "bag", "orange"],
    [/home|house|decor|furnit|kitchen|living/i, "house", "indigo"],
    [/beauty|cosmetic|skin|care|spa/i, "sparkle", "pink"],
    [/food|snack|drink|sauce|rice|spice/i, "food", "red"],
    [/elect|gadget|phone|device/i, "bolt", "teal"],
  ];
  function catStyle(name) {
    for (const [re, ic, col] of CAT_RULES) if (re.test(name || "")) return { icon: ic, color: col };
    let h = 0; String(name || "").split("").forEach((c) => { h = (h * 31 + c.charCodeAt(0)) >>> 0; });
    return { icon: "box", color: PALETTE[h % PALETTE.length] };
  }
  const tileBg = (color) => "background:linear-gradient(160deg,color-mix(in srgb,var(--" + color + ") 72%,#fff),var(--" + color + "))";

  /* ---------- product visuals ---------- */
  function visual(p, lazy) {
    if (p.images && p.images[0]) return '<img src="' + esc(Store.img(p.images[0])) + '" alt="' + esc(p.name) + '"' + (lazy === false ? "" : ' loading="lazy"') + ">";
    const cs = catStyle(p.category);
    return '<div class="ph" style="' + tileBg(cs.color) + '">' + icon(p.icon || cs.icon, 48) + "</div>";
  }
  function productCard(p, s) {
    const hasTiers = p.tiers.length > 1;
    const lowest = p.tiers[p.tiers.length - 1].price;
    const ap = Store.approx(p.tiers[0].price, s);
    return '<a class="pcard" href="product.html?id=' + encodeURIComponent(p.id) + '">' +
      '<div class="img">' + visual(p) + "</div>" +
      '<div class="body"><div class="name">' + esc(p.name) + "</div>" +
      '<div class="price"><span class="amt">' + Store.money(p.tiers[0].price) + '</span><span class="unit">/' + esc(p.unit) + "</span>" +
      (ap ? '<span class="approx">' + esc(ap) + "</span>" : "") + "</div>" +
      '<div class="tags"><span class="tag">MOQ ' + p.moq + "</span>" +
      (hasTiers ? '<span class="tag hot">↓ ' + Store.money(lowest) + "</span>" : "") +
      (p.origin ? '<span class="tag">' + esc(p.origin) + "</span>" : "") + "</div></div></a>";
  }
  function skeletonGrid(n) {
    return Array.from({ length: n || 6 }, () => '<div class="skel" style="aspect-ratio:3/4"></div>').join("");
  }

  /* ---------- status badges ---------- */
  const STATUS = {
    pending: ["Awaiting quote", "orange"], quoted: ["Quote ready", "blue"],
    invoiced: ["Invoice ready", "indigo"], paid: ["Paid", "green"],
  };
  const statusBadge = (st) => { const m = STATUS[st] || STATUS.pending; return '<span class="badge ' + m[1] + '">' + m[0] + "</span>"; };

  /* ---------- toast ---------- */
  let toastTimer;
  function toast(msg) {
    let t = document.querySelector(".toast");
    if (!t) { t = document.createElement("div"); t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }

  /* ---------- shell ---------- */
  const TABS = [
    { id: "home", label: "Home", href: "index.html", icon: "house" },
    { id: "products", label: "Products", href: "products.html", icon: "grid" },
    { id: "quotes", label: "Quotes", href: "my-quotes.html", icon: "doc" },
    { id: "more", label: "More", href: "more.html", icon: "more" },
  ];

  function mount(opts) {
    const o = Object.assign({ tab: null, title: "", back: false, backHref: "index.html", right: "", tabs: true, actionbar: false }, opts);
    document.title = (o.title ? o.title + " — " : "") + "Chadrey Wholesale";
    document.body.classList.toggle("no-tabs", !o.tabs);
    document.body.classList.toggle("has-actionbar", !!o.actionbar);

    const left = o.back
      ? '<a class="nav-btn" href="' + esc(o.backHref) + '" data-back>' + icon("back", 22) + "<span>Back</span></a>"
      : '<a class="brand" href="index.html">Chadrey</a>';
    const links = TABS.map((t) => '<a href="' + t.href + '"' + (t.id === o.tab ? ' aria-current="page"' : "") + ">" + t.label + "</a>").join("");
    const bar = document.createElement("header");
    bar.className = "navbar";
    bar.innerHTML = '<div class="navbar-inner"><div class="nav-left">' + left + '</div>' +
      '<div class="nav-center"><div class="nav-title">' + esc(o.title) + '</div><nav class="top-links" aria-label="Main">' + links + "</nav></div>" +
      '<div class="nav-right">' + o.right + "</div></div>";
    document.body.prepend(bar);

    const back = bar.querySelector("[data-back]");
    if (back) back.addEventListener("click", (e) => {
      let same = false; try { same = document.referrer && new URL(document.referrer).origin === location.origin; } catch (err) {}
      if (same && history.length > 1) { e.preventDefault(); history.back(); }
    });

    if (o.tabs) {
      const nav = document.createElement("nav");
      nav.className = "tabbar"; nav.setAttribute("aria-label", "Main");
      nav.innerHTML = TABS.map((t) => '<a class="tab" href="' + t.href + '"' + (t.id === o.tab ? ' aria-current="page"' : "") + ">" + icon(t.icon, 26) + "<span>" + t.label + "</span></a>").join("");
      document.body.appendChild(nav);
    }

    const onScroll = () => bar.classList.toggle("scrolled", window.scrollY > 36);
    window.addEventListener("scroll", onScroll, { passive: true }); onScroll();
    return bar;
  }

  async function whatsappHref(text) {
    const s = await Store.settings();
    if (!s.whatsapp) return "";
    return "https://wa.me/" + s.whatsapp.replace(/\D/g, "") + (text ? "?text=" + encodeURIComponent(text) : "");
  }

  window.UI = { icon, esc, qs, catStyle, tileBg, visual, productCard, skeletonGrid, statusBadge, toast, mount, whatsappHref };
})();

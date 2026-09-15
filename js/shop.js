/* ===========================================================
   Rose Budge — shop app (gallery, detail, basket, enquiry)
   Plain JS, hash-routed, no build step.
=========================================================== */
(function () {
  const CFG = window.ROSE_CONFIG;
  const app = document.getElementById("app");
  const drawerRoot = document.getElementById("drawerRoot");
  const basketToggle = document.getElementById("basketToggle");
  const basketCountEl = document.getElementById("basketCount");
  const BASKET_KEY = "rb_basket_v1";
  const HEARTS_KEY = "rb_hearts_v1";
  const NEW_BADGE_DAYS = 14;

  const SORT_OPTIONS = [
    { value: "featured", label: "Featured" },
    { value: "newest", label: "Newest" },
    { value: "loved", label: "Most loved" },
    { value: "price-asc", label: "Price: low to high" },
    { value: "price-desc", label: "Price: high to low" }
  ];

  const state = {
    paintings: [],
    loaded: false,
    error: null,
    filter: "all",
    sort: "featured",
    basket: loadBasket(),
    hearted: loadHearted(),
    drawerOpen: false,
    lastOrder: null
  };

  if (CFG.emailjs.publicKey && window.emailjs) {
    emailjs.init({ publicKey: CFG.emailjs.publicKey });
  }

  function loadBasket() {
    try {
      const raw = localStorage.getItem(BASKET_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      // Migrate the old format (a plain array of painting ids, before
      // prints existed) into line items.
      return parsed.map((item) => typeof item === "string"
        ? { key: item, paintingId: item, kind: "original" }
        : item);
    } catch (e) {
      return [];
    }
  }

  function saveBasket() {
    try {
      localStorage.setItem(BASKET_KEY, JSON.stringify(state.basket));
    } catch (e) { /* private browsing / storage disabled — basket just won't persist */ }
  }

  function loadHearted() {
    try {
      const raw = localStorage.getItem(HEARTS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveHearted() {
    try { localStorage.setItem(HEARTS_KEY, JSON.stringify(state.hearted)); } catch (e) { /* ignore */ }
  }

  function isHearted(id) {
    return state.hearted.indexOf(id) > -1;
  }

  function toggleHeart(id) {
    const w = byId(id);
    if (!w) return;
    const already = isHearted(id);
    if (already) {
      state.hearted = state.hearted.filter((h) => h !== id);
      w.hearts = Math.max(0, (w.hearts || 0) - 1);
    } else {
      state.hearted = state.hearted.concat([id]);
      w.hearts = (w.hearts || 0) + 1;
    }
    saveHearted();
    renderScreen();
    // Best-effort sync — the heart already shows locally either way.
    fetch("/.netlify/functions/hearts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paintingId: id, delta: already ? -1 : 1 })
    }).catch((err) => console.warn("Heart sync failed:", err));
  }

  function sortPaintings(list, sort) {
    const arr = list.slice();
    if (sort === "newest") return arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    if (sort === "loved") return arr.sort((a, b) => (b.hearts || 0) - (a.hearts || 0));
    if (sort === "price-asc") return arr.sort((a, b) => a.price - b.price);
    if (sort === "price-desc") return arr.sort((a, b) => b.price - a.price);
    return arr; // "featured" — already in Rose's chosen Sort Order from fetchPaintings()
  }

  function isNew(w) {
    if (!w.createdAt) return false;
    const days = (Date.now() - new Date(w.createdAt).getTime()) / (1000 * 60 * 60 * 24);
    return days >= 0 && days <= NEW_BADGE_DAYS;
  }

  function printSizes() {
    return (CFG.prints && CFG.prints.sizes) || [];
  }

  function printPrice(size) {
    const s = printSizes().find((s) => s.size === size);
    return s ? s.price : 0;
  }

  function lineKey(paintingId, kind, size) {
    return kind === "print" ? `${paintingId}:print:${size}` : paintingId;
  }

  function linePrice(item) {
    if (item.kind === "print") return printPrice(item.size);
    const w = byId(item.paintingId);
    return w ? w.price : 0;
  }

  function lineLabel(item) {
    return item.kind === "print" ? `${item.size} print` : "Original";
  }

  function money(n) {
    return "£" + Number(n || 0).toLocaleString("en-GB");
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function byId(id) {
    return state.paintings.find((w) => w.id === id);
  }

  function basketLines() {
    return state.basket.map((item) => {
      const painting = byId(item.paintingId);
      return painting ? Object.assign({}, item, { painting, price: linePrice(item) }) : null;
    }).filter(Boolean);
  }

  function addOriginalToBasket(id) {
    const key = lineKey(id, "original");
    if (!state.basket.some((it) => it.key === key)) {
      state.basket.push({ key, paintingId: id, kind: "original" });
      saveBasket();
    }
    state.drawerOpen = true;
    renderAll();
  }

  function addPrintToBasket(id, size) {
    const key = lineKey(id, "print", size);
    if (!state.basket.some((it) => it.key === key)) {
      state.basket.push({ key, paintingId: id, kind: "print", size });
      saveBasket();
    }
    state.drawerOpen = true;
    renderAll();
  }

  function removeFromBasket(key) {
    state.basket = state.basket.filter((it) => it.key !== key);
    saveBasket();
    renderAll();
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean);
    if (parts[0] === "work" && parts[1]) return { screen: "work", id: decodeURIComponent(parts[1]) };
    if (parts[0] === "basket") return { screen: "basket" };
    if (parts[0] === "checkout") return { screen: "checkout" };
    if (parts[0] === "confirm") return { screen: "confirm" };
    return { screen: "shop" };
  }

  function go(hash) {
    location.hash = hash;
    window.scrollTo(0, 0);
  }

  /* ---------------- render: shell bits ---------------- */

  function renderBasketCount() {
    basketCountEl.textContent = String(state.basket.length);
  }

  function renderDrawer() {
    if (!state.drawerOpen) {
      drawerRoot.innerHTML = "";
      return;
    }
    const lines = basketLines();
    const sub = lines.reduce((n, l) => n + l.price, 0);
    drawerRoot.innerHTML = `
      <div class="drawer-backdrop" id="drawerBackdrop">
        <aside class="drawer" role="dialog" aria-label="Basket">
          <div class="drawer-head">
            <p class="kicker" style="margin:0">Your basket · ${lines.length}</p>
            <button class="drawer-close" id="drawerClose" aria-label="Close">&times;</button>
          </div>
          <div class="drawer-body">
            ${lines.length ? lines.map(drawerLineHtml).join("") : `<p style="text-align:center;padding:28px 0;font-family:var(--display);font-style:italic;color:var(--ink-soft)">Your basket is empty.</p>`}
          </div>
          <div class="drawer-foot">
            <div class="summary-total" style="margin:0 0 16px"><span>Subtotal</span><span>${money(sub)}</span></div>
            <button class="btn" style="width:100%" id="drawerCheckout" ${lines.length ? "" : "disabled"}>Checkout</button>
            <button class="btn-text" style="display:block;width:100%;text-align:center;margin-top:10px" id="drawerViewBasket">View full basket</button>
          </div>
        </aside>
      </div>`;
    document.getElementById("drawerBackdrop").addEventListener("click", (e) => {
      if (e.target.id === "drawerBackdrop") { state.drawerOpen = false; renderDrawer(); }
    });
    document.getElementById("drawerClose").addEventListener("click", () => { state.drawerOpen = false; renderDrawer(); });
    document.getElementById("drawerViewBasket").addEventListener("click", () => { state.drawerOpen = false; go("#/basket"); });
    const co = document.getElementById("drawerCheckout");
    if (co) co.addEventListener("click", () => { state.drawerOpen = false; go("#/checkout"); });
    drawerRoot.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => removeFromBasket(btn.getAttribute("data-remove")));
    });
  }

  function drawerLineHtml(l) {
    return `
      <div style="display:flex;gap:14px;align-items:flex-start">
        <img src="${esc(RoseAirtable.thumbUrl(l.painting.imageUrl))}" alt="${esc(l.painting.title)}" style="width:74px;height:74px;object-fit:cover;background:var(--sand)">
        <div style="flex:1;min-width:0">
          <p style="margin:0 0 3px;font-family:var(--display);font-size:19px;line-height:1.2">${esc(l.painting.title)}</p>
          <p style="margin:0 0 6px;font-size:12px;color:var(--muted)">${esc(lineLabel(l))}</p>
          <button class="btn-text" data-remove="${esc(l.key)}">Remove</button>
        </div>
        <p style="margin:0;font-size:15px">${money(l.price)}</p>
      </div>`;
  }

  /* ---------------- render: screens ---------------- */

  function renderAll() {
    renderBasketCount();
    renderDrawer();
    renderScreen();
  }

  function renderScreen() {
    const r = route();
    if (!state.loaded && !state.error) {
      app.innerHTML = `<div class="wrap" style="padding:120px 0;text-align:center;color:var(--muted)">Loading the gallery…</div>`;
      return;
    }
    if (state.error) {
      app.innerHTML = `<div class="wrap" style="padding:120px 0;text-align:center;color:var(--muted)">
        <p>The gallery couldn't be loaded right now.</p>
        <p style="font-size:13px">${esc(state.error)}</p>
      </div>`;
      return;
    }
    if (r.screen === "work") return renderWork(r.id);
    if (r.screen === "basket") return renderBasket();
    if (r.screen === "checkout") return renderCheckout();
    if (r.screen === "confirm") return renderConfirm();
    return renderShop();
  }

  function categories() {
    const set = new Set(state.paintings.map((w) => w.category).filter(Boolean));
    return Array.from(set);
  }

  function renderShop() {
    const cats = categories();
    const filtered = state.paintings.filter((w) => state.filter === "all" || w.category === state.filter);
    const shown = sortPaintings(filtered, state.sort);
    app.innerHTML = `
      <section class="shop-hero">
        <img src="images/hero.jpg" alt="Painting by Rose Budge">
        <div class="overlay"></div>
        <div class="inner">
          <p class="eyebrow">Instow · North Devon</p>
          <h1>The Gallery Shop</h1>
          <p>Original oils, layered with wax and seaweed gathered from the shore. Each one is the only one.</p>
        </div>
      </section>
      <div class="wrap">
        <div class="filters-row">
          <div>
            <p class="kicker">The Collection</p>
            <h2 style="margin:0">Originals</h2>
          </div>
          <div class="filters-controls">
            ${cats.length ? `<div class="filters" id="filters">
              <button class="chip ${state.filter === "all" ? "on" : ""}" data-filter="all">All ${state.paintings.length}</button>
              ${cats.map((c) => `<button class="chip ${state.filter === c ? "on" : ""}" data-filter="${esc(c)}">${esc(c)}</button>`).join("")}
            </div>` : ""}
            <label class="sort-field">Sort
              <select id="sortSelect">
                ${SORT_OPTIONS.map((s) => `<option value="${s.value}" ${state.sort === s.value ? "selected" : ""}>${esc(s.label)}</option>`).join("")}
              </select>
            </label>
          </div>
        </div>
        <p class="filters-note">Every painting is an original, signed and ready to hang — enquire below to arrange payment and delivery or collection from Instow. Sold and reserved pieces stay on display too, since every painting is also available as an unframed print in a choice of sizes, whether the original is still available or not — open a painting to choose a size.</p>
        ${shown.length ? `<div class="shop-grid">${shown.map(cardHtml).join("")}</div>` :
          `<div class="basket-empty" style="margin:32px 0"><p>No paintings in this category right now.</p></div>`}
      </div>`;

    document.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => { state.filter = btn.getAttribute("data-filter"); renderScreen(); });
    });
    document.getElementById("sortSelect").addEventListener("change", (e) => { state.sort = e.target.value; renderScreen(); });
    bindCardActions();
  }

  function cardHtml(w) {
    const inBasket = state.basket.some((it) => it.kind === "original" && it.paintingId === w.id);
    const hearted = isHearted(w.id);
    const canBuyOriginal = w.status === "Available";
    const ribbon = w.status === "Sold" ? `<span class="ribbon">Sold</span>`
      : w.status === "Reserved" ? `<span class="ribbon ribbon-reserved">Reserved</span>`
      : isNew(w) ? `<span class="ribbon">New</span>` : "";
    return `
      <article class="work-card">
        <div class="work-figure" data-open="${esc(w.id)}">
          ${ribbon}
          <img src="${esc(RoseAirtable.thumbUrl(w.imageUrl))}" alt="${esc(w.title)}" loading="lazy">
          <button class="heart-btn ${hearted ? "on" : ""}" data-heart="${esc(w.id)}" aria-label="${hearted ? "Remove heart" : "Give this a heart"}">${hearted ? "♥" : "♡"}</button>
        </div>
        <a href="#/work/${encodeURIComponent(w.id)}" class="work-title" data-open="${esc(w.id)}">${esc(w.title)}</a>
        <p class="work-meta">${esc(w.size)}</p>
        <div class="work-price-row">
          <p class="work-price">${money(w.price)}</p>
          ${w.hearts ? `<span class="heart-count">${w.hearts} ♥</span>` : ""}
        </div>
        ${canBuyOriginal
          ? `<button class="btn-outline" data-add="${esc(w.id)}">${inBasket ? "In your basket" : "Add to basket"}</button>`
          : `<p class="work-status-note">${w.status === "Sold" ? "Original sold" : "Original reserved"} — prints still available</p>`}
        <a class="btn-text" style="text-align:center" data-open="${esc(w.id)}">Or order a print →</a>
      </article>`;
  }

  function bindCardActions() {
    document.querySelectorAll("[data-open]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        go(`#/work/${encodeURIComponent(el.getAttribute("data-open"))}`);
      });
    });
    document.querySelectorAll("[data-add]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        addOriginalToBasket(el.getAttribute("data-add"));
      });
    });
    document.querySelectorAll("[data-heart]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        toggleHeart(el.getAttribute("data-heart"));
      });
    });
  }

  function renderWork(id) {
    const w = byId(id) || state.paintings[0];
    if (!w) {
      app.innerHTML = `<div class="wrap" style="padding:80px 0;text-align:center;color:var(--muted)">
        <p>That painting isn't available any more.</p>
        <a href="#/" class="back-link">← Back to the shop</a>
      </div>`;
      return;
    }
    const inBasket = state.basket.some((it) => it.kind === "original" && it.paintingId === w.id);
    const hearted = isHearted(w.id);
    const canBuyOriginal = w.status === "Available";
    const badge = w.status === "Sold" ? `<span class="new-badge badge-sold">Sold</span>`
      : w.status === "Reserved" ? `<span class="new-badge badge-reserved">Reserved</span>`
      : isNew(w) ? `<span class="new-badge">New</span>` : "";
    const sizes = printSizes();
    app.innerHTML = `
      <section class="commerce-section" style="max-width:${1180 - 2 * 40}px">
        <a href="#/" class="back-link" data-open="__shop">← Back to the shop</a>
        <div class="detail-grid">
          <div class="detail-image">
            <img src="${esc(RoseAirtable.fullUrl(w.imageUrl))}" alt="${esc(w.title)}">
          </div>
          <div class="detail-info">
            <p class="kicker">Original · one of a kind${badge ? ` ${badge}` : ""}</p>
            <h1>${esc(w.title)}</h1>
            <p class="detail-price">${money(w.price)}</p>
            ${w.story ? `
            <div class="story-note">
              <p class="story-label">A note from Rose</p>
              <p class="story-text">${esc(w.story)}</p>
            </div>` : ""}
            <p class="detail-desc">${esc(w.description)}</p>
            <dl class="detail-facts">
              <dt>Medium</dt><dd>Oil, wax &amp; foraged seaweed</dd>
              <dt>Size</dt><dd>${esc(w.size)}</dd>
            </dl>
            <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
              ${canBuyOriginal
                ? `<button class="btn" data-add="${esc(w.id)}">${inBasket ? "In your basket" : "Add to basket"}</button>`
                : `<p class="work-status-note" style="margin:0">${w.status === "Sold" ? "This original has sold" : "This original is reserved"} — a print is still available below.</p>`}
              <button class="btn-outline" id="heartBtn" data-heart="${esc(w.id)}">${hearted ? "♥ Loved" : "♡ Give this a heart"}</button>
              ${w.hearts ? `<span class="heart-count">${w.hearts} ${w.hearts === 1 ? "heart" : "hearts"}</span>` : ""}
            </div>

            ${sizes.length ? `
            <div class="print-block">
              <p class="kicker" style="margin:0 0 10px">Or order a print</p>
              <p class="detail-desc" style="margin:0 0 16px;font-size:14px">${esc((CFG.prints && CFG.prints.note) || "")}</p>
              <div style="display:flex;gap:12px;align-items:flex-end;flex-wrap:wrap">
                <label class="form-field" style="flex:1;min-width:150px">Size
                  <select id="printSize">
                    ${sizes.map((s) => `<option value="${esc(s.size)}">${esc(s.size)} — ${money(s.price)}</option>`).join("")}
                  </select>
                </label>
                <button class="btn-outline" id="addPrintBtn">Add print to basket</button>
              </div>
            </div>` : ""}
          </div>
        </div>
      </section>`;
    document.querySelector('[data-open="__shop"]').addEventListener("click", (e) => { e.preventDefault(); go("#/"); });
    document.querySelectorAll("[data-add]").forEach((el) => {
      el.addEventListener("click", () => addOriginalToBasket(el.getAttribute("data-add")));
    });
    document.getElementById("heartBtn").addEventListener("click", () => toggleHeart(w.id));

    const printSizeSel = document.getElementById("printSize");
    const addPrintBtn = document.getElementById("addPrintBtn");
    if (printSizeSel && addPrintBtn) {
      const syncPrintBtn = () => {
        const already = state.basket.some((it) => it.key === lineKey(w.id, "print", printSizeSel.value));
        addPrintBtn.textContent = already ? "In your basket" : "Add print to basket";
        addPrintBtn.disabled = already;
      };
      printSizeSel.addEventListener("change", syncPrintBtn);
      addPrintBtn.addEventListener("click", () => {
        addPrintToBasket(w.id, printSizeSel.value);
        syncPrintBtn();
      });
      syncPrintBtn();
    }
  }

  function renderBasket() {
    const lines = basketLines();
    const sub = lines.reduce((n, l) => n + l.price, 0);
    app.innerHTML = `
      <section class="commerce-section">
        <p class="kicker">Your basket</p>
        <h1>${lines.length === 0 ? "Empty for now" : lines.length === 1 ? "One item" : lines.length + " items"}</h1>
        <div class="commerce-grid">
          <div>
            ${lines.map((l) => `
              <div class="basket-line">
                <img src="${esc(RoseAirtable.thumbUrl(l.painting.imageUrl))}" alt="${esc(l.painting.title)}">
                <div class="info">
                  <p class="title">${esc(l.painting.title)}</p>
                  <p class="work-meta" style="margin:0 0 8px">${l.kind === "print" ? esc(l.size) + " print · unframed, rolled in a tube" : esc(l.painting.size) + " · Original"}</p>
                  <button class="btn-text" data-remove="${esc(l.key)}">Remove</button>
                </div>
                <p style="margin:0;font-size:16px">${money(l.price)}</p>
              </div>`).join("")}
            ${lines.length === 0 ? `<div class="basket-empty"><p>Nothing here yet.</p><a href="#/" class="btn-outline" data-open="__shop">Browse the originals</a></div>` : ""}
          </div>
          <aside class="summary-card">
            <p class="kicker">Summary</p>
            <div class="summary-row"><span>Items (${lines.length})</span><span>${money(sub)}</span></div>
            <div class="summary-total"><span>Total</span><span>${money(sub)}</span></div>
            <button class="btn" style="width:100%" id="toCheckout" ${lines.length ? "" : "disabled"}>Send enquiry</button>
            <p class="summary-note">This is an enquiry, not a payment. Rose will be in touch to confirm availability and arrange payment by bank transfer.</p>
          </aside>
        </div>
      </section>`;
    document.querySelectorAll("[data-remove]").forEach((btn) => {
      btn.addEventListener("click", () => removeFromBasket(btn.getAttribute("data-remove")));
    });
    const openShop = document.querySelector('[data-open="__shop"]');
    if (openShop) openShop.addEventListener("click", (e) => { e.preventDefault(); go("#/"); });
    const toCheckout = document.getElementById("toCheckout");
    if (toCheckout) toCheckout.addEventListener("click", () => go("#/checkout"));
  }

  function renderCheckout() {
    const lines = basketLines();
    if (lines.length === 0) { go("#/basket"); return; }
    const sub = lines.reduce((n, l) => n + l.price, 0);
    const hasPrint = lines.some((l) => l.kind === "print");
    app.innerHTML = `
      <section class="commerce-section">
        <a href="#/basket" class="back-link" data-open="__basket">← Back to basket</a>
        <h1>Send an enquiry</h1>
        <div class="commerce-grid">
          <form id="enquiryForm" novalidate>
            <fieldset>
              <legend>Your details</legend>
              <label class="form-field">Full name
                <input type="text" name="name" placeholder="Alice Trelawny" required>
              </label>
              <label class="form-field">Email
                <input type="email" name="email" placeholder="alice@example.co.uk" required>
              </label>
              <label class="form-field">Phone <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">optional</span>
                <input type="tel" name="phone" placeholder="07…">
              </label>
              <label class="form-field">Delivery address <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">${hasPrint ? "needed for prints" : "optional"}</span>
                <textarea name="address" rows="2" placeholder="Where should this be sent?"></textarea>
              </label>
              <label class="form-field">Message <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">optional</span>
                <textarea name="message" rows="4" placeholder="Anything you'd like to ask, or let Rose know here."></textarea>
              </label>
            </fieldset>
            <div id="formStatus"></div>
            <button type="submit" class="btn" id="submitBtn">Send enquiry — ${money(sub)}</button>
            <p class="summary-note">Rose will be in touch to confirm availability and arrange payment by bank transfer. This does not charge you anything now.</p>
          </form>
          <aside class="summary-card">
            <p class="kicker">Your basket</p>
            <div style="display:flex;flex-direction:column;gap:14px;margin-bottom:18px">
              ${lines.map((l) => `
                <div style="display:flex;gap:12px;align-items:center">
                  <img src="${esc(RoseAirtable.thumbUrl(l.painting.imageUrl))}" alt="${esc(l.painting.title)}" style="width:56px;height:56px;object-fit:cover;background:var(--sand)">
                  <div style="flex:1;min-width:0">
                    <p style="margin:0;font-family:var(--display);font-size:17px">${esc(l.painting.title)}</p>
                    <p style="margin:0;font-size:12px;color:var(--muted)">${esc(lineLabel(l))}</p>
                  </div>
                  <p style="margin:0;font-size:14px">${money(l.price)}</p>
                </div>`).join("")}
            </div>
            <div class="summary-total"><span>Total</span><span>${money(sub)}</span></div>
          </aside>
        </div>
      </section>`;

    document.querySelector('[data-open="__basket"]').addEventListener("click", (e) => { e.preventDefault(); go("#/basket"); });
    document.getElementById("enquiryForm").addEventListener("submit", onSubmitEnquiry);
  }

  async function onSubmitEnquiry(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById("submitBtn");
    const statusEl = document.getElementById("formStatus");
    const lines = basketLines();
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      address: form.address.value.trim(),
      message: form.message.value.trim()
    };
    if (!data.name || !data.email) {
      statusEl.innerHTML = `<p class="form-error">Please add your name and email so Rose can reply.</p>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    statusEl.innerHTML = "";

    const itemsText = lines.map((l) => `${l.painting.title} (${lineLabel(l)}) — ${money(l.price)}`).join("\n");
    const total = lines.reduce((n, l) => n + l.price, 0);
    const submittedAt = new Date().toLocaleString("en-GB");
    const messageParts = [];
    if (data.message) messageParts.push(data.message);
    if (data.address) messageParts.push("Delivery address:\n" + data.address);
    const combinedMessage = messageParts.join("\n\n");

    const templateParams = {
      // email_kind/list_label/highlight_label/footer_label let this same
      // template also serve the dashboard's login-link email (see
      // netlify/functions/auth.js) — keep these matching the template's
      // original wording so enquiry emails look exactly as before.
      email_kind: "New Shop Enquiry",
      list_label: "Paintings enquired about",
      highlight_label: "Total",
      footer_label: "Submitted",
      action_html: "",
      to_email: CFG.contact.email,
      from_name: data.name,
      from_email: data.email,
      from_phone: data.phone || "—",
      message: combinedMessage || "—",
      items: itemsText,
      total: money(total),
      submitted_at: submittedAt
    };

    let emailOk = false;
    try {
      if (!window.emailjs || CFG.emailjs.templateId.indexOf("TODO_") === 0) {
        throw new Error("Email isn't configured yet");
      }
      await emailjs.send(CFG.emailjs.serviceId, CFG.emailjs.templateId, templateParams);
      emailOk = true;
    } catch (err) {
      console.warn("EmailJS send failed:", err);
    }

    // Best-effort: log the enquiry to Airtable too, so it shows on Rose's
    // dashboard even if this device never opens her inbox. Non-blocking.
    fetch("/.netlify/functions/enquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: data.name,
        email: data.email,
        phone: data.phone,
        message: combinedMessage,
        items: itemsText,
        total
      })
    }).catch((err) => console.warn("Enquiry logging failed:", err));

    if (emailOk) {
      state.lastOrder = { lines, total, name: data.name };
      state.basket = [];
      saveBasket();
      renderBasketCount();
      go("#/confirm");
    } else {
      statusEl.innerHTML = `<p class="form-error">Something went wrong sending your enquiry. You can also email Rose directly at
        <a href="mailto:${esc(CFG.contact.email)}">${esc(CFG.contact.email)}</a>.</p>`;
      submitBtn.disabled = false;
      submitBtn.textContent = "Try again";
    }
  }

  function renderConfirm() {
    const order = state.lastOrder;
    app.innerHTML = `
      <section class="confirm-wrap">
        <p class="kicker">Enquiry sent</p>
        <h1>Thank you${order && order.name ? ", " + esc(order.name.split(" ")[0]) : ""}</h1>
        <p class="lede">Rose will be in touch to confirm availability and arrange payment by bank transfer.</p>
        <p style="color:var(--muted);font-size:15px;line-height:1.75;margin:0 0 30px">A copy has been sent to Rose. If you don't hear back within a few days, feel free to email her directly at
          <a href="mailto:${esc(CFG.contact.email)}">${esc(CFG.contact.email)}</a>.</p>
        <a href="#/" class="btn-outline" data-open="__shop">Back to the shop</a>
      </section>`;
    document.querySelector('[data-open="__shop"]').addEventListener("click", (e) => { e.preventDefault(); go("#/"); });
  }

  /* ---------------- boot ---------------- */

  basketToggle.addEventListener("click", () => { state.drawerOpen = !state.drawerOpen; renderDrawer(); });
  window.addEventListener("hashchange", renderScreen);

  renderAll();
  RoseAirtable.fetchPaintings()
    .then((paintings) => { state.paintings = paintings; state.loaded = true; renderAll(); })
    .catch((err) => { state.error = err.message; renderAll(); });
})();

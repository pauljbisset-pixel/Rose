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

  const state = {
    paintings: [],
    loaded: false,
    error: null,
    filter: "all",
    basket: loadBasket(),
    drawerOpen: false,
    lastOrder: null
  };

  if (CFG.emailjs.publicKey && window.emailjs) {
    emailjs.init({ publicKey: CFG.emailjs.publicKey });
  }

  function loadBasket() {
    try {
      const raw = localStorage.getItem(BASKET_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveBasket() {
    try {
      localStorage.setItem(BASKET_KEY, JSON.stringify(state.basket));
    } catch (e) { /* private browsing / storage disabled — basket just won't persist */ }
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

  function basketPaintings() {
    return state.basket.map(byId).filter(Boolean);
  }

  function addToBasket(id) {
    if (state.basket.indexOf(id) === -1) {
      state.basket.push(id);
      saveBasket();
    }
    state.drawerOpen = true;
    renderAll();
  }

  function removeFromBasket(id) {
    state.basket = state.basket.filter((b) => b !== id);
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
    const items = basketPaintings();
    const sub = items.reduce((n, w) => n + w.price, 0);
    drawerRoot.innerHTML = `
      <div class="drawer-backdrop" id="drawerBackdrop">
        <aside class="drawer" role="dialog" aria-label="Basket">
          <div class="drawer-head">
            <p class="kicker" style="margin:0">Your basket · ${items.length}</p>
            <button class="drawer-close" id="drawerClose" aria-label="Close">&times;</button>
          </div>
          <div class="drawer-body">
            ${items.length ? items.map(drawerLineHtml).join("") : `<p style="text-align:center;padding:28px 0;font-family:var(--display);font-style:italic;color:var(--ink-soft)">Your basket is empty.</p>`}
          </div>
          <div class="drawer-foot">
            <div class="summary-total" style="margin:0 0 16px"><span>Subtotal</span><span>${money(sub)}</span></div>
            <button class="btn" style="width:100%" id="drawerCheckout" ${items.length ? "" : "disabled"}>Checkout</button>
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

  function drawerLineHtml(w) {
    return `
      <div style="display:flex;gap:14px;align-items:flex-start">
        <img src="${esc(RoseAirtable.thumbUrl(w.imageUrl))}" alt="${esc(w.title)}" style="width:74px;height:74px;object-fit:cover;background:var(--sand)">
        <div style="flex:1;min-width:0">
          <p style="margin:0 0 3px;font-family:var(--display);font-size:19px;line-height:1.2">${esc(w.title)}</p>
          <p style="margin:0 0 6px;font-size:12px;color:var(--muted)">${esc(w.size)}</p>
          <button class="btn-text" data-remove="${esc(w.id)}">Remove</button>
        </div>
        <p style="margin:0;font-size:15px">${money(w.price)}</p>
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
    const shown = state.paintings.filter((w) => state.filter === "all" || w.category === state.filter);
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
            <p class="kicker">Available Work</p>
            <h2 style="margin:0">Originals</h2>
          </div>
          ${cats.length ? `<div class="filters" id="filters">
            <button class="chip ${state.filter === "all" ? "on" : ""}" data-filter="all">All ${state.paintings.length}</button>
            ${cats.map((c) => `<button class="chip ${state.filter === c ? "on" : ""}" data-filter="${esc(c)}">${esc(c)}</button>`).join("")}
          </div>` : ""}
        </div>
        <p class="filters-note">Every painting is an original, signed and ready to hang. Enquire below to arrange payment by bank transfer and delivery or collection from Instow.</p>
        ${shown.length ? `<div class="shop-grid">${shown.map(cardHtml).join("")}</div>` :
          `<div class="basket-empty" style="margin:32px 0"><p>No paintings available in this category right now.</p></div>`}
      </div>`;

    document.querySelectorAll("[data-filter]").forEach((btn) => {
      btn.addEventListener("click", () => { state.filter = btn.getAttribute("data-filter"); renderScreen(); });
    });
    bindCardActions();
  }

  function cardHtml(w) {
    const inBasket = state.basket.indexOf(w.id) > -1;
    return `
      <article class="work-card">
        <div class="work-figure" data-open="${esc(w.id)}">
          <img src="${esc(RoseAirtable.thumbUrl(w.imageUrl))}" alt="${esc(w.title)}" loading="lazy">
        </div>
        <a href="#/work/${encodeURIComponent(w.id)}" class="work-title" data-open="${esc(w.id)}">${esc(w.title)}</a>
        <p class="work-meta">${esc(w.size)}</p>
        <div class="work-price-row">
          <p class="work-price">${money(w.price)}</p>
        </div>
        <button class="btn-outline" data-add="${esc(w.id)}">${inBasket ? "In your basket" : "Add to basket"}</button>
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
        addToBasket(el.getAttribute("data-add"));
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
    const inBasket = state.basket.indexOf(w.id) > -1;
    app.innerHTML = `
      <section class="commerce-section" style="max-width:${1180 - 2 * 40}px">
        <a href="#/" class="back-link" data-open="__shop">← Back to the shop</a>
        <div class="detail-grid">
          <div class="detail-image">
            <img src="${esc(RoseAirtable.fullUrl(w.imageUrl))}" alt="${esc(w.title)}">
          </div>
          <div class="detail-info">
            <p class="kicker">Original · one of a kind</p>
            <h1>${esc(w.title)}</h1>
            <p class="detail-price">${money(w.price)}</p>
            <p class="detail-desc">${esc(w.description)}</p>
            <dl class="detail-facts">
              <dt>Medium</dt><dd>Oil, wax &amp; foraged seaweed</dd>
              <dt>Size</dt><dd>${esc(w.size)}</dd>
            </dl>
            <button class="btn" data-add="${esc(w.id)}">${inBasket ? "In your basket" : "Add to basket"}</button>
          </div>
        </div>
      </section>`;
    document.querySelector('[data-open="__shop"]').addEventListener("click", (e) => { e.preventDefault(); go("#/"); });
    document.querySelectorAll("[data-add]").forEach((el) => {
      el.addEventListener("click", () => addToBasket(el.getAttribute("data-add")));
    });
  }

  function renderBasket() {
    const items = basketPaintings();
    const sub = items.reduce((n, w) => n + w.price, 0);
    app.innerHTML = `
      <section class="commerce-section">
        <p class="kicker">Your basket</p>
        <h1>${items.length === 0 ? "Empty for now" : items.length === 1 ? "One painting" : items.length + " paintings"}</h1>
        <div class="commerce-grid">
          <div>
            ${items.map((w) => `
              <div class="basket-line">
                <img src="${esc(RoseAirtable.thumbUrl(w.imageUrl))}" alt="${esc(w.title)}">
                <div class="info">
                  <p class="title">${esc(w.title)}</p>
                  <p class="work-meta" style="margin:0 0 8px">${esc(w.size)} · Original</p>
                  <button class="btn-text" data-remove="${esc(w.id)}">Remove</button>
                </div>
                <p style="margin:0;font-size:16px">${money(w.price)}</p>
              </div>`).join("")}
            ${items.length === 0 ? `<div class="basket-empty"><p>Nothing here yet.</p><a href="#/" class="btn-outline" data-open="__shop">Browse the originals</a></div>` : ""}
          </div>
          <aside class="summary-card">
            <p class="kicker">Summary</p>
            <div class="summary-row"><span>Paintings (${items.length})</span><span>${money(sub)}</span></div>
            <div class="summary-total"><span>Total</span><span>${money(sub)}</span></div>
            <button class="btn" style="width:100%" id="toCheckout" ${items.length ? "" : "disabled"}>Send enquiry</button>
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
    const items = basketPaintings();
    if (items.length === 0) { go("#/basket"); return; }
    const sub = items.reduce((n, w) => n + w.price, 0);
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
              ${items.map((w) => `
                <div style="display:flex;gap:12px;align-items:center">
                  <img src="${esc(RoseAirtable.thumbUrl(w.imageUrl))}" alt="${esc(w.title)}" style="width:56px;height:56px;object-fit:cover;background:var(--sand)">
                  <div style="flex:1;min-width:0">
                    <p style="margin:0;font-family:var(--display);font-size:17px">${esc(w.title)}</p>
                    <p style="margin:0;font-size:12px;color:var(--muted)">${esc(w.size)}</p>
                  </div>
                  <p style="margin:0;font-size:14px">${money(w.price)}</p>
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
    const items = basketPaintings();
    const data = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      phone: form.phone.value.trim(),
      message: form.message.value.trim()
    };
    if (!data.name || !data.email) {
      statusEl.innerHTML = `<p class="form-error">Please add your name and email so Rose can reply.</p>`;
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sending…";
    statusEl.innerHTML = "";

    const itemsText = items.map((w) => `${w.title} — ${money(w.price)}`).join("\n");
    const total = items.reduce((n, w) => n + w.price, 0);
    const submittedAt = new Date().toLocaleString("en-GB");

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
      message: data.message || "—",
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
        message: data.message,
        items: itemsText,
        total
      })
    }).catch((err) => console.warn("Enquiry logging failed:", err));

    if (emailOk) {
      state.lastOrder = { items, total, name: data.name };
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
  RoseAirtable.fetchAvailablePaintings()
    .then((paintings) => { state.paintings = paintings; state.loaded = true; renderAll(); })
    .catch((err) => { state.error = err.message; renderAll(); });
})();

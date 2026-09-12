/* ===========================================================
   Rose Budge — studio dashboard
   Netlify Identity login gate, Airtable CRUD via the gated
   /.netlify/functions/paintings + /enquiries functions, and a
   Cloudinary unsigned upload widget for photos from Rose's phone.
=========================================================== */
(function () {
  const CFG = window.ROSE_CONFIG;
  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logoutBtn");

  const state = {
    user: null,
    paintings: [],
    paintingsLoaded: false,
    enquiries: [],
    enquiriesLoaded: false,
    tab: "works",
    draft: null,
    draftIsNew: false,
    dragFrom: null,
    dragOver: null,
    savedNote: "Changes here update the shop straight away. Nothing needs code.",
    busy: false,
    errorMsg: ""
  };

  function money(n) {
    return "£" + Number(n || 0).toLocaleString("en-GB");
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  async function authFetch(path, options) {
    if (!state.user) throw new Error("Not signed in");
    const token = await state.user.jwt();
    const res = await fetch(path, Object.assign({}, options, {
      headers: Object.assign(
        { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        (options && options.headers) || {}
      )
    }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }

  /* ---------------- data loading ---------------- */

  async function loadPaintings() {
    const data = await authFetch("/.netlify/functions/paintings", { method: "GET" });
    state.paintings = data.records;
    state.paintingsLoaded = true;
  }

  async function loadEnquiries() {
    const data = await authFetch("/.netlify/functions/enquiries", { method: "GET" });
    state.enquiries = data.records;
    state.enquiriesLoaded = true;
  }

  /* ---------------- auth screens ---------------- */

  function renderLoginGate(notice) {
    app.innerHTML = `
      <div class="login-gate">
        <p class="kicker">Studio</p>
        <h1>Rose's dashboard</h1>
        <p>Sign in to add paintings, edit details, reorder the shop, and mark things sold.</p>
        ${notice ? `<p class="form-error" style="text-align:left;margin-bottom:20px">${esc(notice)}</p>` : ""}
        <button class="btn" id="loginBtn">Sign in</button>
      </div>`;
    document.getElementById("loginBtn").addEventListener("click", () => netlifyIdentity.open("login"));
    logoutBtn.style.display = "none";
  }

  function renderLoading(msg) {
    app.innerHTML = `<div style="padding:80px 0;text-align:center;color:var(--muted)">${esc(msg || "Loading…")}</div>`;
  }

  function renderLoadError(msg) {
    app.innerHTML = `<div style="padding:80px 0;text-align:center;color:var(--muted)">
      <p>${esc(msg)}</p>
      <button class="btn-outline" id="retryBtn">Try again</button>
    </div>`;
    document.getElementById("retryBtn").addEventListener("click", boot);
  }

  /* ---------------- main dashboard ---------------- */

  async function renderApp() {
    logoutBtn.style.display = "inline-block";
    if (!state.paintingsLoaded) {
      renderLoading("Loading your paintings…");
      try {
        await loadPaintings();
      } catch (err) {
        renderLoadError(err.message);
        return;
      }
    }
    renderDashboard();
  }

  function stats() {
    const works = state.paintings;
    const available = works.filter((w) => w.status === "Available").length;
    const sold = works.filter((w) => w.status === "Sold").length;
    const takings = works.filter((w) => w.status === "Sold").reduce((n, w) => n + w.price, 0);
    const avg = works.length ? Math.round(works.reduce((n, w) => n + w.price, 0) / works.length) : 0;
    return [
      { label: "Available", value: available, note: "listed in the shop" },
      { label: "Sold", value: sold, note: "marked sold to date" },
      { label: "Takings", value: money(takings), note: "from sold paintings" },
      { label: "Average price", value: money(avg), note: "across all originals" }
    ];
  }

  function renderDashboard() {
    const draft = state.draft;
    app.innerHTML = `
      <div class="dash-header">
        <div>
          <p class="kicker">Studio</p>
          <h1>Rose's dashboard</h1>
        </div>
        <button class="btn" id="newWorkBtn">+ Add a painting</button>
      </div>

      <div class="stats-row">
        ${stats().map((s) => `
          <div class="stat-card">
            <p class="stat-label">${esc(s.label)}</p>
            <p class="stat-value">${s.value}</p>
            <p class="stat-note">${esc(s.note)}</p>
          </div>`).join("")}
      </div>

      <div class="tabs">
        <button class="tab-btn ${state.tab === "works" ? "on" : ""}" id="tabWorks">Paintings</button>
        <button class="tab-btn ${state.tab === "enquiries" ? "on" : ""}" id="tabEnquiries">Enquiries</button>
      </div>

      <div id="tabBody"></div>
    `;

    document.getElementById("newWorkBtn").addEventListener("click", () => {
      state.draft = { id: null, title: "", price: 0, size: "", description: "", category: "", status: "Available", imageUrl: "" };
      state.draftIsNew = true;
      state.savedNote = "Drop a photo in, give it a title and a price, then save.";
      state.tab = "works";
      renderDashboard();
    });
    document.getElementById("tabWorks").addEventListener("click", () => { state.tab = "works"; renderDashboard(); });
    document.getElementById("tabEnquiries").addEventListener("click", async () => {
      state.tab = "enquiries";
      renderDashboard();
      if (!state.enquiriesLoaded) {
        const body = document.getElementById("tabBody");
        body.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--muted)">Loading enquiries…</div>`;
        try { await loadEnquiries(); } catch (err) { body.innerHTML = `<p class="form-error">${esc(err.message)}</p>`; return; }
        if (state.tab === "enquiries") renderTabBody();
      }
    });

    renderTabBody();
  }

  function renderTabBody() {
    const body = document.getElementById("tabBody");
    if (!body) return;
    if (state.tab === "works") {
      body.innerHTML = worksTabHtml();
      bindWorksTab();
    } else {
      body.innerHTML = enquiriesTabHtml();
      bindEnquiriesTab();
    }
  }

  /* ---------------- Paintings tab ---------------- */

  function worksTabHtml() {
    const draft = state.draft;
    return `
      <div class="dash-grid">
        <div>
          <p class="row-hint">Drag a row by the handle to change the order paintings appear in the shop.</p>
          <div class="rows" id="rows">
            ${state.paintings.map((w, i) => rowHtml(w, i)).join("")}
          </div>
        </div>
        <div class="edit-card">
          ${draft ? editFormHtml(draft) : `<p style="color:var(--muted);font-size:14px">Select a painting to edit, or add a new one.</p>`}
        </div>
      </div>`;
  }

  function rowHtml(w, i) {
    const pillClass = w.status === "Sold" ? "pill-sold" : w.status === "Reserved" ? "pill-reserved" : "pill-available";
    const editing = state.draft && state.draft.id === w.id;
    const dragOver = state.dragOver === i ? "over" : "";
    return `
      <div class="admin-row ${editing ? "editing" : ""} ${dragOver}" draggable="true" data-row="${i}">
        <span class="drag-handle">⠿</span>
        <img src="${esc(thumbFor(w.imageUrl))}" alt="">
        <div class="info">
          <p class="t">${esc(w.title || "Untitled")}</p>
          <p class="m">${money(w.price)} · ${esc(w.size)}</p>
        </div>
        <span class="pill ${pillClass}">${esc(w.status)}</span>
        <button class="btn-outline" data-edit="${esc(w.id)}">Edit</button>
      </div>`;
  }

  function thumbFor(url) {
    if (url && url.indexOf("res.cloudinary.com") > -1) return url.replace("/upload/", "/upload/w_120,h_120,c_fill,q_auto,f_auto/");
    return url;
  }

  function editFormHtml(draft) {
    return `
      <p class="kicker">${state.draftIsNew ? "Painting details" : "Editing painting"}</p>
      <div class="upload-row">
        <img class="upload-thumb" id="uploadThumb" src="${draft.imageUrl ? esc(thumbFor(draft.imageUrl)) : ""}" style="${draft.imageUrl ? "" : "visibility:hidden"}">
        <div class="upload-drop">
          <p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--ink-soft)">PHOTO</p>
          <button type="button" id="uploadBtn">${draft.imageUrl ? "Replace photo" : "Add a photo"}</button>
          <p style="margin:0;font-size:12px;color:var(--muted)">JPG from your phone is fine</p>
        </div>
      </div>
      <label class="form-field" style="margin-bottom:12px">Title
        <input type="text" id="fTitle" value="${esc(draft.title)}">
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
        <label class="form-field">Price (£)
          <input type="number" id="fPrice" value="${draft.price}">
        </label>
        <label class="form-field">Size
          <input type="text" id="fSize" value="${esc(draft.size)}" placeholder="60 × 50 cm">
        </label>
      </div>
      <label class="form-field" style="margin-bottom:14px">Description
        <textarea id="fDesc" rows="4">${esc(draft.description)}</textarea>
      </label>
      <div style="margin-bottom:6px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Status</p>
        <div class="status-buttons">
          <button class="chip ${draft.status === "Available" ? "on" : ""}" data-status="Available">Available</button>
          <button class="chip ${draft.status === "Reserved" ? "on" : ""}" data-status="Reserved">Reserved</button>
          <button class="chip ${draft.status === "Sold" ? "on" : ""}" data-status="Sold">Sold</button>
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn" id="saveDraftBtn" style="flex:1">Save</button>
        <button class="btn-outline" id="cancelDraftBtn">Cancel</button>
        ${!state.draftIsNew ? `<button class="btn-text" id="deleteDraftBtn" style="color:#B4403A">Delete</button>` : ""}
      </div>
      <p class="form-msg" style="color:var(--muted)">${esc(state.savedNote)}</p>
      ${state.errorMsg ? `<p class="form-error">${esc(state.errorMsg)}</p>` : ""}
    `;
  }

  function bindWorksTab() {
    // drag reorder
    const rows = document.getElementById("rows");
    if (rows) {
      rows.querySelectorAll(".admin-row").forEach((rowEl) => {
        const i = Number(rowEl.getAttribute("data-row"));
        rowEl.addEventListener("dragstart", () => { state.dragFrom = i; rowEl.classList.add("dragging"); });
        rowEl.addEventListener("dragend", () => { rowEl.classList.remove("dragging"); state.dragFrom = null; state.dragOver = null; renderTabBody(); });
        rowEl.addEventListener("dragover", (e) => {
          e.preventDefault();
          if (state.dragOver !== i) { state.dragOver = i; renderTabBody(); }
        });
        rowEl.addEventListener("drop", (e) => {
          e.preventDefault();
          if (state.dragFrom !== null && state.dragFrom !== i) reorder(state.dragFrom, i);
          state.dragFrom = null; state.dragOver = null;
        });
      });
    }

    document.querySelectorAll("[data-edit]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const w = state.paintings.find((p) => p.id === btn.getAttribute("data-edit"));
        if (!w) return;
        state.draft = Object.assign({}, w);
        state.draftIsNew = false;
        state.savedNote = `Editing "${w.title}".`;
        state.errorMsg = "";
        renderTabBody();
      });
    });

    if (!state.draft) return;

    document.getElementById("uploadBtn").addEventListener("click", openUploadWidget);
    document.querySelectorAll("[data-status]").forEach((btn) => {
      btn.addEventListener("click", () => { state.draft.status = btn.getAttribute("data-status"); renderTabBody(); });
    });
    document.getElementById("saveDraftBtn").addEventListener("click", saveDraft);
    document.getElementById("cancelDraftBtn").addEventListener("click", () => {
      state.draft = null;
      state.savedNote = "Edit discarded.";
      renderTabBody();
    });
    const delBtn = document.getElementById("deleteDraftBtn");
    if (delBtn) delBtn.addEventListener("click", deleteDraft);

    ["fTitle", "fPrice", "fSize", "fDesc"].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        state.draft.title = document.getElementById("fTitle").value;
        state.draft.price = Number(document.getElementById("fPrice").value) || 0;
        state.draft.size = document.getElementById("fSize").value;
        state.draft.description = document.getElementById("fDesc").value;
      });
    });
  }

  function openUploadWidget() {
    if (!window.cloudinary) {
      state.errorMsg = "The upload widget didn't load — check your connection and try again.";
      renderTabBody();
      return;
    }
    if (CFG.cloudinary.cloudName.indexOf("TODO_") === 0) {
      state.errorMsg = "Cloudinary isn't configured yet — see SETUP.md.";
      renderTabBody();
      return;
    }
    const widget = cloudinary.createUploadWidget(
      {
        cloudName: CFG.cloudinary.cloudName,
        uploadPreset: CFG.cloudinary.uploadPreset,
        sources: ["local", "camera", "url"],
        multiple: false,
        folder: "rose-budge",
        maxFileSize: 15000000
      },
      (error, result) => {
        if (error) { console.warn(error); return; }
        if (result && result.event === "success") {
          state.draft.imageUrl = result.info.secure_url;
          renderTabBody();
        }
      }
    );
    widget.open();
  }

  async function saveDraft() {
    const d = state.draft;
    if (!d.title.trim()) {
      state.errorMsg = "Give the painting a title before saving.";
      renderTabBody();
      return;
    }
    state.errorMsg = "";
    const saveBtn = document.getElementById("saveDraftBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      if (state.draftIsNew) {
        const sortOrder = state.paintings.reduce((max, w) => Math.max(max, w.sortOrder), 0) + 1;
        const data = await authFetch("/.netlify/functions/paintings", {
          method: "POST",
          body: JSON.stringify(Object.assign({}, d, { sortOrder }))
        });
        state.paintings.push(data.record);
      } else {
        const data = await authFetch("/.netlify/functions/paintings", {
          method: "PATCH",
          body: JSON.stringify(d)
        });
        state.paintings = state.paintings.map((w) => (w.id === data.record.id ? data.record : w));
      }
      state.savedNote = `Saved. "${d.title}" is now ${d.status.toLowerCase()} in the shop.`;
      state.draft = null;
      renderDashboard();
    } catch (err) {
      state.errorMsg = err.message;
      renderTabBody();
    }
  }

  async function deleteDraft() {
    const d = state.draft;
    if (!confirm(`Remove "${d.title}" from the shop for good?`)) return;
    try {
      await authFetch(`/.netlify/functions/paintings?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      state.paintings = state.paintings.filter((w) => w.id !== d.id);
      state.draft = null;
      state.savedNote = "Painting removed.";
      renderDashboard();
    } catch (err) {
      state.errorMsg = err.message;
      renderTabBody();
    }
  }

  function reorder(from, to) {
    const list = state.paintings.slice();
    const [moved] = list.splice(from, 1);
    list.splice(to, 0, moved);
    list.forEach((w, i) => { w.sortOrder = i + 1; });
    state.paintings = list;
    renderTabBody();
    authFetch("/.netlify/functions/paintings", {
      method: "PATCH",
      body: JSON.stringify({ reorder: list.map((w) => ({ id: w.id, sortOrder: w.sortOrder })) })
    }).catch(async (err) => {
      state.errorMsg = "Couldn't save the new order: " + err.message;
      try { await loadPaintings(); } catch (e) { /* ignore */ }
      renderDashboard();
    });
  }

  /* ---------------- Enquiries tab ---------------- */

  function enquiriesTabHtml() {
    if (!state.enquiries.length) {
      return `<p style="color:var(--muted)">No enquiries yet.</p>`;
    }
    return `
      <div class="rows">
        ${state.enquiries.map(enquiryRowHtml).join("")}
      </div>`;
  }

  function enquiryRowHtml(e) {
    const pillClass = e.status === "Closed" ? "pill-closed" : e.status === "Contacted" ? "pill-contacted" : "pill-new";
    const date = e.submitted ? new Date(e.submitted).toLocaleDateString("en-GB") : "";
    return `
      <div class="enquiry-row">
        <div class="info">
          <p class="n">${esc(e.name)}</p>
          <p class="i">${esc(e.email)}${e.phone ? " · " + esc(e.phone) : ""}</p>
          <p class="i" style="white-space:pre-line">${esc(e.items)}</p>
          ${e.message ? `<p class="i" style="font-style:italic">"${esc(e.message)}"</p>` : ""}
        </div>
        <p style="margin:0;font-size:13px;color:var(--muted);min-width:100px">${esc(date)}</p>
        <p style="margin:0;font-size:15px;min-width:70px">${money(e.total)}</p>
        <select class="chip" data-enquiry-status="${esc(e.id)}" style="min-width:120px">
          <option value="New" ${e.status === "New" ? "selected" : ""}>New</option>
          <option value="Contacted" ${e.status === "Contacted" ? "selected" : ""}>Contacted</option>
          <option value="Closed" ${e.status === "Closed" ? "selected" : ""}>Closed</option>
        </select>
      </div>`;
  }

  function bindEnquiriesTab() {
    document.querySelectorAll("[data-enquiry-status]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        const id = sel.getAttribute("data-enquiry-status");
        const status = sel.value;
        try {
          await authFetch("/.netlify/functions/enquiries", { method: "PATCH", body: JSON.stringify({ id, status }) });
          state.enquiries = state.enquiries.map((e) => (e.id === id ? Object.assign({}, e, { status }) : e));
        } catch (err) {
          alert("Couldn't update that enquiry: " + err.message);
          renderTabBody();
        }
      });
    });
  }

  /* ---------------- boot / identity ---------------- */

  function boot() {
    state.paintingsLoaded = false;
    state.errorMsg = "";
    renderApp();
  }

  logoutBtn.addEventListener("click", () => netlifyIdentity.logout());

  netlifyIdentity.on("init", (user) => {
    if (user) { state.user = user; boot(); } else { renderLoginGate(); }
  });
  netlifyIdentity.on("error", (err) => {
    // The widget can fail silently while auto-processing an invite/recovery
    // link (expired, already used, or a network hiccup) and leave its modal
    // stuck open and invisible, blocking every click on the page. Force it
    // closed and give a plain-language way forward instead of a frozen page.
    console.warn("Identity error:", err);
    netlifyIdentity.close();
    renderLoginGate(
      "That link has expired or has already been used. Click Sign In below, " +
      "then use “Forgot password?” to get a fresh one — and open it " +
      "as soon as it arrives, on the device you'll use to sign in."
    );
  });
  netlifyIdentity.on("login", (user) => {
    state.user = user;
    netlifyIdentity.close();
    boot();
  });
  netlifyIdentity.on("logout", () => {
    state.user = null;
    state.paintings = [];
    state.paintingsLoaded = false;
    renderLoginGate();
  });

  netlifyIdentity.init();

  // Belt and braces: if a hash token is present, the widget should resolve
  // it (via "login" or "error") within a few seconds. If it silently hangs
  // instead — a blocked iframe, a dropped request — force the modal closed
  // and hand back a usable page rather than leaving it frozen indefinitely.
  if (/(invite_token|confirmation_token|recovery_token|email_change_token)=/.test(window.location.hash)) {
    let resolved = false;
    netlifyIdentity.on("login", () => { resolved = true; });
    netlifyIdentity.on("error", () => { resolved = true; });
    setTimeout(() => {
      if (!resolved) {
        netlifyIdentity.close();
        renderLoginGate(
          "That link took too long to process. Click Sign In below, then " +
          "use “Forgot password?” to get a fresh one."
        );
      }
    }, 8000);
  }
})();

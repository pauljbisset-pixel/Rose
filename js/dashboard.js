/* ===========================================================
   Rose Budge — studio dashboard
   Own magic-link login (see js/config.js note + netlify/functions/
   auth.js) gates Airtable CRUD via /.netlify/functions/paintings +
   /enquiries, plus a Cloudinary unsigned upload widget for photos
   from Rose's phone.
=========================================================== */
(function () {
  const CFG = window.ROSE_CONFIG;
  const app = document.getElementById("app");
  const logoutBtn = document.getElementById("logoutBtn");
  const currentUserEmail = document.getElementById("currentUserEmail");

  const SESSION_KEY = "rb_session_v1";
  const DASH_STATE_KEY = "rb_dash_state_v1";
  const AWAY_THRESHOLD_MS = 1000 * 60 * 60 * 48; // show the recap after 2+ days away

  const state = {
    sessionToken: null,
    userEmail: null,
    paintings: [],
    paintingsLoaded: false,
    enquiries: [],
    enquiriesLoaded: false,
    lessons: [],
    lessonsLoaded: false,
    blogPosts: [],
    blogPostsLoaded: false,
    tab: "works",
    draft: null,
    draftIsNew: false,
    lessonDraft: null,
    lessonDraftIsNew: false,
    blogDraft: null,
    blogDraftIsNew: false,
    dragFrom: null,
    dragOver: null,
    savedNote: "Changes here update the shop straight away. Nothing needs code.",
    busy: false,
    errorMsg: "",
    recap: null
  };

  function money(n) {
    return "£" + Number(n || 0).toLocaleString("en-GB");
  }

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function formatLessonDateTime(iso) {
    if (!iso) return "No date set";
    const d = new Date(iso);
    const datePart = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    const timePart = d.toLocaleTimeString("en-GB", { hour: "numeric", minute: "2-digit" });
    return `${datePart}, ${timePart}`;
  }

  function toDatetimeLocal(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function fromDatetimeLocal(value) {
    if (!value) return "";
    return new Date(value).toISOString();
  }

  function saveSession(sessionToken, email) {
    state.sessionToken = sessionToken;
    state.userEmail = email;
    try { localStorage.setItem(SESSION_KEY, JSON.stringify({ sessionToken, email })); } catch (e) { /* ignore */ }
  }

  function loadStoredSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    state.sessionToken = null;
    state.userEmail = null;
    try { localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function loadDashState() {
    try { return JSON.parse(localStorage.getItem(DASH_STATE_KEY)); } catch (e) { return null; }
  }

  function saveDashState(s) {
    try { localStorage.setItem(DASH_STATE_KEY, JSON.stringify(s)); } catch (e) { /* ignore */ }
  }

  // Compares today's counts against whatever was recorded the last time
  // this browser opened the dashboard. Only localStorage-backed (no
  // Airtable schema needed) — if she opens the dashboard from a
  // different device first, it just skips the recap that once, no harm.
  function computeRecap() {
    const prev = loadDashState();
    const heartsTotal = state.paintings.reduce((n, w) => n + (w.hearts || 0), 0);
    const enquiriesCount = state.enquiries.length;
    const now = Date.now();
    let recap = null;
    if (prev && prev.lastSeenAt && (now - prev.lastSeenAt) > AWAY_THRESHOLD_MS) {
      const newEnquiries = Math.max(0, enquiriesCount - (prev.enquiriesCount || 0));
      const newHearts = Math.max(0, heartsTotal - (prev.heartsTotal || 0));
      if (newEnquiries > 0 || newHearts > 0) {
        const mostLoved = state.paintings.slice().sort((a, b) => (b.hearts || 0) - (a.hearts || 0))[0];
        recap = {
          days: Math.max(1, Math.round((now - prev.lastSeenAt) / (1000 * 60 * 60 * 24))),
          newEnquiries,
          newHearts,
          mostLoved: (mostLoved && mostLoved.hearts > 0) ? mostLoved : null
        };
      }
    }
    saveDashState({ lastSeenAt: now, enquiriesCount, heartsTotal });
    return recap;
  }

  async function authFetch(path, options) {
    if (!state.sessionToken) throw new Error("Not signed in");
    const res = await fetch(path, Object.assign({}, options, {
      headers: Object.assign(
        { "Content-Type": "application/json", Authorization: `Bearer ${state.sessionToken}` },
        (options && options.headers) || {}
      )
    }));
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) { clearSession(); renderLoginGate("Your session's expired — please sign in again."); }
      throw new Error(data.error || `Request failed (${res.status})`);
    }
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

  async function loadLessons() {
    const data = await authFetch("/.netlify/functions/lessons", { method: "GET" });
    state.lessons = data.records;
    state.lessonsLoaded = true;
  }

  async function loadBlogPosts() {
    const data = await authFetch("/.netlify/functions/blog", { method: "GET" });
    state.blogPosts = data.records;
    state.blogPostsLoaded = true;
  }

  /* ---------------- auth screens ---------------- */

  function renderLoginGate(notice) {
    app.innerHTML = `
      <div class="login-gate">
        <p class="kicker">Studio</p>
        <h1>Rose's dashboard</h1>
        <p>Enter your email and we'll send you a link to sign in — no password to remember.</p>
        ${notice ? `<p class="form-error" style="text-align:left;margin-bottom:20px">${esc(notice)}</p>` : ""}
        <form id="loginForm" style="display:flex;flex-direction:column;gap:14px;max-width:320px;margin:0 auto">
          <label class="form-field" style="text-align:left">Email
            <input type="email" id="loginEmail" placeholder="you@example.com" required>
          </label>
          <button type="submit" class="btn" id="loginBtn">Send me a link</button>
        </form>
        <p id="loginStatus" class="form-msg" style="color:var(--muted)"></p>
      </div>`;
    document.getElementById("loginForm").addEventListener("submit", onRequestLogin);
    logoutBtn.style.display = "none";
    currentUserEmail.style.display = "none";
  }

  async function onRequestLogin(e) {
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const btn = document.getElementById("loginBtn");
    const statusEl = document.getElementById("loginStatus");
    if (!email) return;
    btn.disabled = true;
    btn.textContent = "Sending…";
    statusEl.textContent = "";
    try {
      const res = await fetch("/.netlify/functions/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "request", email })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong sending the link.");
      }
      statusEl.style.color = "var(--sea)";
      statusEl.textContent = "If that email's set up for this dashboard, a sign-in link is on its way — check your inbox.";
      btn.textContent = "Link sent";
    } catch (err) {
      statusEl.style.color = "#B4403A";
      statusEl.textContent = err.message;
      btn.disabled = false;
      btn.textContent = "Send me a link";
    }
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
    currentUserEmail.style.display = "inline";
    currentUserEmail.textContent = state.userEmail ? `Signed in as ${state.userEmail}` : "";
    if (!state.paintingsLoaded) {
      renderLoading("Loading your paintings…");
      try {
        await loadPaintings();
        await loadEnquiries();
      } catch (err) {
        renderLoadError(err.message);
        return;
      }
      state.recap = computeRecap();
    }
    renderDashboard();
  }

  function stats() {
    const works = state.paintings;
    const available = works.filter((w) => w.status === "Available").length;
    const sold = works.filter((w) => w.status === "Sold").length;
    const takings = works.filter((w) => w.status === "Sold").reduce((n, w) => n + w.price, 0);
    const avg = works.length ? Math.round(works.reduce((n, w) => n + w.price, 0) / works.length) : 0;
    const cards = [
      { label: "Available", value: available, note: "listed in the shop" },
      { label: "Sold", value: sold, note: "marked sold to date" },
      { label: "Takings", value: money(takings), note: "from sold paintings" },
      { label: "Average price", value: money(avg), note: "across all originals" }
    ];
    const mostLoved = works.slice().sort((a, b) => (b.hearts || 0) - (a.hearts || 0))[0];
    if (mostLoved && mostLoved.hearts > 0) {
      cards.push({
        label: "Most loved",
        value: mostLoved.title,
        note: `${mostLoved.hearts} heart${mostLoved.hearts === 1 ? "" : "s"} from visitors`
      });
    }
    return cards;
  }

  function recapBannerHtml(r) {
    const blocks = [];
    if (r.newEnquiries) blocks.push({ value: r.newEnquiries, note: `new enquir${r.newEnquiries === 1 ? "y" : "ies"}` });
    if (r.newHearts) blocks.push({ value: r.newHearts, note: `heart${r.newHearts === 1 ? "" : "s"} given` });
    if (r.mostLoved) blocks.push({ value: r.mostLoved.title, note: `most loved · ${r.mostLoved.hearts} ♥`, small: true });
    return `
      <div class="recap-banner">
        <button class="recap-dismiss" id="dismissRecap" aria-label="Dismiss">&times;</button>
        <p class="kicker" style="color:var(--shell);opacity:.85;margin:0 0 6px">Welcome back</p>
        <p class="recap-lede">You've been away ${r.days} day${r.days === 1 ? "" : "s"} — here's what happened while you were gone.</p>
        <div class="recap-stats">
          ${blocks.map((b) => `
            <div>
              <p class="stat-value" style="color:var(--shell);${b.small ? "font-size:20px" : ""}">${esc(String(b.value))}</p>
              <p class="recap-note">${esc(b.note)}</p>
            </div>`).join("")}
        </div>
      </div>`;
  }

  function renderDashboard() {
    const draft = state.draft;
    app.innerHTML = `
      <div class="dash-header">
        <div>
          <p class="kicker">Studio</p>
          <h1>Rose's dashboard</h1>
        </div>
        <button class="btn" id="newItemBtn">+ ${state.tab === "lessons" ? "Add a lesson" : state.tab === "blog" ? "Write a post" : "Add a painting"}</button>
      </div>

      ${state.recap ? recapBannerHtml(state.recap) : ""}

      <div class="stats-row">
        ${stats().map((s) => `
          <div class="stat-card">
            <p class="stat-label">${esc(s.label)}</p>
            <p class="stat-value">${esc(String(s.value))}</p>
            <p class="stat-note">${esc(s.note)}</p>
          </div>`).join("")}
      </div>

      <div class="tabs">
        <button class="tab-btn ${state.tab === "works" ? "on" : ""}" id="tabWorks">Paintings</button>
        <button class="tab-btn ${state.tab === "lessons" ? "on" : ""}" id="tabLessons">Lessons</button>
        <button class="tab-btn ${state.tab === "blog" ? "on" : ""}" id="tabBlog">Journal</button>
        <button class="tab-btn ${state.tab === "enquiries" ? "on" : ""}" id="tabEnquiries">Enquiries</button>
      </div>

      <div id="tabBody"></div>
    `;

    const dismissRecap = document.getElementById("dismissRecap");
    if (dismissRecap) dismissRecap.addEventListener("click", () => { state.recap = null; renderDashboard(); });

    document.getElementById("newItemBtn").addEventListener("click", () => {
      if (state.tab === "lessons") {
        state.lessonDraft = { id: null, date: "", price: 45, capacity: 6, booked: 0, status: "Open", location: "", notes: "" };
        state.lessonDraftIsNew = true;
        state.savedNote = "Set a date and capacity, then save.";
      } else if (state.tab === "blog") {
        state.blogDraft = { id: null, title: "", excerpt: "", body: "", imageUrl: "", status: "Draft", generated: false };
        state.blogDraftIsNew = true;
        state.savedNote = "Write your post, then save it as a draft or publish straight away.";
      } else {
        state.draft = { id: null, title: "", price: 0, size: "", description: "", story: "", category: "", status: "Available", imageUrl: "" };
        state.draftIsNew = true;
        state.savedNote = "Drop a photo in, give it a title and a price, then save.";
        state.tab = "works";
      }
      renderDashboard();
    });
    document.getElementById("tabWorks").addEventListener("click", () => { state.tab = "works"; renderDashboard(); });
    document.getElementById("tabLessons").addEventListener("click", async () => {
      state.tab = "lessons";
      renderDashboard();
      if (!state.lessonsLoaded) {
        const body = document.getElementById("tabBody");
        body.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--muted)">Loading lessons…</div>`;
        try { await loadLessons(); } catch (err) { body.innerHTML = `<p class="form-error">${esc(err.message)}</p>`; return; }
        if (state.tab === "lessons") renderTabBody();
      }
    });
    document.getElementById("tabBlog").addEventListener("click", async () => {
      state.tab = "blog";
      renderDashboard();
      if (!state.blogPostsLoaded) {
        const body = document.getElementById("tabBody");
        body.innerHTML = `<div style="padding:40px 0;text-align:center;color:var(--muted)">Loading posts…</div>`;
        try { await loadBlogPosts(); } catch (err) { body.innerHTML = `<p class="form-error">${esc(err.message)}</p>`; return; }
        if (state.tab === "blog") renderTabBody();
      }
    });
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
    } else if (state.tab === "lessons") {
      body.innerHTML = lessonsTabHtml();
      bindLessonsTab();
    } else if (state.tab === "blog") {
      body.innerHTML = blogTabHtml();
      bindBlogTab();
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
      <label class="form-field" style="margin-bottom:14px">Story <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">optional — a personal note shown on the painting's page</span>
        <textarea id="fStory" rows="3" placeholder="e.g. Painted after a stormy walk to Instow beach…">${esc(draft.story)}</textarea>
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

    document.getElementById("uploadBtn").addEventListener("click", () => openUploadWidget((url) => { state.draft.imageUrl = url; }));
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

    ["fTitle", "fPrice", "fSize", "fDesc", "fStory"].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        state.draft.title = document.getElementById("fTitle").value;
        state.draft.price = Number(document.getElementById("fPrice").value) || 0;
        state.draft.size = document.getElementById("fSize").value;
        state.draft.description = document.getElementById("fDesc").value;
        state.draft.story = document.getElementById("fStory").value;
      });
    });
  }

  function openUploadWidget(onSuccess) {
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
          onSuccess(result.info.secure_url);
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

  /* ---------------- Lessons tab ---------------- */

  function lessonsTabHtml() {
    const draft = state.lessonDraft;
    return `
      <div class="dash-grid">
        <div>
          <p class="row-hint">Sessions are listed soonest first. The shop only shows Open, upcoming sessions with spots left — a session fills itself in automatically once Booked reaches Capacity.</p>
          <div class="rows" id="lessonRows">
            ${state.lessons.length ? state.lessons.map(lessonRowHtml).join("") : `<p style="color:var(--muted);font-size:14px">No lessons yet — add your first date.</p>`}
          </div>
        </div>
        <div class="edit-card">
          ${draft ? lessonEditFormHtml(draft) : `<p style="color:var(--muted);font-size:14px">Select a lesson to edit, or add a new date.</p>`}
        </div>
      </div>`;
  }

  function lessonRowHtml(l) {
    const full = l.capacity > 0 && l.booked >= l.capacity;
    const pillClass = l.status === "Cancelled" ? "pill-sold" : full ? "pill-reserved" : "pill-available";
    const pillLabel = l.status === "Cancelled" ? "Cancelled" : full ? "Full" : "Open";
    const editing = state.lessonDraft && state.lessonDraft.id === l.id;
    return `
      <div class="admin-row ${editing ? "editing" : ""}">
        <div class="info">
          <p class="t">${esc(formatLessonDateTime(l.date))}</p>
          <p class="m">${money(l.price)} · ${l.booked}/${l.capacity} booked${l.location ? " · " + esc(l.location) : ""}</p>
        </div>
        <span class="pill ${pillClass}">${esc(pillLabel)}</span>
        <button class="btn-outline" data-edit-lesson="${esc(l.id)}">Edit</button>
      </div>`;
  }

  function lessonEditFormHtml(draft) {
    return `
      <p class="kicker">${state.lessonDraftIsNew ? "Lesson details" : "Editing lesson"}</p>
      <label class="form-field" style="margin-bottom:12px">Date &amp; time
        <input type="datetime-local" id="lDate" value="${toDatetimeLocal(draft.date)}">
      </label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
        <label class="form-field">Price per person (£)
          <input type="number" id="lPrice" value="${draft.price}">
        </label>
        <label class="form-field">Capacity
          <input type="number" id="lCapacity" value="${draft.capacity}">
        </label>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:12px">
        <label class="form-field">Booked so far <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">update as you confirm bookings</span>
          <input type="number" id="lBooked" value="${draft.booked}">
        </label>
        <label class="form-field">Location <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">optional</span>
          <input type="text" id="lLocation" value="${esc(draft.location)}" placeholder="Studio, Instow">
        </label>
      </div>
      <label class="form-field" style="margin-bottom:14px">Notes <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">optional — anything specific to this date</span>
        <textarea id="lNotes" rows="3">${esc(draft.notes)}</textarea>
      </label>
      <div style="margin-bottom:6px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Status</p>
        <div class="status-buttons">
          <button class="chip ${draft.status === "Open" ? "on" : ""}" data-lesson-status="Open">Open</button>
          <button class="chip ${draft.status === "Cancelled" ? "on" : ""}" data-lesson-status="Cancelled">Cancelled</button>
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn" id="saveLessonBtn" style="flex:1">Save</button>
        <button class="btn-outline" id="cancelLessonBtn">Cancel</button>
        ${!state.lessonDraftIsNew ? `<button class="btn-text" id="deleteLessonBtn" style="color:#B4403A">Delete</button>` : ""}
      </div>
      <p class="form-msg" style="color:var(--muted)">${esc(state.savedNote)}</p>
      ${state.errorMsg ? `<p class="form-error">${esc(state.errorMsg)}</p>` : ""}
    `;
  }

  function bindLessonsTab() {
    document.querySelectorAll("[data-edit-lesson]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const l = state.lessons.find((x) => x.id === btn.getAttribute("data-edit-lesson"));
        if (!l) return;
        state.lessonDraft = Object.assign({}, l);
        state.lessonDraftIsNew = false;
        state.savedNote = `Editing ${formatLessonDateTime(l.date)}.`;
        state.errorMsg = "";
        renderTabBody();
      });
    });

    if (!state.lessonDraft) return;

    document.querySelectorAll("[data-lesson-status]").forEach((btn) => {
      btn.addEventListener("click", () => { state.lessonDraft.status = btn.getAttribute("data-lesson-status"); renderTabBody(); });
    });
    document.getElementById("saveLessonBtn").addEventListener("click", saveLessonDraft);
    document.getElementById("cancelLessonBtn").addEventListener("click", () => {
      state.lessonDraft = null;
      state.savedNote = "Edit discarded.";
      renderTabBody();
    });
    const delBtn = document.getElementById("deleteLessonBtn");
    if (delBtn) delBtn.addEventListener("click", deleteLessonDraft);

    ["lDate", "lPrice", "lCapacity", "lBooked", "lLocation", "lNotes"].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        state.lessonDraft.date = fromDatetimeLocal(document.getElementById("lDate").value);
        state.lessonDraft.price = Number(document.getElementById("lPrice").value) || 0;
        state.lessonDraft.capacity = Number(document.getElementById("lCapacity").value) || 0;
        state.lessonDraft.booked = Number(document.getElementById("lBooked").value) || 0;
        state.lessonDraft.location = document.getElementById("lLocation").value;
        state.lessonDraft.notes = document.getElementById("lNotes").value;
      });
    });
  }

  async function saveLessonDraft() {
    const d = state.lessonDraft;
    if (!d.date) {
      state.errorMsg = "Set a date and time before saving.";
      renderTabBody();
      return;
    }
    state.errorMsg = "";
    const saveBtn = document.getElementById("saveLessonBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      if (state.lessonDraftIsNew) {
        const data = await authFetch("/.netlify/functions/lessons", {
          method: "POST",
          body: JSON.stringify(d)
        });
        state.lessons.push(data.record);
      } else {
        const data = await authFetch("/.netlify/functions/lessons", {
          method: "PATCH",
          body: JSON.stringify(d)
        });
        state.lessons = state.lessons.map((l) => (l.id === data.record.id ? data.record : l));
      }
      state.lessons.sort((a, b) => new Date(a.date) - new Date(b.date));
      state.savedNote = `Saved. ${formatLessonDateTime(d.date)}.`;
      state.lessonDraft = null;
      renderDashboard();
    } catch (err) {
      state.errorMsg = err.message;
      renderTabBody();
    }
  }

  async function deleteLessonDraft() {
    const d = state.lessonDraft;
    if (!confirm(`Remove the ${formatLessonDateTime(d.date)} session for good?`)) return;
    try {
      await authFetch(`/.netlify/functions/lessons?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      state.lessons = state.lessons.filter((l) => l.id !== d.id);
      state.lessonDraft = null;
      state.savedNote = "Lesson removed.";
      renderDashboard();
    } catch (err) {
      state.errorMsg = err.message;
      renderTabBody();
    }
  }

  /* ---------------- Blog / Journal tab ---------------- */

  function formatBlogDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  }

  function blogTabHtml() {
    const draft = state.blogDraft;
    return `
      <div class="dash-grid">
        <div>
          <p class="row-hint">Posts are listed newest first. Only Published posts show on the public journal — Drafts (including anything written automatically) stay hidden until you publish them.</p>
          <div class="rows" id="blogRows">
            ${state.blogPosts.length ? state.blogPosts.map(blogRowHtml).join("") : `<p style="color:var(--muted);font-size:14px">No posts yet.</p>`}
          </div>
        </div>
        <div class="edit-card">
          ${draft ? blogEditFormHtml(draft) : `<p style="color:var(--muted);font-size:14px">Select a post to edit, or write a new one.</p>`}
        </div>
      </div>`;
  }

  function blogRowHtml(p) {
    const pillClass = p.status === "Published" ? "pill-available" : "pill-reserved";
    const editing = state.blogDraft && state.blogDraft.id === p.id;
    return `
      <div class="admin-row ${editing ? "editing" : ""}">
        <div class="info">
          <p class="t">${esc(p.title || "Untitled")}${p.generated ? ` <span style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:.08em">· AI draft</span>` : ""}</p>
          <p class="m">${esc(formatBlogDate(p.createdAt))}</p>
        </div>
        <span class="pill ${pillClass}">${esc(p.status)}</span>
        ${p.status === "Draft" ? `<button class="btn-text" data-quick-publish="${esc(p.id)}">Publish</button>` : ""}
        <button class="btn-outline" data-edit-blog="${esc(p.id)}">Edit</button>
      </div>`;
  }

  function blogEditFormHtml(draft) {
    return `
      <p class="kicker">${state.blogDraftIsNew ? "New post" : "Editing post"}</p>
      <div class="upload-row">
        <img class="upload-thumb" id="blogUploadThumb" src="${draft.imageUrl ? esc(thumbFor(draft.imageUrl)) : ""}" style="${draft.imageUrl ? "" : "visibility:hidden"}">
        <div class="upload-drop">
          <p style="margin:0;font-family:ui-monospace,Menlo,monospace;font-size:11px;color:var(--ink-soft)">COVER PHOTO</p>
          <button type="button" id="blogUploadBtn">${draft.imageUrl ? "Replace photo" : "Add a photo"}</button>
          <p style="margin:0;font-size:12px;color:var(--muted)">Optional</p>
        </div>
      </div>
      <label class="form-field" style="margin-bottom:12px">Title
        <input type="text" id="bTitle" value="${esc(draft.title)}">
      </label>
      <label class="form-field" style="margin-bottom:12px">Excerpt <span style="text-transform:none;letter-spacing:0;font-size:13px;color:#9AA6AC">optional — shown on the journal list; the start of the post is used if left blank</span>
        <textarea id="bExcerpt" rows="2">${esc(draft.excerpt)}</textarea>
      </label>
      <label class="form-field" style="margin-bottom:14px">Post
        <textarea id="bBody" rows="10">${esc(draft.body)}</textarea>
      </label>
      ${draft.generated ? `<p class="form-msg" style="color:var(--sea);margin-bottom:10px">✦ Drafted automatically — read it over before publishing.</p>` : ""}
      <div style="margin-bottom:6px">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted)">Status</p>
        <div class="status-buttons">
          <button class="chip ${draft.status === "Draft" ? "on" : ""}" data-blog-status="Draft">Draft</button>
          <button class="chip ${draft.status === "Published" ? "on" : ""}" data-blog-status="Published">Published</button>
        </div>
      </div>
      <div class="edit-actions">
        <button class="btn" id="saveBlogBtn" style="flex:1">Save</button>
        <button class="btn-outline" id="cancelBlogBtn">Cancel</button>
        ${!state.blogDraftIsNew ? `<button class="btn-text" id="deleteBlogBtn" style="color:#B4403A">Delete</button>` : ""}
      </div>
      <p class="form-msg" style="color:var(--muted)">${esc(state.savedNote)}</p>
      ${state.errorMsg ? `<p class="form-error">${esc(state.errorMsg)}</p>` : ""}
    `;
  }

  function bindBlogTab() {
    document.querySelectorAll("[data-edit-blog]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const p = state.blogPosts.find((x) => x.id === btn.getAttribute("data-edit-blog"));
        if (!p) return;
        state.blogDraft = Object.assign({}, p);
        state.blogDraftIsNew = false;
        state.savedNote = `Editing "${p.title}".`;
        state.errorMsg = "";
        renderTabBody();
      });
    });

    document.querySelectorAll("[data-quick-publish]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.getAttribute("data-quick-publish");
        try {
          const data = await authFetch("/.netlify/functions/blog", { method: "PATCH", body: JSON.stringify({ id, status: "Published" }) });
          state.blogPosts = state.blogPosts.map((p) => (p.id === id ? data.record : p));
          renderTabBody();
        } catch (err) {
          alert("Couldn't publish that post: " + err.message);
          renderTabBody();
        }
      });
    });

    if (!state.blogDraft) return;

    document.getElementById("blogUploadBtn").addEventListener("click", () => openUploadWidget((url) => { state.blogDraft.imageUrl = url; }));
    document.querySelectorAll("[data-blog-status]").forEach((btn) => {
      btn.addEventListener("click", () => { state.blogDraft.status = btn.getAttribute("data-blog-status"); renderTabBody(); });
    });
    document.getElementById("saveBlogBtn").addEventListener("click", saveBlogDraft);
    document.getElementById("cancelBlogBtn").addEventListener("click", () => {
      state.blogDraft = null;
      state.savedNote = "Edit discarded.";
      renderTabBody();
    });
    const delBtn = document.getElementById("deleteBlogBtn");
    if (delBtn) delBtn.addEventListener("click", deleteBlogDraft);

    ["bTitle", "bExcerpt", "bBody"].forEach((id) => {
      const el = document.getElementById(id);
      el.addEventListener("input", () => {
        state.blogDraft.title = document.getElementById("bTitle").value;
        state.blogDraft.excerpt = document.getElementById("bExcerpt").value;
        state.blogDraft.body = document.getElementById("bBody").value;
      });
    });
  }

  async function saveBlogDraft() {
    const d = state.blogDraft;
    if (!d.title.trim()) {
      state.errorMsg = "Give the post a title before saving.";
      renderTabBody();
      return;
    }
    if (!d.body.trim()) {
      state.errorMsg = "The post needs some content before saving.";
      renderTabBody();
      return;
    }
    state.errorMsg = "";
    const saveBtn = document.getElementById("saveBlogBtn");
    saveBtn.disabled = true;
    saveBtn.textContent = "Saving…";
    try {
      if (state.blogDraftIsNew) {
        const data = await authFetch("/.netlify/functions/blog", { method: "POST", body: JSON.stringify(d) });
        state.blogPosts.unshift(data.record);
      } else {
        const data = await authFetch("/.netlify/functions/blog", { method: "PATCH", body: JSON.stringify(d) });
        state.blogPosts = state.blogPosts.map((p) => (p.id === data.record.id ? data.record : p));
      }
      state.savedNote = `Saved. "${d.title}" is ${d.status === "Published" ? "live on the journal" : "still a draft"}.`;
      state.blogDraft = null;
      renderDashboard();
    } catch (err) {
      state.errorMsg = err.message;
      renderTabBody();
    }
  }

  async function deleteBlogDraft() {
    const d = state.blogDraft;
    if (!confirm(`Delete "${d.title}" for good?`)) return;
    try {
      await authFetch(`/.netlify/functions/blog?id=${encodeURIComponent(d.id)}`, { method: "DELETE" });
      state.blogPosts = state.blogPosts.filter((p) => p.id !== d.id);
      state.blogDraft = null;
      state.savedNote = "Post deleted.";
      renderDashboard();
    } catch (err) {
      state.errorMsg = err.message;
      renderTabBody();
    }
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

  /* ---------------- boot / login ---------------- */

  function boot() {
    state.paintingsLoaded = false;
    state.enquiriesLoaded = false;
    state.lessonsLoaded = false;
    state.blogPostsLoaded = false;
    state.errorMsg = "";
    renderApp();
  }

  logoutBtn.addEventListener("click", () => {
    clearSession();
    state.paintings = [];
    state.paintingsLoaded = false;
    state.enquiries = [];
    state.enquiriesLoaded = false;
    state.lessons = [];
    state.lessonsLoaded = false;
    state.blogPosts = [];
    state.blogPostsLoaded = false;
    renderLoginGate();
  });

  async function verifyMagicLink(token) {
    renderLoading("Signing you in…");
    try {
      const res = await fetch("/.netlify/functions/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify", token })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "That link isn't valid — please request a new one.");
      saveSession(data.sessionToken, data.email);
      // Drop the token from the address bar — it's single-use and short-lived,
      // no reason to leave it sitting in browser history.
      window.history.replaceState({}, "", window.location.pathname);
      boot();
    } catch (err) {
      renderLoginGate(err.message);
    }
  }

  function init() {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      verifyMagicLink(token);
      return;
    }
    const stored = loadStoredSession();
    if (stored && stored.sessionToken) {
      saveSession(stored.sessionToken, stored.email);
      boot();
      return;
    }
    renderLoginGate();
  }

  init();
})();

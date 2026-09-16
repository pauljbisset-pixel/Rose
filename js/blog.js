/* ===========================================================
   Rose Budge — journal/blog app (list + post, hash-routed).
   Reads only Published posts from Airtable with the read-only
   token — drafts are filtered out server-side, see js/airtable.js.
=========================================================== */
(function () {
  const app = document.getElementById("app");

  const state = {
    posts: [],
    loaded: false,
    error: null
  };

  function esc(str) {
    return String(str || "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    }[c]));
  }

  function formatDate(iso) {
    if (!iso) return "";
    return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  }

  function teaser(post) {
    if (post.excerpt) return post.excerpt;
    const plain = post.body.replace(/\s+/g, " ").trim();
    if (plain.length <= 180) return plain;
    return plain.slice(0, 180).replace(/\s+\S*$/, "") + "…";
  }

  function byId(id) {
    return state.posts.find((p) => p.id === id);
  }

  function route() {
    const hash = location.hash.replace(/^#\/?/, "");
    const parts = hash.split("/").filter(Boolean);
    if (parts[0] === "post" && parts[1]) return { screen: "post", id: decodeURIComponent(parts[1]) };
    return { screen: "list" };
  }

  function go(hash) {
    location.hash = hash;
    window.scrollTo(0, 0);
  }

  function renderScreen() {
    const r = route();
    if (!state.loaded && !state.error) {
      app.innerHTML = `<div class="wrap" style="padding:120px 0;text-align:center;color:var(--muted)">Loading the journal…</div>`;
      return;
    }
    if (state.error) {
      app.innerHTML = `<div class="wrap" style="padding:120px 0;text-align:center;color:var(--muted)">
        <p>The journal couldn't be loaded right now.</p>
        <p style="font-size:13px">${esc(state.error)}</p>
      </div>`;
      return;
    }
    if (r.screen === "post") return renderPost(r.id);
    return renderList();
  }

  function renderList() {
    app.innerHTML = `
      <section class="shop-hero">
        <img src="images/about.jpg" alt="Painting by Rose Budge">
        <div class="overlay"></div>
        <div class="inner">
          <p class="eyebrow">Instow · North Devon</p>
          <h1>The Journal</h1>
          <p>Notes from the studio — colour, coastline, and what's currently on the easel.</p>
        </div>
      </section>
      <div class="wrap">
        ${state.posts.length ? `<div class="journal-grid">${state.posts.map(cardHtml).join("")}</div>` :
          `<div class="basket-empty" style="margin:32px 0"><p>Nothing posted yet — check back soon.</p></div>`}
      </div>`;
    bindCardLinks();
  }

  function cardHtml(post) {
    return `
      <article class="journal-card" data-open="${esc(post.id)}">
        ${post.imageUrl ? `<div class="journal-card-figure"><img src="${esc(RoseAirtable.thumbUrl(post.imageUrl))}" alt="${esc(post.title)}" loading="lazy"></div>` : ""}
        <p class="journal-card-date">${esc(formatDate(post.createdAt))}</p>
        <h3 class="journal-card-title">${esc(post.title)}</h3>
        <p class="journal-card-excerpt">${esc(teaser(post))}</p>
        <span class="btn-text">Read more →</span>
      </article>`;
  }

  function bindCardLinks() {
    document.querySelectorAll("[data-open]").forEach((el) => {
      el.addEventListener("click", () => go(`#/post/${encodeURIComponent(el.getAttribute("data-open"))}`));
    });
  }

  function renderPost(id) {
    const post = byId(id);
    if (!post) {
      app.innerHTML = `<div class="wrap" style="padding:80px 0;text-align:center;color:var(--muted)">
        <p>That post isn't available any more.</p>
        <a href="#/" class="back-link" data-open="__list">← Back to the journal</a>
      </div>`;
      document.querySelector('[data-open="__list"]').addEventListener("click", (e) => { e.preventDefault(); go("#/"); });
      return;
    }
    app.innerHTML = `
      <section class="commerce-section" style="max-width:760px">
        <a href="#/" class="back-link" data-open="__list">← Back to the journal</a>
        <p class="journal-card-date">${esc(formatDate(post.createdAt))}</p>
        <h1 style="margin:0 0 24px">${esc(post.title)}</h1>
        ${post.imageUrl ? `<div class="detail-image" style="margin-bottom:28px"><img src="${esc(RoseAirtable.fullUrl(post.imageUrl))}" alt="${esc(post.title)}"></div>` : ""}
        <div class="journal-body">${esc(post.body)}</div>
      </section>`;
    document.querySelector('[data-open="__list"]').addEventListener("click", (e) => { e.preventDefault(); go("#/"); });
  }

  window.addEventListener("hashchange", renderScreen);

  renderScreen();
  RoseAirtable.fetchBlogPosts()
    .then((posts) => { state.posts = posts; state.loaded = true; renderScreen(); })
    .catch((err) => { state.error = err.message; renderScreen(); });
})();

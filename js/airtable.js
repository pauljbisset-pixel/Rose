/* ===========================================================
   Rose Budge — read-only Airtable client for the public shop.
   Uses the read-only token from config.js. Never used for writes
   — all writes go through the gated Netlify functions instead.
=========================================================== */
(function () {
  const cfg = window.ROSE_CONFIG.airtable;
  const API_ROOT = "https://api.airtable.com/v0";

  function fieldsUrl(table, params) {
    const url = new URL(`${API_ROOT}/${cfg.baseId}/${encodeURIComponent(table)}`);
    Object.entries(params || {}).forEach(([k, v]) => url.searchParams.set(k, v));
    return url.toString();
  }

  async function fetchAllRecords(table, params) {
    const records = [];
    let offset;
    do {
      const url = fieldsUrl(table, Object.assign({}, params, offset ? { offset } : {}));
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${cfg.readOnlyToken}` }
      });
      if (!res.ok) {
        throw new Error(`Airtable request failed (${res.status})`);
      }
      const data = await res.json();
      records.push(...data.records);
      offset = data.offset;
    } while (offset);
    return records;
  }

  function normalizePainting(record) {
    const f = record.fields;
    return {
      id: record.id,
      title: f.Title || "Untitled",
      price: typeof f.Price === "number" ? f.Price : 0,
      description: f.Description || "",
      size: f.Size || "",
      category: f.Category || "",
      status: f.Status || "Available",
      imageUrl: f["Image URL"] || "",
      sortOrder: typeof f["Sort Order"] === "number" ? f["Sort Order"] : 0,
      hearts: typeof f.Hearts === "number" ? f.Hearts : 0,
      story: f.Story || "",
      createdAt: record.createdTime || ""
    };
  }

  // Cloudinary URLs can be resized on the fly by inserting a transformation
  // segment after "/upload/" — used to keep gallery thumbnails light.
  function cloudinaryVariant(url, transform) {
    if (!url || url.indexOf("res.cloudinary.com") === -1) return url;
    return url.replace("/upload/", `/upload/${transform}/`);
  }

  function thumbUrl(url) {
    return cloudinaryVariant(url, "w_500,h_500,c_fill,q_auto,f_auto");
  }

  function fullUrl(url) {
    return cloudinaryVariant(url, "w_1600,c_limit,q_auto,f_auto");
  }

  // Fetches every painting regardless of status. Sold/Reserved originals
  // stay in the shop rather than vanishing — a print of a painting is
  // still buyable long after the original itself is gone, so hiding the
  // whole card on sale would hide that option too. The shop UI marks
  // sold/reserved status with a badge and swaps the "Add to basket"
  // button for the original accordingly.
  async function fetchPaintings() {
    const records = await fetchAllRecords(cfg.paintingsTable, {
      "sort[0][field]": "Sort Order",
      "sort[0][direction]": "asc"
    });
    return records.map(normalizePainting).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function normalizeLesson(record) {
    const f = record.fields;
    return {
      id: record.id,
      date: f.Date || "",
      price: typeof f.Price === "number" ? f.Price : 0,
      capacity: typeof f.Capacity === "number" ? f.Capacity : 0,
      booked: typeof f.Booked === "number" ? f.Booked : 0,
      status: f.Status || "Open",
      location: f.Location || "",
      notes: f.Notes || ""
    };
  }

  // Fetches every lesson row; the caller filters to what's actually
  // bookable (open, upcoming, spots left) — kept simple rather than a
  // date-comparison Airtable formula, since the row count is small.
  async function fetchLessons() {
    const records = await fetchAllRecords(cfg.lessonsTable, {
      "sort[0][field]": "Date",
      "sort[0][direction]": "asc"
    });
    return records.map(normalizeLesson);
  }

  function normalizeBlogPost(record) {
    const f = record.fields;
    return {
      id: record.id,
      title: f.Title || "Untitled",
      excerpt: f.Excerpt || "",
      body: f.Body || "",
      imageUrl: f["Image URL"] || "",
      createdAt: record.createdTime || ""
    };
  }

  // Filtered server-side to Status = Published — unlike paintings/lessons,
  // a Draft post (an AI-generated rough cut Rose hasn't reviewed yet) has
  // no public value and shouldn't be fetchable even unlinked, so this
  // never falls back to fetch-all-then-filter like the other tables do.
  async function fetchBlogPosts() {
    const records = await fetchAllRecords(cfg.blogTable, {
      filterByFormula: "{Status}='Published'"
    });
    return records.map(normalizeBlogPost).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  window.RoseAirtable = {
    fetchPaintings,
    fetchLessons,
    fetchBlogPosts,
    thumbUrl,
    fullUrl
  };
})();

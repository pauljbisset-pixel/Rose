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
      sortOrder: typeof f["Sort Order"] === "number" ? f["Sort Order"] : 0
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

  async function fetchAvailablePaintings() {
    const records = await fetchAllRecords(cfg.paintingsTable, {
      filterByFormula: "{Status} = 'Available'",
      "sort[0][field]": "Sort Order",
      "sort[0][direction]": "asc"
    });
    return records.map(normalizePainting).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  window.RoseAirtable = {
    fetchAvailablePaintings,
    thumbUrl,
    fullUrl
  };
})();

/* ===========================================================
   /.netlify/functions/cards
   Session-gated CRUD + reorder for the Airtable Cards table.
   Used only by dashboard.html — the public shop reads Airtable
   directly with a read-only token (see js/airtable.js), same as
   paintings.
=========================================================== */
const { CARDS_TABLE, airtableRequest, airtableListAll, requireSession, json, errorResponse } = require("./_lib");

function normalize(record) {
  const f = record.fields;
  return {
    id: record.id,
    title: f.Title || "",
    type: f.Type || "Printed",
    price: typeof f.Price === "number" ? f.Price : 0,
    imageUrl: f["Image URL"] || "",
    status: f.Status || "Available",
    sortOrder: typeof f["Sort Order"] === "number" ? f["Sort Order"] : 0
  };
}

function toFields(body) {
  const fields = {};
  if (body.title !== undefined) fields.Title = body.title;
  if (body.type !== undefined) fields.Type = body.type || null;
  if (body.price !== undefined) fields.Price = Number(body.price) || 0;
  if (body.imageUrl !== undefined) fields["Image URL"] = body.imageUrl;
  if (body.status !== undefined) fields.Status = body.status;
  if (body.sortOrder !== undefined) fields["Sort Order"] = Number(body.sortOrder) || 0;
  return fields;
}

async function handleGet() {
  const records = await airtableListAll(CARDS_TABLE, {
    "sort[0][field]": "Sort Order",
    "sort[0][direction]": "asc"
  });
  return json(200, { records: records.map(normalize) });
}

async function handlePost(body) {
  if (!body.title) throw Object.assign(new Error("A title is required"), { status: 400 });
  let sortOrder = body.sortOrder;
  if (sortOrder === undefined) {
    const existing = await airtableListAll(CARDS_TABLE, {});
    sortOrder = existing.reduce((max, r) => Math.max(max, r.fields["Sort Order"] || 0), 0) + 1;
  }
  const fields = Object.assign({ Status: "Available", Price: 3 }, toFields(Object.assign({}, body, { sortOrder })));
  const data = await airtableRequest(CARDS_TABLE, "", {
    method: "POST",
    body: JSON.stringify({ fields })
  });
  return json(201, { record: normalize(data) });
}

async function handlePatch(body) {
  // Bulk reorder: { reorder: [{ id, sortOrder }, ...] }
  if (Array.isArray(body.reorder)) {
    const chunks = [];
    for (let i = 0; i < body.reorder.length; i += 10) chunks.push(body.reorder.slice(i, i + 10));
    for (const chunk of chunks) {
      await airtableRequest(CARDS_TABLE, "", {
        method: "PATCH",
        body: JSON.stringify({
          records: chunk.map((r) => ({ id: r.id, fields: { "Sort Order": Number(r.sortOrder) || 0 } }))
        })
      });
    }
    return json(200, { ok: true });
  }

  // Single update: { id, ...fields }
  if (!body.id) throw Object.assign(new Error("id is required"), { status: 400 });
  const fields = toFields(body);
  const data = await airtableRequest(CARDS_TABLE, "", {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: body.id, fields }] })
  });
  return json(200, { record: normalize(data.records[0]) });
}

async function handleDelete(id) {
  if (!id) throw Object.assign(new Error("id is required"), { status: 400 });
  await airtableRequest(CARDS_TABLE, `?records[]=${encodeURIComponent(id)}`, { method: "DELETE" });
  return json(200, { ok: true });
}

exports.handler = async (event) => {
  try {
    requireSession(event);
    const body = event.body ? JSON.parse(event.body) : {};
    switch (event.httpMethod) {
      case "GET":
        return await handleGet();
      case "POST":
        return await handlePost(body);
      case "PATCH":
        return await handlePatch(body);
      case "DELETE":
        return await handleDelete((event.queryStringParameters || {}).id);
      default:
        return json(405, { error: "Method not allowed" });
    }
  } catch (err) {
    return errorResponse(err);
  }
};

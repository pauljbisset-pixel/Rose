/* ===========================================================
   /.netlify/functions/paintings
   Identity-gated CRUD + reorder for the Airtable Paintings table.
   Used only by dashboard.html — the public shop reads Airtable
   directly with a read-only token (see js/airtable.js).
=========================================================== */
const { PAINTINGS_TABLE, airtableRequest, airtableListAll, requireUser, json, errorResponse } = require("./_lib");

function normalize(record) {
  const f = record.fields;
  return {
    id: record.id,
    title: f.Title || "",
    price: typeof f.Price === "number" ? f.Price : 0,
    description: f.Description || "",
    size: f.Size || "",
    category: f.Category || "",
    status: f.Status || "Available",
    imageUrl: f["Image URL"] || "",
    sortOrder: typeof f["Sort Order"] === "number" ? f["Sort Order"] : 0
  };
}

function toFields(body) {
  const fields = {};
  if (body.title !== undefined) fields.Title = body.title;
  if (body.price !== undefined) fields.Price = Number(body.price) || 0;
  if (body.description !== undefined) fields.Description = body.description;
  if (body.size !== undefined) fields.Size = body.size;
  if (body.category !== undefined) fields.Category = body.category;
  if (body.status !== undefined) fields.Status = body.status;
  if (body.imageUrl !== undefined) fields["Image URL"] = body.imageUrl;
  if (body.sortOrder !== undefined) fields["Sort Order"] = Number(body.sortOrder) || 0;
  return fields;
}

async function handleGet() {
  const records = await airtableListAll(PAINTINGS_TABLE, {
    "sort[0][field]": "Sort Order",
    "sort[0][direction]": "asc"
  });
  return json(200, { records: records.map(normalize) });
}

async function handlePost(body) {
  if (!body.title) throw Object.assign(new Error("A title is required"), { status: 400 });
  let sortOrder = body.sortOrder;
  if (sortOrder === undefined) {
    const existing = await airtableListAll(PAINTINGS_TABLE, {});
    sortOrder = existing.reduce((max, r) => Math.max(max, r.fields["Sort Order"] || 0), 0) + 1;
  }
  const fields = Object.assign({ Status: "Available" }, toFields(Object.assign({}, body, { sortOrder })));
  const data = await airtableRequest(PAINTINGS_TABLE, "", {
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
      await airtableRequest(PAINTINGS_TABLE, "", {
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
  const data = await airtableRequest(PAINTINGS_TABLE, "", {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: body.id, fields }] })
  });
  return json(200, { record: normalize(data.records[0]) });
}

async function handleDelete(id) {
  if (!id) throw Object.assign(new Error("id is required"), { status: 400 });
  await airtableRequest(PAINTINGS_TABLE, `?records[]=${encodeURIComponent(id)}`, { method: "DELETE" });
  return json(200, { ok: true });
}

exports.handler = async (event, context) => {
  try {
    requireUser(context);
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

/* ===========================================================
   /.netlify/functions/blog
   Session-gated CRUD for the Airtable Blog table. Used only by
   dashboard.html — the public blog page reads Airtable directly
   with a read-only token, filtered to Status = Published only (see
   js/airtable.js), so drafts never reach a visitor even unlinked.
=========================================================== */
const { BLOG_TABLE, airtableRequest, airtableListAll, requireSession, json, errorResponse } = require("./_lib");

function normalize(record) {
  const f = record.fields;
  return {
    id: record.id,
    title: f.Title || "",
    excerpt: f.Excerpt || "",
    body: f.Body || "",
    imageUrl: f["Image URL"] || "",
    status: f.Status || "Draft",
    generated: !!f.Generated,
    createdAt: record.createdTime || ""
  };
}

function toFields(body) {
  const fields = {};
  if (body.title !== undefined) fields.Title = body.title;
  if (body.excerpt !== undefined) fields.Excerpt = body.excerpt;
  if (body.body !== undefined) fields.Body = body.body;
  if (body.imageUrl !== undefined) fields["Image URL"] = body.imageUrl;
  if (body.status !== undefined) fields.Status = body.status;
  if (body.generated !== undefined) fields.Generated = !!body.generated;
  return fields;
}

async function handleGet() {
  const records = await airtableListAll(BLOG_TABLE, {});
  const normalized = records.map(normalize);
  normalized.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return json(200, { records: normalized });
}

async function handlePost(body) {
  if (!body.title) throw Object.assign(new Error("A title is required"), { status: 400 });
  const fields = Object.assign({ Status: "Draft" }, toFields(body));
  const data = await airtableRequest(BLOG_TABLE, "", {
    method: "POST",
    body: JSON.stringify({ fields })
  });
  return json(201, { record: normalize(data) });
}

async function handlePatch(body) {
  if (!body.id) throw Object.assign(new Error("id is required"), { status: 400 });
  const fields = toFields(body);
  const data = await airtableRequest(BLOG_TABLE, "", {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: body.id, fields }] })
  });
  return json(200, { record: normalize(data.records[0]) });
}

async function handleDelete(id) {
  if (!id) throw Object.assign(new Error("id is required"), { status: 400 });
  await airtableRequest(BLOG_TABLE, `?records[]=${encodeURIComponent(id)}`, { method: "DELETE" });
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

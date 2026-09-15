/* ===========================================================
   /.netlify/functions/lessons
   Session-gated CRUD for the Airtable Lessons table. Used only by
   dashboard.html — the public homepage reads Airtable directly with
   a read-only token (see js/airtable.js), same as paintings.
=========================================================== */
const { LESSONS_TABLE, airtableRequest, airtableListAll, requireSession, json, errorResponse } = require("./_lib");

function normalize(record) {
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

function toFields(body) {
  const fields = {};
  if (body.date !== undefined) fields.Date = body.date;
  if (body.price !== undefined) fields.Price = Number(body.price) || 0;
  if (body.capacity !== undefined) fields.Capacity = Number(body.capacity) || 0;
  if (body.booked !== undefined) fields.Booked = Number(body.booked) || 0;
  if (body.status !== undefined) fields.Status = body.status;
  if (body.location !== undefined) fields.Location = body.location;
  if (body.notes !== undefined) fields.Notes = body.notes;
  return fields;
}

async function handleGet() {
  const records = await airtableListAll(LESSONS_TABLE, {
    "sort[0][field]": "Date",
    "sort[0][direction]": "asc"
  });
  return json(200, { records: records.map(normalize) });
}

async function handlePost(body) {
  if (!body.date) throw Object.assign(new Error("A date is required"), { status: 400 });
  const fields = Object.assign({ Status: "Open", Booked: 0 }, toFields(body));
  const data = await airtableRequest(LESSONS_TABLE, "", {
    method: "POST",
    body: JSON.stringify({ fields })
  });
  return json(201, { record: normalize(data) });
}

async function handlePatch(body) {
  if (!body.id) throw Object.assign(new Error("id is required"), { status: 400 });
  const fields = toFields(body);
  const data = await airtableRequest(LESSONS_TABLE, "", {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: body.id, fields }] })
  });
  return json(200, { record: normalize(data.records[0]) });
}

async function handleDelete(id) {
  if (!id) throw Object.assign(new Error("id is required"), { status: 400 });
  await airtableRequest(LESSONS_TABLE, `?records[]=${encodeURIComponent(id)}`, { method: "DELETE" });
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

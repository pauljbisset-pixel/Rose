/* ===========================================================
   /.netlify/functions/enquiries
   POST is public (any visitor submitting the checkout form) and
   only ever creates a new row — it can't read or change anything.
   GET/PATCH are gated to Rose's dashboard.
=========================================================== */
const { ENQUIRIES_TABLE, airtableRequest, airtableListAll, requireSession, json, errorResponse } = require("./_lib");

function normalize(record) {
  const f = record.fields;
  return {
    id: record.id,
    name: f.Name || "",
    email: f.Email || "",
    phone: f.Phone || "",
    message: f.Message || "",
    items: f.Items || "",
    total: typeof f.Total === "number" ? f.Total : 0,
    status: f.Status || "New",
    submitted: f.Submitted || record.createdTime || ""
  };
}

async function handlePost(body) {
  if (!body.name || !body.email) {
    throw Object.assign(new Error("Name and email are required"), { status: 400 });
  }
  const fields = {
    Name: body.name,
    Email: body.email,
    Phone: body.phone || "",
    Message: body.message || "",
    Items: body.items || "",
    Total: Number(body.total) || 0,
    Status: "New"
  };
  const data = await airtableRequest(ENQUIRIES_TABLE, "", {
    method: "POST",
    body: JSON.stringify({ fields })
  });
  return json(201, { record: normalize(data) });
}

async function handleGet() {
  const records = await airtableListAll(ENQUIRIES_TABLE, {
    "sort[0][field]": "Submitted",
    "sort[0][direction]": "desc"
  });
  return json(200, { records: records.map(normalize) });
}

async function handlePatch(body) {
  if (!body.id || !body.status) throw Object.assign(new Error("id and status are required"), { status: 400 });
  const data = await airtableRequest(ENQUIRIES_TABLE, "", {
    method: "PATCH",
    body: JSON.stringify({ records: [{ id: body.id, fields: { Status: body.status } }] })
  });
  return json(200, { record: normalize(data.records[0]) });
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod === "POST") {
      const body = event.body ? JSON.parse(event.body) : {};
      return await handlePost(body);
    }
    requireSession(event);
    if (event.httpMethod === "GET") return await handleGet();
    if (event.httpMethod === "PATCH") {
      const body = event.body ? JSON.parse(event.body) : {};
      return await handlePatch(body);
    }
    return json(405, { error: "Method not allowed" });
  } catch (err) {
    return errorResponse(err);
  }
};

/* Shared helpers for the Netlify functions in this folder.
   Not deployed as a function itself (no `exports.handler`). */

const AIRTABLE_ROOT = "https://api.airtable.com/v0";
const PAINTINGS_TABLE = "Paintings";
const ENQUIRIES_TABLE = "Enquiries";

function baseId() {
  const id = process.env.AIRTABLE_BASE_ID;
  if (!id) throw new Error("AIRTABLE_BASE_ID is not set in Netlify environment variables");
  return id;
}

function writeToken() {
  const token = process.env.AIRTABLE_WRITE_TOKEN;
  if (!token) throw new Error("AIRTABLE_WRITE_TOKEN is not set in Netlify environment variables");
  return token;
}

async function airtableRequest(table, path, options) {
  const url = `${AIRTABLE_ROOT}/${baseId()}/${encodeURIComponent(table)}${path || ""}`;
  const res = await fetch(url, Object.assign({}, options, {
    headers: Object.assign(
      { Authorization: `Bearer ${writeToken()}`, "Content-Type": "application/json" },
      (options && options.headers) || {}
    )
  }));
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body?.error?.message || `Airtable request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return body;
}

async function airtableListAll(table, params) {
  const records = [];
  let offset;
  do {
    const qs = new URLSearchParams(Object.assign({}, params, offset ? { offset } : {}));
    const data = await airtableRequest(table, `?${qs.toString()}`, { method: "GET" });
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records;
}

// Netlify populates context.clientContext.user when the request carries a
// valid Netlify Identity JWT in the Authorization header. This is how we
// gate writes to only Rose's logged-in dashboard session.
function requireUser(context) {
  const user = context && context.clientContext && context.clientContext.user;
  if (!user) {
    const err = new Error("Not signed in");
    err.status = 401;
    throw err;
  }
  return user;
}

function json(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function errorResponse(err) {
  console.error(err);
  return json(err.status || 500, { error: err.message || "Something went wrong" });
}

module.exports = {
  PAINTINGS_TABLE,
  ENQUIRIES_TABLE,
  airtableRequest,
  airtableListAll,
  requireUser,
  json,
  errorResponse
};

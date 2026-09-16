/* Shared helpers for the Netlify functions in this folder.
   Not deployed as a function itself (no `exports.handler`). */

const crypto = require("crypto");

const AIRTABLE_ROOT = "https://api.airtable.com/v0";
const PAINTINGS_TABLE = "Paintings";
const ENQUIRIES_TABLE = "Enquiries";
const LESSONS_TABLE = "Lessons";
const BLOG_TABLE = "Blog";
const CARDS_TABLE = "Cards";

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

/* ---------------------------------------------------------------
   Our own login, replacing Netlify Identity (its email delivery and
   account-settings widget proved unreliable in practice — rate
   limits, stuck modals, an inert iframe on "change password").
   A magic-link email (see auth.js) proves the visitor controls an
   allowed inbox; everything after that is a signed, stateless token
   — no database of sessions to manage, just HMAC-SHA256 over a JSON
   payload, checked against AUTH_SECRET.
------------------------------------------------------------------*/

function authSecret() {
  const s = process.env.AUTH_SECRET;
  if (!s) throw new Error("AUTH_SECRET is not set in Netlify environment variables");
  return s;
}

function allowedEmails() {
  const raw = process.env.DASHBOARD_ALLOWED_EMAIL || "";
  return raw.split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}

function base64url(input) {
  return Buffer.from(input).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  return Buffer.from(str, "base64").toString("utf8");
}

function signToken(payloadObj) {
  const payload = base64url(JSON.stringify(payloadObj));
  const sig = base64url(crypto.createHmac("sha256", authSecret()).update(payload).digest());
  return `${payload}.${sig}`;
}

// type is "magic" (15-min, emailed link) or "session" (30-day, kept by the
// browser) — a token minted for one purpose can't be replayed as the other.
function verifyToken(token, expectedType) {
  if (!token || typeof token !== "string" || token.indexOf(".") === -1) {
    throw Object.assign(new Error("That link isn't valid — please request a new one"), { status: 401 });
  }
  const [payload, sig] = token.split(".");
  const expectedSig = base64url(crypto.createHmac("sha256", authSecret()).update(payload).digest());
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw Object.assign(new Error("That link isn't valid — please request a new one"), { status: 401 });
  }
  let data;
  try {
    data = JSON.parse(base64urlDecode(payload));
  } catch (e) {
    throw Object.assign(new Error("That link isn't valid — please request a new one"), { status: 401 });
  }
  if (data.type !== expectedType) {
    throw Object.assign(new Error("That link isn't valid — please request a new one"), { status: 401 });
  }
  if (!data.exp || Date.now() > data.exp) {
    throw Object.assign(new Error("That link has expired — please request a new one"), { status: 401 });
  }
  return data;
}

// Gate writes to a valid, unexpired session token in the Authorization
// header — the equivalent of the old Netlify Identity clientContext check.
function requireSession(event) {
  const header = (event.headers && (event.headers.authorization || event.headers.Authorization)) || "";
  const token = header.replace(/^Bearer\s+/i, "");
  const data = verifyToken(token, "session");
  return data.email;
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
  LESSONS_TABLE,
  BLOG_TABLE,
  CARDS_TABLE,
  airtableRequest,
  airtableListAll,
  allowedEmails,
  signToken,
  verifyToken,
  requireSession,
  json,
  errorResponse
};

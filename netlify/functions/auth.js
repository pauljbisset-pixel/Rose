/* ===========================================================
   /.netlify/functions/auth
   Our own login, replacing Netlify Identity. Two actions:

   - { action: "request", email } — if the email is on the allowed
     list, emails a 15-minute magic link via EmailJS's REST API.
     Always responds the same way regardless of whether the email
     was recognised, so this can't be used to discover who's allowed
     to log in.
   - { action: "verify", token } — exchanges a valid magic-link token
     for a 30-day session token, which the dashboard then sends as
     "Authorization: Bearer <token>" on every write.
=========================================================== */
const { allowedEmails, signToken, verifyToken, json, errorResponse } = require("./_lib");

const EMAILJS_SERVICE_ID = "service_3zklcnj";
const EMAILJS_PUBLIC_KEY = "ZJel9MV1Hctfuo6cU";
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function siteUrl(event) {
  const proto = (event.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
  const host = event.headers.host;
  return `${proto}://${host}`;
}

async function sendMagicLinkEmail(email, link) {
  const templateId = process.env.EMAILJS_LOGIN_TEMPLATE_ID;
  if (!templateId) throw new Error("EMAILJS_LOGIN_TEMPLATE_ID is not set in Netlify environment variables");
  const res = await fetch("https://api.emailjs.com/api/v1.0/email/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      service_id: EMAILJS_SERVICE_ID,
      template_id: templateId,
      user_id: EMAILJS_PUBLIC_KEY,
      template_params: {
        to_email: email,
        login_link: link,
        expires_in: "15 minutes"
      }
    })
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // EmailJS rejects server-side (non-browser) calls until "Allow API
    // calls from non-browser applications" is switched on for the
    // account — a 403 here almost always means that setting is off.
    throw new Error(`Sending the login email failed (${res.status}): ${text}`);
  }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const body = event.body ? JSON.parse(event.body) : {};

    if (body.action === "request") {
      const email = String(body.email || "").trim().toLowerCase();
      if (email && allowedEmails().includes(email)) {
        const magicToken = signToken({ email, type: "magic", exp: Date.now() + MAGIC_LINK_TTL_MS });
        const link = `${siteUrl(event)}/dashboard.html?token=${magicToken}`;
        await sendMagicLinkEmail(email, link);
      }
      return json(200, { ok: true });
    }

    if (body.action === "verify") {
      const data = verifyToken(body.token, "magic");
      const sessionToken = signToken({ email: data.email, type: "session", exp: Date.now() + SESSION_TTL_MS });
      return json(200, { sessionToken, email: data.email });
    }

    return json(400, { error: "Unknown action" });
  } catch (err) {
    return errorResponse(err);
  }
};

/* ===========================================================
   /.netlify/functions/hearts
   Public, unauthenticated: any shop visitor can heart a painting.
   Low stakes (a portfolio site, not a marketplace) so no auth is
   worth the friction here — same trust level as the enquiry POST.

   Best-effort by design: if the Airtable "Hearts" field hasn't been
   added yet, this still returns 200 rather than breaking the visitor's
   experience — the heart just won't persist server-side until the
   field exists (see SETUP.md).
=========================================================== */
const { PAINTINGS_TABLE, airtableRequest, json, errorResponse } = require("./_lib");

async function handlePost(body) {
  const id = body.paintingId;
  const delta = body.delta === -1 ? -1 : 1;
  if (!id) throw Object.assign(new Error("paintingId is required"), { status: 400 });

  try {
    const current = await airtableRequest(PAINTINGS_TABLE, `/${encodeURIComponent(id)}`, { method: "GET" });
    const currentHearts = typeof current.fields.Hearts === "number" ? current.fields.Hearts : 0;
    const next = Math.max(0, currentHearts + delta);
    await airtableRequest(PAINTINGS_TABLE, "", {
      method: "PATCH",
      body: JSON.stringify({ records: [{ id, fields: { Hearts: next } }] })
    });
    return json(200, { hearts: next, persisted: true });
  } catch (err) {
    console.warn("Hearts write failed (field missing, or bad id):", err.message);
    return json(200, { hearts: null, persisted: false });
  }
}

exports.handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed" });
    const body = event.body ? JSON.parse(event.body) : {};
    return await handlePost(body);
  } catch (err) {
    return errorResponse(err);
  }
};

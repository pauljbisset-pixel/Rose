/* ===========================================================
   /.netlify/functions/site-content
   Session-gated read/update for the homepage's editable text
   (hero tagline, About heading + body). Unlike every other table
   here, this one is a singleton — there's only ever one row, so
   there's no POST-a-new-item/DELETE, just GET the row (or null if
   it doesn't exist yet) and PATCH to create-or-update it.
=========================================================== */
const { SITE_CONTENT_TABLE, airtableRequest, airtableListAll, requireSession, json, errorResponse } = require("./_lib");

function normalize(record) {
  const f = record.fields;
  return {
    id: record.id,
    heroTagline: f["Hero Tagline"] || "",
    aboutHeading: f["About Heading"] || "",
    aboutBody: f["About Body"] || ""
  };
}

function toFields(body) {
  const fields = {};
  if (body.heroTagline !== undefined) fields["Hero Tagline"] = body.heroTagline;
  if (body.aboutHeading !== undefined) fields["About Heading"] = body.aboutHeading;
  if (body.aboutBody !== undefined) fields["About Body"] = body.aboutBody;
  return fields;
}

async function handleGet() {
  const records = await airtableListAll(SITE_CONTENT_TABLE, {});
  return json(200, { record: records.length ? normalize(records[0]) : null });
}

async function handlePatch(body) {
  const fields = toFields(body);
  if (body.id) {
    const data = await airtableRequest(SITE_CONTENT_TABLE, "", {
      method: "PATCH",
      body: JSON.stringify({ records: [{ id: body.id, fields }] })
    });
    return json(200, { record: normalize(data.records[0]) });
  }
  // No row yet — this creates the one row the table will ever have.
  const data = await airtableRequest(SITE_CONTENT_TABLE, "", {
    method: "POST",
    body: JSON.stringify({ fields })
  });
  return json(201, { record: normalize(data) });
}

exports.handler = async (event) => {
  try {
    requireSession(event);
    const body = event.body ? JSON.parse(event.body) : {};
    switch (event.httpMethod) {
      case "GET":
        return await handleGet();
      case "PATCH":
        return await handlePatch(body);
      default:
        return json(405, { error: "Method not allowed" });
    }
  } catch (err) {
    return errorResponse(err);
  }
};

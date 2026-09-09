#!/usr/bin/env node
/* ===========================================================
   Runs as Netlify's build command. Rewrites js/config.js,
   substituting the TODO_ placeholders for values pulled from
   Netlify environment variables — so no credential (not even
   the "safe to expose" read-only Airtable token) ever has to be
   committed to git. Locally, with no env vars set, this is a
   no-op and the committed placeholders are left as they are.
=========================================================== */
const fs = require("fs");
const path = require("path");

const CONFIG_PATH = path.join(__dirname, "..", "js", "config.js");

// placeholder string -> [env var name, required?]
const REPLACEMENTS = [
  ["TODO_AIRTABLE_BASE_ID", "AIRTABLE_BASE_ID", true],
  ["TODO_AIRTABLE_READ_ONLY_TOKEN", "AIRTABLE_READ_ONLY_TOKEN", true],
  ["TODO_EMAILJS_TEMPLATE_ID", "EMAILJS_TEMPLATE_ID", true],
  ["TODO_CLOUDINARY_CLOUD_NAME", "CLOUDINARY_CLOUD_NAME", true],
  ["TODO_CLOUDINARY_UPLOAD_PRESET", "CLOUDINARY_UPLOAD_PRESET", true]
];

let contents = fs.readFileSync(CONFIG_PATH, "utf8");
const missing = [];

for (const [placeholder, envVar, required] of REPLACEMENTS) {
  const value = process.env[envVar];
  if (value) {
    contents = contents.split(placeholder).join(value);
  } else if (required) {
    missing.push(envVar);
  }
}

fs.writeFileSync(CONFIG_PATH, contents);

if (missing.length) {
  console.warn(
    `[build-config] Deploying with placeholder values still in js/config.js — ` +
    `missing Netlify env vars: ${missing.join(", ")}. ` +
    `The site will build, but those features won't work until they're set. See SETUP.md.`
  );
} else {
  console.log("[build-config] js/config.js populated from environment variables.");
}

/* ===========================================================
   Rose Budge — public site configuration
   ---------------------------------------------------------
   Everything in this file is shipped to the browser, so only
   put NON-SECRET values here:
     - Airtable base id, table names, and the READ-ONLY token
       (scoped to read Paintings only — see SETUP.md)
     - EmailJS service id / template id / public key
       (EmailJS's public key is designed to be used client-side)
     - Cloudinary cloud name + UNSIGNED upload preset name
       (also designed to be used client-side)

   The Airtable WRITE token never goes here — it lives only in
   Netlify's environment variables and is used by the functions
   in netlify/functions/. See SETUP.md for the full walkthrough.
=========================================================== */
window.ROSE_CONFIG = {
  airtable: {
    baseId: "TODO_AIRTABLE_BASE_ID",          // e.g. "appXXXXXXXXXXXXXX"
    paintingsTable: "Paintings",
    enquiriesTable: "Enquiries",
    lessonsTable: "Lessons",
    blogTable: "Blog",
    // Personal access token scoped to data.records:read on this base only.
    // Filled in at deploy time by scripts/build-config.js from Netlify env
    // vars — never edit this literal value or commit a real token here.
    readOnlyToken: "TODO_AIRTABLE_READ_ONLY_TOKEN"
  },

  emailjs: {
    publicKey: "ZJel9MV1Hctfuo6cU",
    serviceId: "service_3zklcnj",
    // Template with variables: to_email, from_name, from_email, from_phone,
    // message, items, total, submitted_at — see SETUP.md for the exact
    // fields to add when creating/cloning the template in EmailJS.
    templateId: "TODO_EMAILJS_TEMPLATE_ID"
  },

  // Unframed print prices, per size — shown on every painting's page.
  // Each price already has doxdirect.com's print cost + one shared £8
  // delivery baked in, so nothing extra is added at checkout. See
  // SETUP.md "Prints" for the cost breakdown and how to re-price these.
  prints: {
    note: "Unframed, printed on fine art paper and shipped rolled in a protective tube.",
    sizes: [
      { size: "A4", price: 35 },
      { size: "A3", price: 40 },
      { size: "A2", price: 55 },
      { size: "A1", price: 75 },
      { size: "A0", price: 95 }
    ]
  },

  cloudinary: {
    cloudName: "TODO_CLOUDINARY_CLOUD_NAME",
    // Unsigned upload preset, folder-scoped to e.g. "rose-budge"
    uploadPreset: "TODO_CLOUDINARY_UPLOAD_PRESET"
  },

  contact: {
    email: "budgerose5@gmail.com"
  }
};

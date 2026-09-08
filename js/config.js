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
    // Personal access token scoped to data.records:read on this base only.
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

  cloudinary: {
    cloudName: "TODO_CLOUDINARY_CLOUD_NAME",
    // Unsigned upload preset, folder-scoped to e.g. "rose-budge"
    uploadPreset: "TODO_CLOUDINARY_UPLOAD_PRESET"
  },

  contact: {
    email: "budgerose5@gmail.com"
  }
};

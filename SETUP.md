# Rose Budge shop — setup guide

Everything is built and wired up to a set of placeholder credentials. Follow
this in order — each section tells you exactly what to create and which
value to send back so it can be dropped into the code.

The whole point of this build: once it's live, **Rose never needs Paul
again for day-to-day changes.** Adding a painting, editing a price,
reordering the shop, marking something sold — all of that happens in her
dashboard and writes straight to Airtable. No redeploy, ever, for any of
that. A redeploy is only ever needed if the *code* changes.

---

## 1. Airtable — the product database

Create a free Airtable account (or use an existing one) and a **new base**
called e.g. "Rose Budge Shop". Inside it, create two tables exactly as
below — field names must match exactly (case and spacing) because the code
reads/writes these names directly.

### Table: `Paintings`

| Field name   | Type                                   | Notes |
|--------------|-----------------------------------------|-------|
| `Title`      | Single line text                        | |
| `Price`      | Number (integer, or currency £)         | Whole pounds is simplest |
| `Size`       | Single line text                        | e.g. `60 × 50 cm` |
| `Description`| Long text                               | |
| `Category`   | Single select                           | Optional — e.g. `Coast & estuary`, `Woodland`. Leave every record blank if you don't want filter chips on the shop. |
| `Status`     | Single select: `Available`, `Reserved`, `Sold` | Default new records to `Available` |
| `Image URL`  | Single line text (or "URL" type)        | Filled in automatically by the dashboard's photo upload — leave blank when you create the table |
| `Sort Order` | Number                                  | Controls shop order; the dashboard's drag-to-reorder writes this for you |

### Table: `Enquiries`

| Field name  | Type                                      | Notes |
|-------------|--------------------------------------------|-------|
| `Name`      | Single line text | |
| `Email`     | Email | |
| `Phone`     | Single line text | |
| `Message`   | Long text | |
| `Items`     | Long text | Titles + prices from the basket, one per line |
| `Total`     | Number (currency £) | |
| `Status`    | Single select: `New`, `Contacted`, `Closed` | Default `New` |
| `Submitted` | **Created time** (auto) | Airtable fills this in itself — must be named exactly `Submitted` |

You don't need to add any rows by hand — the dashboard's "+ Add a painting"
button creates `Paintings` rows, and every checkout submission creates an
`Enquiries` row automatically.

### Two API tokens (Account → Developer hub → Personal access tokens)

Create **two separate tokens** — don't reuse one, since one of them ends up
in the browser and must not be able to write anything:

1. **Read-only token** (ships in the public site's code, in `js/config.js`)
   - Scope: `data.records:read`
   - Access: only this one base
2. **Read/write token** (kept secret, goes into Netlify's environment
   variables, never in a file)
   - Scopes: `data.records:read`, `data.records:write`
   - Access: only this one base

Send me:
- The **base ID** (starts `app…` — visible in the base's API docs, or in
  the base URL)
- The **read-only token**
- The **read/write token**

Neither token gets committed to git, even the read-only one — see §4,
"Environment variables." Both are set once in Netlify and injected into
the site at build time.

---

## 2. Cloudinary — photo hosting for Rose's uploads

You already have a Cloudinary account (used for Choice Cottages). Two
options:

- **Reuse that account**, in a dedicated folder (the dashboard already
  uploads into a `rose-budge` folder to keep things separate), or
- **Create a new free Cloudinary account** just for Rose, if you'd rather
  keep it fully separate.

Either way, create an **unsigned upload preset** (Settings → Upload →
Upload presets → Add upload preset → Signing mode: **Unsigned**). This is
what makes "drop a photo in from her phone" work with no backend — it's
designed to be safe to expose in client-side code, but an unsigned preset
can only *create* new uploads, never read/delete/modify existing ones, so
scope it tightly:
- Folder: `rose-budge`
- Consider capping max file size / image dimensions in the preset if you
  want to guard against accidental huge uploads

Send me:
- Your **Cloud name**
- The **unsigned upload preset name**

---

## 3. EmailJS — two templates: the enquiry email, and the dashboard login link

Using your existing account (service `service_3zklcnj`, public key
`ZJel9MV1Hctfuo6cU` — already in the code).

**Template A — the enquiry email to Rose.** Create a **new template**
(recommended, rather than adapting an existing one, since the variables
are specific to this form) with these variables — add them into the
template body however reads naturally, e.g.:

```
New enquiry from {{from_name}} ({{from_email}}, {{from_phone}})

{{message}}

Paintings enquired about:
{{items}}

Total: {{total}}
Submitted: {{submitted_at}}
```

Set the template's **To email** to `budgerose5@gmail.com` (or use the
`{{to_email}}` variable, which the code also sends).

**Template B — the dashboard sign-in link.** A second, separate template
(the dashboard's own login — see §4 below for why this replaced Netlify
Identity) with just these variables:

```
Click below to sign in to your studio dashboard. This link works once
and expires in {{expires_in}}.

{{login_link}}

If you didn't request this, you can ignore this email.
```

Set this template's **To email** to `{{to_email}}` (there's no fixed
address this time — it needs to go to whoever's actually requesting the
link, which could be you during testing or Rose once she's set up).

Send me:
- The enquiry template's **ID** (Template A)
- The login-link template's **ID** (Template B)

---

## 4. Netlify — hosting, login, and environment variables

**Why not Netlify Identity:** that's what this was originally built on,
but its hosted email delivery and account-settings widget turned out to
be unreliable in practice during testing — rate limits with no clear
recovery, invite/recovery tokens failing to process, and a "change
password" action that silently did nothing (a stuck, invisible iframe).
None of that was something fixable from the code side. Rose's login is
now something built and controlled directly: she enters her email on
`/dashboard.html`, gets a one-time link by email (via EmailJS, which has
been reliable throughout — same service the enquiry emails already use),
and clicking it signs her in for 30 days. No third-party identity widget
in the loop, no password to forget either.

**Deploy method:** I'd recommend connecting this repo to Netlify via Git
(Netlify → Add new site → Import from Git) rather than manual Netlify
Drop. Reasons:
- The dashboard's writes go straight to Airtable and never need a
  redeploy — that's unaffected either way.
- But Netlify Identity and Netlify Functions (which the dashboard needs
  for secure writes) work properly with a Git-connected site, and it means
  any future *code* change (e.g. me pushing a fix) deploys automatically
  instead of you needing to drag a new zip in each time.
- Build settings: publish directory `.`. Netlify will pick up the build
  command (`node scripts/build-config.js`) from `netlify.toml` automatically.

**Why a build command at all, for a static site:** every credential below
— including the Airtable *read-only* token, which is safe to expose in the
browser — gets injected into `js/config.js` from Netlify's environment
variables at build time, rather than being committed to the repo. GitHub's
push protection actually caught me trying to commit one of these directly
the first time round, which was the right call: a token baked into git
history can't be revoked without rotating it, even a low-risk one. This
way nothing sensitive ever touches the repo, and rotating any credential
later is just "update the env var, redeploy" — no code change needed.

Once the site is live on Netlify, go to **Site configuration → Environment
variables** and add:

| Variable | Value |
|---|---|
| `AIRTABLE_BASE_ID` | base ID from step 1 |
| `AIRTABLE_READ_ONLY_TOKEN` | the read-only token from step 1 |
| `AIRTABLE_WRITE_TOKEN` | the read/write token from step 1 — this one is *also* read by `netlify/functions/paintings.js` and `enquiries.js` server-side, and never appears in any browser-shipped file |
| `EMAILJS_TEMPLATE_ID` | the enquiry template ID (Template A) from step 3 |
| `EMAILJS_LOGIN_TEMPLATE_ID` | the login-link template ID (Template B) from step 3 |
| `CLOUDINARY_CLOUD_NAME` | cloud name from step 2 |
| `CLOUDINARY_UPLOAD_PRESET` | unsigned preset name from step 2 |
| `AUTH_SECRET` | A random value for signing login tokens — treat it like a password, since it's what makes a session token unforgeable. I generated one locally and will send it to you directly rather than writing it in this file (this file is in your public GitHub repo — anyone could read a secret committed here). Or generate your own: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DASHBOARD_ALLOWED_EMAIL` | the email address(es) allowed to log in, comma-separated — e.g. `budgerose5@gmail.com`, or add a couple more while testing: `budgerose5@gmail.com,pauljbisset@gmail.com` |

Then confirm **Functions** picked up `netlify/functions/paintings.js`,
`enquiries.js`, and `auth.js` after the first deploy (Netlify → Functions
tab).

**Cleanup (optional):** Identity is no longer used by this site at all —
safe to leave it enabled and ignored, or turn it off under Site
configuration → Identity if you'd rather tidy up. Either way, nothing in
the code touches it any more.

Send me (once live):
- The Netlify site URL, so I can double check everything end-to-end and
  update `og:` image / description URLs if useful

---

## What I've already built, waiting on the above

- **`index.html`** — the existing portfolio/about page, now reading the
  gallery from Airtable instead of a hardcoded list, with a new "Shop"
  nav link
- **`shop.html`** — gallery with optional category filters, painting
  detail pages, basket (drawer + full page), checkout as an enquiry form,
  thank-you screen. Reads Airtable directly with the read-only token.
- **`dashboard.html`** — Rose's private admin, linked quietly from the
  homepage footer ("Studio") rather than the main nav. Own magic-link
  login (email in, click the link, signed in for 30 days — see §4),
  stats cards, Paintings tab (drag-to-reorder, inline edit, Cloudinary
  photo upload, Available/Reserved/Sold status, delete), Enquiries tab
  (reads what visitors submit, lets Rose mark New/Contacted/Closed).
- **`netlify/functions/paintings.js`** and **`enquiries.js`** — hold the
  Airtable write token server-side; the dashboard calls these with a
  signed session token (proving Rose clicked her login link) rather than
  ever shipping a write-capable Airtable token to the browser.
- **`netlify/functions/auth.js`** — the login itself: emails a short-lived
  link to an allowed address, then exchanges a valid click for a 30-day
  session token. Stateless (no session database) — just an HMAC-signed
  token checked against `AUTH_SECRET`.
- The original 22 painting photos are still in `images/full` and
  `images/thumb` — useful as a starting point: once Cloudinary is set up,
  you could upload these into it to seed the first batch of `Paintings`
  rows, so Rose starts with a populated shop rather than an empty one.

## Assumptions flagged along the way

- **No shipping/delivery calculator.** The spec's enquiry form is Name /
  Email / Phone / Message only, with no payment, so I dropped the
  prototype's post-vs-collect shipping cost selector — that only made
  sense with real checkout pricing. Delivery/collection gets arranged by
  Rose after she replies to the enquiry.
- **`Category` is optional.** Kept it as an optional single-select for
  filter chips (matching the prototype's Coast/Woodland filters), but nothing
  breaks if it's left blank on every row — the filter row just won't show.
- **"Takings" stat** = sum of the price field across paintings currently
  marked `Sold`. There's no real order/payment ledger in this build (by
  design — BACS is arranged manually), so this is the closest proxy
  available from the data that exists.
- **Enquiries are logged to Airtable in addition to the email**, so
  they show up in the dashboard even if nobody checks the inbox from that
  device. The email send is still the primary "Rose finds out" path.
- **Delete added to the dashboard** (not explicitly requested, but "Save
  a mistake" felt incomplete without it) — gated the same way as every
  other write, with a confirmation prompt.

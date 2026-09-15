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
| `Hearts`     | Number (integer)                        | Optional but recommended — powers the shop's "heart a painting" feature and the dashboard's "Most loved" stat. Leave blank/0 on every row; visitors' hearts increment it. **If you skip this field, hearting still works for visitors (it shows locally in their browser either way) — it just won't add up across visitors until the field exists**, so no rush, add it whenever. |
| `Story`      | Long text                               | Optional — a short personal note Rose can add per painting ("painted after a stormy walk to Instow beach…"), shown on that painting's page. Leave blank to skip it for any painting. |

(No field is needed for "new painting" badges or the dashboard's welcome-back
recap — those use Airtable's built-in created-time and the browser's local
storage respectively, nothing to set up.)

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

### Table: `Lessons`

For the "Paint with Rose" art lesson booking section on the homepage.

| Field name | Type | Notes |
|---|---|---|
| `Date`     | Date, **with "include a time field" turned on** | The session's start date & time. Set a fixed timezone under the field's options (e.g. Europe/London) rather than "same timezone for everyone viewing" — keeps times unambiguous. |
| `Price`    | Number (currency £) | Per person — the dashboard defaults new lessons to £45 |
| `Capacity` | Number (integer) | Max people for that session |
| `Booked`   | Number (integer) | How many are confirmed so far — **Rose updates this by hand** in the dashboard as she confirms bookings (bookings are enquiries, not automatic — see below). Default `0`. |
| `Status`   | Single select: `Open`, `Cancelled` | Default `Open`. There's deliberately no separate "Full" option — the shop works that out itself once `Booked` reaches `Capacity`, so nothing needs remembering there. |
| `Location` | Single line text | Optional — e.g. "Studio, Instow" |
| `Notes`    | Long text | Optional — anything specific to that date (skill level, what's covered, etc.) |

You don't need to add rows by hand here either — the dashboard's Lessons
tab (its own "+ Add a lesson" button, alongside Paintings) creates these.

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

Both tokens are scoped to the **whole base**, not individual tables, so
adding the `Lessons` table above doesn't need either token touching again
— it's covered automatically. (If Airtable's token editor shows a list of
specific tables rather than "all tables" for yours, just add `Lessons` to
that list on both tokens.)

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

## 3. EmailJS — one template, serving the enquiry email, the dashboard login link, the homepage contact form, the commission enquiry form, and the lesson booking form

Using your existing account (service `service_3zklcnj`, public key
`ZJel9MV1Hctfuo6cU` — already in the code). All five emails run through
the **same template** — EmailJS's plan limits are on how many templates
you can *create*, not how many variables one template can use or how many
times it's sent, so one flexible template covers all five rather than
needing separate ones.

Create (or you may already have) a template with these variables:

```
{{email_kind}}

{{from_name}}  ·  {{from_email}}  ·  {{from_phone}}

{{message}}

{{list_label}}
{{items}}

{{highlight_label}}: {{total}}
{{footer_label}} {{submitted_at}}
```

Set the template's **To email** to `{{to_email}}` (not a fixed address —
it needs to go to whoever the code sends it to, which differs between
the two uses below).

For the **enquiry email**, the code (`js/shop.js`) sends:
`email_kind` = "New Shop Enquiry", `list_label` = "Paintings enquired
about", `highlight_label` = "Total", `footer_label` = "Submitted", plus
the visitor's actual name/email/phone/message/items/total — so it reads
exactly as a normal enquiry notification.

For the **dashboard login email**, the code (`netlify/functions/auth.js`)
sends different values through those same slots — `email_kind` = "Sign-In
Link", a clickable sign-in link in place of the message, "Expires in: 15
minutes" in place of the total, and so on — so the same layout reads
sensibly as a login email instead.

For the **homepage contact form** (`index.html`), the code sends
`email_kind` = "New Contact Message" plus the visitor's actual
name/email/phone/message; `list_label`, `items`, and `highlight_label`/
`total` are left blank since there's no basket to list — the template
just prints a couple of empty lines there, which is fine.

For the **commission enquiry form** (also `index.html`), `email_kind` =
"New Commission Enquiry" and the visitor's description goes through
`message` as usual — the optional "approximate size" and "budget"
fields they can fill in go through `list_label`/`items` (the same slot
the shop enquiry uses for its list of paintings), so the email reads
as a short "Commission details" list above the description when either
is filled in, and just omits that section when both are left blank.

For the **lesson booking form** (also `index.html`), `email_kind` =
"New Lesson Booking Enquiry", `list_label` = "Session" with `items` set
to the chosen date/time (or a note that no date was picked, if the
visitor messaged in with no sessions currently open), and — since a
lesson actually has a fixed price, unlike a commission — `highlight_label`
= "Price" with `total` set to that session's price, so the email reads
with the price shown clearly like the shop enquiry does.

If you're adapting a template you already built for the enquiry email
(rather than starting fresh), just make sure `email_kind`, `list_label`,
`highlight_label`, and `footer_label` wrap whatever static label text is
currently hardcoded in those four spots (e.g. a fixed "Paintings
enquired about" heading becomes `{{list_label}}`) — everything else can
stay as it is. One more addition, right after wherever `{{message}}`
sits: add `{{{action_html}}}` immediately after it (triple braces, not
double) — `{{message}}{{{action_html}}}`. EmailJS escapes double-brace
variables by default, which is right for the enquiry message (arbitrary
visitor text shouldn't be able to inject HTML into Rose's inbox) but
would turn the login email's actual clickable link into visible literal
text — triple braces render as real HTML instead.

Send me:
- The template's **ID**

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
| `EMAILJS_TEMPLATE_ID` | the shared template ID from step 3 — used for both the enquiry and login emails |
| `EMAILJS_PRIVATE_KEY` | Account → Security → tick "Allow EmailJS API for non-browser applications" (needed since the login email is sent from a Netlify Function, not a browser, so EmailJS can't check an Origin header the way it does for the enquiry email) → the private key that unlocks. A real secret — never commit it, only ever as this env var. |
| `CLOUDINARY_CLOUD_NAME` | cloud name from step 2 |
| `CLOUDINARY_UPLOAD_PRESET` | unsigned preset name from step 2 |
| `AUTH_SECRET` | A random value for signing login tokens — treat it like a password, since it's what makes a session token unforgeable. I generated one locally and will send it to you directly rather than writing it in this file (this file is in your public GitHub repo — anyone could read a secret committed here). Or generate your own: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `DASHBOARD_ALLOWED_EMAIL` | the email address(es) allowed to log in, comma-separated — e.g. `budgerose5@gmail.com`, or add a couple more while testing: `budgerose5@gmail.com,pauljbisset@gmail.com` |

(If you later move to an EmailJS plan with more templates and want a
fully separate one for logins, set `EMAILJS_LOGIN_TEMPLATE_ID` too — the
code checks for it first and falls back to `EMAILJS_TEMPLATE_ID` if it's
not set, so this is optional, not required.)

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

## 5. Prints — pricing and fulfillment

Every painting can now also be ordered as an unframed print, in a choice
of five sizes, shipped rolled in a tube. This is config-driven, not stored
in Airtable — there's nothing to set up here, but it's worth understanding
how the numbers work so the prices stay sensible if costs change.

**Where the prices live:** `js/config.js`, the `prints.sizes` array. Each
entry is `{ size, price }` — edit the `price` values directly (no code
change needed) if costs from the print service change or you want to
adjust margins.

**Fulfillment (manual, via [doxdirect.com](https://www.doxdirect.com/)):**
same enquiry-only model as originals — nothing is charged automatically.
When a print enquiry comes in:
1. Rose replies to arrange payment (bank transfer, as with originals) and
   confirms the delivery address (the checkout form now asks for one,
   since prints — unlike originals — always need to be posted).
2. Once paid, she (or you) place the actual print order on doxdirect.com
   using the painting's full-size image (already on Cloudinary — the
   same image used on the painting's detail page) and the size the
   customer chose.
3. Doxdirect prints and ships directly to the customer.

**How the prices were worked out** — doxdirect's per-print cost, plus a
delivery cost of roughly £8, plus a profit margin that scales with size
(so a small A4 isn't stuck with the same flat markup as a large A0):

| Size | Print cost | Delivery | Break-even | **Price charged** | Profit |
|---|---|---|---|---|---|
| A4 | £1 | £8 | £9 | **£35** | £26 |
| A3 | £3 | £8 | £11 | **£40** | £29 |
| A2 | £11 | £8 | £19 | **£55** | £36 |
| A1 | £18 | £8 | £26 | **£75** | £49 |
| A0 | £25 | £8 | £33 | **£95** | £62 |

The £8 delivery is only charged once per doxdirect order, no matter how
many prints are in it — but each print's price already has its own £8
folded in, so if a customer orders two prints together in one enquiry,
the actual delivery cost is a little lower than what's priced in. That's
a deliberate simplification (one flat number per size, not a "delivery
calculated at checkout" system) and just means multi-print orders are
slightly more profitable than the table above shows — no adjustment
needed on your end.

---

## What I've already built, waiting on the above

- **`index.html`** — the existing portfolio/about page, now reading the
  gallery from Airtable instead of a hardcoded list, with a new "Shop"
  nav link, a "Get in touch" contact form, and a "Commissions" section
  with its own form (size/space and budget are optional, both fold into
  the same email alongside the visitor's description) — both send via
  EmailJS and log to the dashboard's Enquiries tab, same as the shop's
  checkout. Also a "Paint with Rose" **Lessons** section — upcoming Open
  sessions with spots-left shown, feeding a booking enquiry form for a
  chosen date; if nothing's currently open it shows a friendly note
  instead of an empty form.
- **`netlify/functions/lessons.js`** — session-gated CRUD for the
  Lessons table, mirroring `paintings.js` exactly. The public homepage
  reads Lessons directly with the read-only Airtable token (like
  paintings/prints), never through this function.
- **`shop.html`** — gallery with optional category filters, painting
  detail pages, basket (drawer + full page), checkout as an enquiry form,
  thank-you screen. Reads Airtable directly with the read-only token.
  Every painting can also be added as a print in a choice of sizes (see
  §5) alongside, or instead of, the original. Visitors can also heart a
  painting (no login needed), see a "New" badge on recently added work,
  and read a short personal story Rose can add per painting.
- **`dashboard.html`** — Rose's private admin, linked quietly from the
  homepage footer ("Studio") rather than the main nav. Own magic-link
  login (email in, click the link, signed in for 30 days — see §4),
  stats cards (now including "Most loved", based on hearts), Paintings
  tab (drag-to-reorder, inline edit, Cloudinary photo upload,
  Available/Reserved/Sold status, an optional Story note, delete),
  a new **Lessons tab** (add a session's date/time/capacity/price,
  update how many are Booked as she confirms them, mark Cancelled,
  delete — sessions list soonest-first automatically), and an
  Enquiries tab (reads what visitors submit, lets Rose mark
  New/Contacted/Closed). If she's been away 2+ days, the first thing she
  sees on her next visit is a "Welcome back" recap — new enquiries,
  hearts given, and the most-loved painting while she was gone.
- **`netlify/functions/paintings.js`** and **`enquiries.js`** — hold the
  Airtable write token server-side; the dashboard calls these with a
  signed session token (proving Rose clicked her login link) rather than
  ever shipping a write-capable Airtable token to the browser.
- **`netlify/functions/auth.js`** — the login itself: emails a short-lived
  link to an allowed address, then exchanges a valid click for a 30-day
  session token. Stateless (no session database) — just an HMAC-signed
  token checked against `AUTH_SECRET`.
- **`netlify/functions/hearts.js`** — public, no login needed (same trust
  level as the enquiry form): increments/decrements a painting's `Hearts`
  count when a visitor taps the heart icon. Best-effort — if the `Hearts`
  field isn't in Airtable yet, it quietly no-ops rather than breaking
  anything for the visitor.
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
- **Print sizes/prices are the same for every painting**, set once in
  `js/config.js` rather than per-painting in Airtable — simplest option
  given every painting's print goes through the same fixed-size doxdirect
  process. If different paintings ever need different print pricing,
  that'd need a small rework (moving the price table into Airtable), but
  wasn't needed for this.
- **Delivery address added to the checkout form**, optional for
  originals but effectively required for prints — prints always get
  posted, so there's now somewhere for the customer to put that.
- **Hearts are one-per-browser, not one-per-person** — a visitor toggles
  a heart via their browser's local storage (no login for shop visitors),
  so clearing site data or switching devices resets it for them. Fine
  for a lightweight "give it some love" gesture; wasn't worth adding
  accounts over.
- **The welcome-back recap is per-device, not per-account** — it compares
  today's counts to whatever this same browser last recorded, stored in
  its local storage rather than Airtable. If Rose opens the dashboard
  from a different device the first time she's back, she just won't see
  a recap that once (everything else works normally) — simplest option
  that needed no new Airtable table.
- **"New" badges use Airtable's built-in created-time**, not a new field
  — a painting added in roughly the last two weeks gets the badge
  automatically, no action needed when adding one.
- **Sold/Reserved paintings stay in the shop instead of disappearing.**
  Originally the shop only fetched `Status = Available` records, so
  marking something Sold silently removed it — including the ability to
  buy a print of it, which has nothing to do with whether the one-off
  original is still around. Now the shop fetches every painting and
  shows a "Sold"/"Reserved" badge instead, swapping the "Add to basket"
  button for a note when the original itself isn't buyable — prints stay
  orderable regardless of status. The homepage portfolio grid picks up
  the same fix, so a sold painting no longer vanishes from Rose's "about"
  page either.
- **Homepage "Get in touch" is now a real form, not a `mailto:`/`tel:`
  link.** A `mailto:` link and a visible phone number are exactly what
  email-harvesting bots scan a page for — clicking through to an email
  client was also friction most visitors won't bother with. Replaced
  with a proper Name/Email/Phone/Message form that sends straight
  through EmailJS (same shared template as the shop enquiry and login
  emails), and removed the visible phone number from the page entirely.
  Rose's email address still lives in `js/config.js` as the send
  destination (same as it already did for the shop), so this isn't a
  bigger promise than that — it just stops adding a second, more
  scraper-obvious copy of it on the homepage on top.
- **Commissions get their own section and form, v1 kept deliberately
  simple.** No pricing calculator and no reference-photo upload for
  now — just a short "how it works" explainer and a form asking for
  size/space and budget (both optional free text, not fixed price
  bands, since I don't know Rose's actual commission pricing) plus a
  required description. Both new and now the existing contact form
  also log to Airtable's `Enquiries` table (same best-effort pattern
  the shop's checkout already uses) so they show up on the dashboard
  even if an email goes to spam — worth doing consistently now rather
  than leaving the contact form as the one form that only emails.
- **Lessons are enquiry-only, same as everything else — no payment
  processing.** Booking a lesson sends an enquiry for a specific date;
  it never reserves a spot automatically. Rose confirms and takes
  payment manually (bank transfer, as elsewhere), then updates that
  session's `Booked` count in her dashboard herself. This was a
  deliberate choice over instant Stripe-style pay-to-book — it keeps
  the site's payment surface at zero (nothing to secure, no refund
  flows, no webhook plumbing) at the cost of a booking not being
  instantly guaranteed. If that tradeoff ever stops feeling right —
  e.g. sessions regularly filling before Rose can reply — Stripe
  Payment Links (one per session, no custom payment code needed) would
  be the next step up without a full rebuild.
- **A session's "Full" state is computed, not stored.** The `Status`
  field only has `Open`/`Cancelled` — whether a session is full is
  worked out from `Booked >= Capacity` wherever it matters (the public
  list, and the dashboard's row pill), so there's no way for Rose to
  forget to flip a status and accidentally leave a full class bookable.
  She only ever has to think about Cancelled.
- **No overbooking protection beyond Rose's own judgement.** Because
  booking is an enquiry (not an instant transaction), two people could
  enquire about the last spot at the same time; whoever she confirms
  first gets it. Same category of risk as everything else on this
  site being manually confirmed — not a new one introduced by lessons.
- **Shop sort control (Featured/Newest/Most loved/Price).** Sits next
  to the category filter chips. "Featured" is the default and is just
  Rose's own drag-to-reorder `Sort Order` from the dashboard — nothing
  changes for her, sorting is purely a visitor-side view on top of
  data that already exists (hearts, created-time, price), no new
  Airtable field needed.

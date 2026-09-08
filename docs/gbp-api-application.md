# Google Business Profile API — access application

Two separate Google products, on very different timelines. Only one of them is
blocking anything.

| | Places API (New) | Business Profile API |
| --- | --- | --- |
| Needs an application | No | **Yes** |
| Needs us to own a profile | No | **Yes — verified, 60+ days old** |
| Time to working | Under an hour | **Weeks, after a 60-day wait** |
| Gives us | Rating, review count, up to 5 recent reviews, read-only, for any business | Stored review history, **replying** to reviews, managing listing fields |
| Status | **Do this now — it unblocks the live rating already built** | Start the clock this week |

The platform already reads and displays ratings through Places. That is
deliberate: it means the review service is useful before any application is
approved.

---

## Track A — Places API. Do this now.

Nothing waits on this except the work already written.

1. Go to the Google Cloud console and create a project, e.g. `agastyaone-platform`.
2. **Enable billing on it.** Places returns `REQUEST_DENIED` without a billing
   account attached, even inside the free tier.
3. Enable **Places API (New)**. Not the legacy "Places API" — the platform calls
   the new `places.googleapis.com/v1` endpoint.
4. Create an API key, then **restrict it**: under API restrictions choose Places
   API (New) only. An unrestricted Maps key is a key anyone who finds it can
   spend against your card.
5. Send me the key. It goes in the environment as `GOOGLE_PLACES_API_KEY` —
   deliberately **not** `NEXT_PUBLIC_*`, because anything with that prefix is
   readable by every visitor's browser.

Set a **budget alert** on the project while you are in there. Place Details is
billed per request and per field group; the platform caches for ten minutes and
collapses concurrent lookups, but a budget alert is what tells you if something
changes.

### Then, per clinic

Each location needs its Google **place ID**, pasted into
Console → client → location → Reviews. Find it with Google's Place ID Finder, or
in the clinic's own Business Profile. Place IDs are stable across renames and
relocations, which is why the platform stores that rather than a name.

---

## Track B — Business Profile API. The 60-day clock has not started.

### The gate people miss

Access is granted against **a Business Profile that AgastyaOne itself owns**, and
that profile must be:

- **verified**, and
- **at least 60 days old**, and
- the application must be submitted **by the profile's owner** — a manager-level
  Google account is rejected, usually with no useful explanation.

AgastyaOne does not have its own Business Profile yet. Managing clients' profiles
does not substitute for it: on their listings we are a *manager*, not an owner.

**So the single most time-sensitive action on this whole plan is creating and
verifying AgastyaOne's own Business Profile — about an hour of work, and
everything else here sits behind it for 60 days.**

### Step 1 — this week

1. Create a Business Profile for AgastyaOne at business.google.com, using an
   account you control and will keep (`agastya@agastyaone.com`, not a personal
   address).
2. Complete verification. Postcard verification to a Bengaluru address is the
   slowest route; video or phone verification, if offered, is faster — take
   whichever is offered.
3. Note the **verification date**. Day 60 from then is the earliest the
   application can be submitted, and submitting before it is a rejection.
4. Confirm your account shows as **Owner**, not Manager, under Business Profile
   → Settings → People and access.

### Step 2 — in parallel, no waiting required

Use the same Cloud project as Track A.

1. Enable **My Business Account Management API** and **My Business Business
   Information API**.
2. Configure the OAuth consent screen. Scope:
   `https://www.googleapis.com/auth/business.manage` — one scope covers the
   whole family.
3. Note the **Cloud project number** (the numeric one, not the project ID). The
   application form asks for it.

One thing worth knowing before designing around it: **reviews are still on the
legacy v4 endpoint.** Google migrated most of the API to v1 but left reviews and
posts on `mybusiness.googleapis.com/v4` (`accounts.locations.reviews`), and that
API is not listed in the Cloud console's library until access is granted — so its
absence during setup is expected, not a mistake.

### Step 3 — the application, ready to submit

Submit at the Business Profile APIs access request form, **signed in as the
profile owner**. Below is the substance for each field; adjust the numbers to
what is true on the day.

**Fill in before sending**

- Legal entity name, exactly as registered
- Cloud project number
- Number of locations under management on the day of submission

---

**Company name:** AgastyaOne
**Website:** https://agastyaone.com
**Contact:** agastya@agastyaone.com
**Google Cloud project number:** `<from step 2>`
**Locations managed:** `<count on the day>`

**What is your use case?**

> AgastyaOne is a technology company in Bengaluru, India providing end-to-end
> digital operations for small healthcare businesses — primarily dental clinics.
> Clients contract us to manage their online presence, and we operate their
> Google Business Profiles on their behalf under that engagement.
>
> We have built an internal multi-tenant platform that our staff use to run
> client work, and through which each client sees their own results. We are
> requesting API access to replace three things our team currently does by hand
> in the Business Profile interface, one client at a time:
>
> 1. **Keeping listing details accurate.** We maintain an authoritative record of
>    each client's name, address and phone, and audit it against directories.
>    Corrections to the Google listing are applied manually today. The Business
>    Information API would let us apply an approved correction directly, and
>    detect drift when someone else edits the listing.
>
> 2. **Reading and replying to reviews.** Clinics ask us to respond to reviews
>    promptly and in their own voice. Our staff monitor and reply through the
>    Business Profile interface, per client, per location. Review access would
>    let us surface new reviews in one queue and post the reply the client has
>    approved.
>
> 3. **Reporting to the client.** Each client sees their own results in our
>    platform. Today we can show a live rating; we cannot show how it has changed
>    over the engagement, which is the question a client actually asks at
>    renewal.
>
> Access would be used only for locations where the client has appointed us and
> granted our account management access to their profile. Data is stored per
> client and is not aggregated, resold, or shared between clients. Our platform
> enforces this in the database itself: every table is row-level-security scoped
> to one client, and no query can return another client's data.
>
> We are not building a directory, a listing aggregator, or a consumer-facing
> product. This is an internal operations tool for a service business, plus a
> reporting view for the clients we already work for.

---

### After approval

- Quota starts low. Request an increase once real usage is visible rather than
  guessing up front.
- OAuth refresh tokens get revoked silently — when a client changes their Google
  password or removes access. The schema already carries `status`, `expires_at`,
  `last_refreshed_at` and `last_error` on `integrations` for exactly this, so a
  dead connection surfaces as a broken integration rather than as data that
  quietly stops updating.
- Review history can start being stored at that point. Until then it is
  deliberately not: Maps Platform terms allow Places ratings and review text to
  be *displayed* live with attribution, not warehoused, which is why
  `metric_snapshots` has no rating metric and the `reviews` table is empty.

---

## What is true today, without any of this

- The live rating and recent reviews appear in the Console and the Portal as soon
  as Track A is done and a place ID is set.
- Review requests work now: a QR code at the front desk, the scan recorded,
  the funnel reported. No Google approval, no Meta approval, no TRAI/DLT
  registration.
- What is missing until Track B lands: rating history, replying from the
  platform, and applying NAP corrections to Google directly rather than by hand.

## Sources

- [Prerequisites — Google Business Profile APIs](https://developers.google.com/my-business/content/prereqs)
- [Applying for Google Business Profile API access](https://support.google.com/business/workflow/16726127)
- [`accounts.locations.reviews.list` (v4)](https://developers.google.com/my-business/reference/rest/v4/accounts.locations.reviews/list)
- [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details)

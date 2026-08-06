# Cloud Sync (Supabase) — Setup & Notes

The tracker now syncs to a Supabase project so changes made on one device show up on others. This document is the setup checklist and the honest list of tradeoffs that come with it.

## One-time setup

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](../supabase/schema.sql) and run it. This creates the five tables (`members`, `hotspots`, `soul_records`, `church_members`, `settings`) and enables Row Level Security with policies that allow the app's anon key full read/write access.
3. That's it — `js/cloud-sync.js` already points at the project URL and key you gave us. No further configuration needed.

### Already set this up before? Run the Archive migration and the Users migration

If your Supabase project already existed before these features were added, run these once in the SQL Editor (safe alongside existing data — both only add things, nothing is deleted):
- **[`supabase/migrations/002_archive_columns.sql`](migrations/002_archive_columns.sql)** — adds `archived`/`archive_reason_category`/`archive_reason_text`/`archived_at` columns.
- **[`supabase/migrations/003_users.sql`](migrations/003_users.sql)** — adds the `users` table (login/roles).

Brand-new projects can skip both; running the full `schema.sql` already includes everything.

### ⚠️ Data loss incident (fixed)

If this project's cloud sync wiped existing data at some point, here's almost certainly why, and it's now fixed: the "full replace" sync path (used by Reset to demo data, Import, and the manual "Push" button) used to **delete every row first, then insert the new ones**. If that insert ever failed for any reason — most likely a schema mismatch, e.g. the app trying to write `archived`/`archive_reason_category` columns before migration 002 had been run — the delete had already gone through, and the table was left permanently empty with nothing to roll back to.

This is fixed: the insert now happens **first**, and only rows no longer present locally are deleted **after** confirming the insert succeeded. A failed sync can no longer wipe existing data — it just fails loudly and leaves things as they were. Verified with a test that specifically simulates a rejected insert and confirms existing rows survive.

**If you were affected:** unfortunately, since the delete-then-insert bug ran the delete first, there's no automatic recovery — check whether you have an exported `.sqlite` or `.json` backup from Members & Settings → Database from before the incident, since that's the most likely place to recover from.

## How it works

- **On load:** the app tries Supabase first. If reachable, that's the data you see — and a local SQLite copy is cached afterward (for the Export Database feature and as an offline fallback).
- **On save (the normal path):** every change updates the local SQLite backup **immediately and synchronously** — this backup has proven its worth already and is never skipped or delayed, regardless of what happens with the cloud sync below. The push to Supabase is **debounced 5 seconds**: rapid edits (adding several attendance dates, editing a few fields in a row) collapse into a single sync 5 seconds after the last change, instead of firing a network request per click.
- **Sync strategy — safe by default:** the debounced sync is an **incremental upsert**, not a wipe-and-replace. It only ever adds or updates rows for what's currently in your local data, plus deletes for whatever you explicitly deleted in the app (tracked precisely, row by row) — it never erases a row just because it's "missing" from the local payload. That matters because another device's changes might not have been pulled here yet; a save on this device should never be able to wipe them out.
- **Explicit full-replace actions:** **Reset to demo data**, **Import** (JSON or .sqlite), and the manual **"Push local data to cloud now"** button are different — these are deliberate, confirmed "make the cloud exactly match this" actions, so they do wipe and re-insert every table. Each one's confirmation dialog says so.
- **Offline:** if Supabase can't be reached, the app falls back to the last-known-good local copy (or the bundled seed database on a brand-new device with nothing cached yet), and shows "Offline — using local copy" in Members & Settings → Cloud Sync. Any unsynced deletes are retried automatically on the next successful sync.
- **Manual controls:** Members & Settings → Cloud Sync has "Push local data to cloud now" (full replace — see warning above) and "Pull latest from cloud now" (read-only, always safe) buttons.

## ⚠️ Security — please read

This app talks to Supabase using the **public anon key**. The Row Level Security policies in `supabase/schema.sql` grant that key **full read and write access to every row, in every table — including `users`**. That means:

- Anyone who has your Supabase project URL and this key can read **and change or delete** all of this data — including the names, phone numbers, and personal notes of people who've been reached in outreach, and (since the login/roles feature) the `users` table itself.
- The anon key is necessarily visible in your app's client-side JavaScript (`js/cloud-sync.js`) — that's normal for this kind of setup, but it means the key itself provides no real protection once the code is public (e.g. published on GitHub Pages, per this project's design).

**The login screen (Super Admin / Branch Admin / Hotspot Leader) is a UI-level access gate, not a substitute for this.** It stops someone from casually opening the app and reaching Settings — and gives every action a named owner — but it does **not** stop someone who calls the Supabase REST API directly with the anon key, bypassing the login screen entirely. If a deliberate bad actor with API access is the real concern (as opposed to casual/accidental misuse through the app itself), the actual fix is **Supabase Auth**: require real sign-in, and change the RLS policies from `using (true)` to something like `using (auth.role() = 'authenticated')`. That's a genuine follow-up project, not a small tweak — happy to build it if the risk warrants it.

## What wasn't possible to verify here

This integration was written and syntax/logic-tested against a **simulated** Supabase-like backend (to confirm the request shapes and fallback behavior), because the environment this was built in has no network path to `*.supabase.co`. It has **not** been exercised against your actual project. Please verify directly:

1. Open the live site, open the browser console, and check for any red errors.
2. Add a soul record, refresh the page, and confirm it's still there.
3. Open the same URL on a second device/browser and confirm the record shows up there too.
4. Check Members & Settings → Cloud Sync shows "● Connected."

If step 1 shows a `401`/`403` error, the most likely cause is a key mismatch — double check Project Settings → API in Supabase for the exact key it expects (Supabase has both "legacy" JWT anon keys and newer "publishable" keys; if one doesn't work, try the other). If you see a CORS error, Supabase's REST API allows all origins by default, so this would be unusual — worth checking Project Settings → API for any custom restrictions.

## Real-time updates (not included yet)

Right now, other devices see a change on their **next page load** or manual "Pull," not instantly. True live updates without refreshing would use Supabase's Realtime (websocket) channels — a reasonable next enhancement if instant multi-device updates matter more than what's here now.

# Cloud Sync (Supabase) — Setup & Notes

The tracker now syncs to a Supabase project so changes made on one device show up on others. This document is the setup checklist and the honest list of tradeoffs that come with it.

## One-time setup

1. Open your Supabase project → **SQL Editor** → **New query**.
2. Paste the entire contents of [`supabase/schema.sql`](../supabase/schema.sql) and run it. This creates the five tables (`members`, `hotspots`, `soul_records`, `church_members`, `settings`) and enables Row Level Security with policies that allow the app's anon key full read/write access.
3. That's it — `js/cloud-sync.js` already points at the project URL and key you gave us. No further configuration needed.

### Already set this up before? Run the Archive migration

If your Supabase project already existed before the Archive feature was added, its tables don't have the new `archived` / `archive_reason_category` / `archive_reason_text` / `archived_at` columns yet — `supabase/schema.sql`'s `create table if not exists` won't add columns to a table that already exists. Run **[`supabase/migrations/002_archive_columns.sql`](migrations/002_archive_columns.sql)** once in the SQL Editor to add them (safe to run alongside existing data — it only adds columns, nothing is deleted). Brand-new projects can skip this; running the full `schema.sql` already includes them.

## How it works

- **On load:** the app tries Supabase first. If reachable, that's the data you see — and a local SQLite copy is cached afterward (for the Export Database feature and as an offline fallback).
- **On save (the normal path):** every change updates the local SQLite backup **immediately and synchronously** — this backup has proven its worth already and is never skipped or delayed, regardless of what happens with the cloud sync below. The push to Supabase is **debounced 5 seconds**: rapid edits (adding several attendance dates, editing a few fields in a row) collapse into a single sync 5 seconds after the last change, instead of firing a network request per click.
- **Sync strategy — safe by default:** the debounced sync is an **incremental upsert**, not a wipe-and-replace. It only ever adds or updates rows for what's currently in your local data, plus deletes for whatever you explicitly deleted in the app (tracked precisely, row by row) — it never erases a row just because it's "missing" from the local payload. That matters because another device's changes might not have been pulled here yet; a save on this device should never be able to wipe them out.
- **Explicit full-replace actions:** **Reset to demo data**, **Import** (JSON or .sqlite), and the manual **"Push local data to cloud now"** button are different — these are deliberate, confirmed "make the cloud exactly match this" actions, so they do wipe and re-insert every table. Each one's confirmation dialog says so.
- **Offline:** if Supabase can't be reached, the app falls back to the last-known-good local copy (or the bundled seed database on a brand-new device with nothing cached yet), and shows "Offline — using local copy" in Members & Settings → Cloud Sync. Any unsynced deletes are retried automatically on the next successful sync.
- **Manual controls:** Members & Settings → Cloud Sync has "Push local data to cloud now" (full replace — see warning above) and "Pull latest from cloud now" (read-only, always safe) buttons.

## ⚠️ Security — please read

This app talks to Supabase using the **public anon key**, with no login. The Row Level Security policies in `supabase/schema.sql` grant that key **full read and write access to every row**. That means:

- Anyone who has your Supabase project URL and this key can read **and change or delete** all of this data — including the names, phone numbers, and personal notes of people who've been reached in outreach.
- The anon key is necessarily visible in your app's client-side JavaScript (`js/cloud-sync.js`) — that's normal for this kind of setup, but it means the key itself provides no real protection once the code is public (e.g. published on GitHub Pages, per this project's design).

**If this campus's data is sensitive enough to need real protection, the next step is Supabase Auth:** require team members to sign in (email/password or a magic link), and change the RLS policies in `supabase/schema.sql` from `using (true)` to something like `using (auth.role() = 'authenticated')`. That's a genuine follow-up project, not a small tweak — happy to build it if you want it, just flagging that the current setup trades security for simplicity, matching what was asked for ("no login, works across devices").

## What wasn't possible to verify here

This integration was written and syntax/logic-tested against a **simulated** Supabase-like backend (to confirm the request shapes and fallback behavior), because the environment this was built in has no network path to `*.supabase.co`. It has **not** been exercised against your actual project. Please verify directly:

1. Open the live site, open the browser console, and check for any red errors.
2. Add a soul record, refresh the page, and confirm it's still there.
3. Open the same URL on a second device/browser and confirm the record shows up there too.
4. Check Members & Settings → Cloud Sync shows "● Connected."

If step 1 shows a `401`/`403` error, the most likely cause is a key mismatch — double check Project Settings → API in Supabase for the exact key it expects (Supabase has both "legacy" JWT anon keys and newer "publishable" keys; if one doesn't work, try the other). If you see a CORS error, Supabase's REST API allows all origins by default, so this would be unusual — worth checking Project Settings → API for any custom restrictions.

## Real-time updates (not included yet)

Right now, other devices see a change on their **next page load** or manual "Pull," not instantly. True live updates without refreshing would use Supabase's Realtime (websocket) channels — a reasonable next enhancement if instant multi-device updates matter more than what's here now.

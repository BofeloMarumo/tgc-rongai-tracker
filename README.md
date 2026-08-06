# TGC Rongai Campus Tracker

A soul winning & "Plug In" tracker built for **The Go Church, Rongai Campus** — track every soul won, who's following up with them, and flag anyone going quiet before they're lost. No login, no build step, no server: open `index.html` in a browser, or host it free on GitHub Pages — **the database runs in the browser too**, so there's nothing extra to host.

📄 Full write-up of the data model, dashboard logic, and design system: [`docs/TECHNICAL_DOCUMENT.md`](docs/TECHNICAL_DOCUMENT.md)
🗄️ Database schema and workflows: [`docs/DATABASE.md`](docs/DATABASE.md)

## What it does

- **Follow-Up Radar** — three focused reports: who hasn't been contacted in 3+ days (by last note logged), clickable counts of who's attended hotspot/church, and every soul won sorted by date.
- **Dashboard tab** — souls won over time (month/year toggle), top soul winners (filterable), and follow-up load per Hotspot Leader — all with a Line/Bar chart toggle, click-to-drill-down, and a custom report builder.
- **Cloud Sync (Supabase)** — data syncs to a Supabase project so changes on one device show up on others. See [`supabase/CLOUD_SYNC.md`](supabase/CLOUD_SYNC.md) for setup and **please read the security note there** before using this with real outreach data.
- **Branding** — swap in a different church's logo (with an auto-generated favicon) and pick from four color-scheme presets, all synced across devices from Members & Settings.
- **Archive** — move a soul or church member off the active dashboards (relocated, handed to another branch, lost contact, etc.) without deleting anything. Its own tab tracks archived people plus two time-series reports, and everything can be unarchived any time.
- **Login & roles** — Super Admin / Branch Admin / Hotspot Leader accounts, with Members & Settings restricted to Super Admins. Managed entirely from within the app (Members & Settings → Users). Read the security note in [`supabase/CLOUD_SYNC.md`](supabase/CLOUD_SYNC.md) — it's a UI-level access gate, not a substitute for real backend security.
- **Soul Winning Records** — log who was won, by whom, when, their status, hotspot, follow-up member, and their **Plug-In Stage** (New Soul → Attends Hotspot → Attends Get Set → Service Team).
- **Auto-promotion** — the moment someone's Plug-In Stage hits *Service Team*, they're automatically moved into the **Church Member Report** and off the Radar.
- **Church Member Report** — address, hotspot, hotspot leader/discipler, notes, and a disciples checklist for anyone leading a hotspot.
- **Real SQLite database, no server** — the app runs on an actual SQLite database via [sql.js](https://sql.js.org) (SQLite compiled to WebAssembly), vendored locally with no CDN dependency. Export it as a real `.sqlite` file any time, or a plain `.json` backup, from Members & Settings.

## Running it locally

No installation needed — just open `index.html` in any browser.

```
git clone https://github.com/<your-username>/tgc-rongai-tracker.git
cd tgc-rongai-tracker
open index.html      # or double-click the file
```

## Hosting for free — two options

### Option A: Netlify Drop (fastest, no account, ~30 seconds)

1. Go to **https://app.netlify.com/drop**.
2. Drag the whole `tgc-tracker` folder onto the page.
3. You get a live URL instantly (e.g. `https://random-name-123.netlify.app`) — no sign-up required.

Good for quickly sharing a review link with the team.

### Option B: GitHub Pages (permanent, matches the technical document)

1. Push this project to a new GitHub repository with `index.html` at the root — make sure the `vendor/`, `data/`, and `db/` folders come along with it.
2. Go to **Settings → Pages** in the repository.
3. Under **Build and deployment**, set **Source** to `Deploy from a branch`, branch `main`, folder `/(root)`.
4. Save — your tracker will be live at `https://<your-username>.github.io/<repo-name>/` within a minute.

Either way, there is nothing else to deploy or configure — the database ships with the site and runs entirely in the visitor's browser (see `docs/DATABASE.md`).

## A note on data

The database (a real SQLite file, run via WebAssembly) is saved in **your browser's local storage**, not in the cloud. That keeps it free and simple to host, but it means:

- Data does not sync automatically between devices or team members.
- Use **Members & Settings → Database → Export database (.sqlite)** after each outreach or leaders' meeting, and share the file with whoever else needs the latest data. A plain `.json` export is also available.
- Clearing your browser data will erase the tracker's local copy too — export first!

See [`docs/TECHNICAL_DOCUMENT.md`](docs/TECHNICAL_DOCUMENT.md) §8 and [`docs/DATABASE.md`](docs/DATABASE.md) for the upgrade path to a shared, real-time backend once the campus needs multi-device syncing.

## Project structure

```
tgc-tracker/
├── index.html
├── css/styles.css
├── js/
│   ├── theme.js           # color presets + logo/favicon branding
│   ├── cloud-sync.js        # Supabase (PostgREST) sync
│   ├── store.js                # data layer: SQLite (sql.js) load/save, business logic
│   ├── charts.js                 # dependency-free SVG bar/line chart renderer
│   ├── render.js                    # DOM rendering per view
│   ├── dashboard.js                    # Dashboard tab: built-in + custom reports
│   ├── archive.js                         # Archive tab: archived souls/members + reports
│   ├── auth.js                               # Login screen, sessions, role-based access
│   └── app.js                                # tabs, modals, form handling
├── assets/                     # default logo + generated favicons
├── supabase/                # Postgres schema + cloud sync setup guide
├── vendor/sqljs/               # sql.js WASM engine, vendored (no CDN)
├── data/tracker.db                # the shipped database
├── db/
│   ├── schema.sql                   # table definitions
│   ├── seed.sql                      # starting data
│   └── build_db.py                     # rebuilds data/tracker.db from the two files above
└── docs/
    ├── TECHNICAL_DOCUMENT.md
    └── DATABASE.md
```

---
*Built for The Go Church, Rongai Campus — because every soul won deserves to be plugged in.*

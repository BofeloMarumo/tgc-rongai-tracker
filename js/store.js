/* ============================================================
   TGC Rongai Campus Tracker — Data layer
   Source of truth is a real SQLite database (via sql.js / WASM,
   vendored locally — no CDN, works fully offline on GitHub Pages).

   - First run: loads data/tracker.db (built from db/schema.sql +
     db/seed.sql) and caches a working copy in localStorage.
   - Every save(): rebuilds the SQLite database from the in-memory
     JS model and re-caches it, so the browser's copy is always a
     real, exportable .sqlite file — use "Export Database" in
     Members & Settings to download it any time.
   - Swap this file's load()/save() alone to move to a shared
     backend (see docs/TECHNICAL_DOCUMENT.md §8).
   ============================================================ */

const STORE_KEY = "tgc_rongai_tracker_v1";           // legacy JSON cache (still read once, for upgrades)
const DB_CACHE_KEY = "tgc_rongai_tracker_dbfile_v1"; // base64 SQLite binary, browser-local working copy
const DB_SEED_URL = "data/tracker.db";

let SQL = null; // sql.js module, set by initSqlJs()

// Same DDL as db/schema.sql — kept in sync manually. Embedding it here means
// save() can rebuild a fresh, valid .sqlite file with zero extra network calls.
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS members (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS hotspots (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  leader_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  capacity  INTEGER NOT NULL DEFAULT 10
);
CREATE TABLE IF NOT EXISTS soul_records (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  won_by_id        TEXT REFERENCES members(id) ON DELETE SET NULL,
  date_of_outreach TEXT,
  mobile           TEXT,
  status           TEXT NOT NULL DEFAULT 'New Soul',
  context          TEXT,
  follow_up_id     TEXT REFERENCES members(id) ON DELETE SET NULL,
  hotspot_id       TEXT REFERENCES hotspots(id) ON DELETE SET NULL,
  plug_in_stage    TEXT NOT NULL DEFAULT 'Guest',
  archived                 INTEGER NOT NULL DEFAULT 0,
  archive_reason_category  TEXT DEFAULT '',
  archive_reason_text      TEXT DEFAULT '',
  archived_at              TEXT
);
CREATE TABLE IF NOT EXISTS soul_hotspot_attendance (
  soul_id TEXT NOT NULL REFERENCES soul_records(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  PRIMARY KEY (soul_id, date)
);
CREATE TABLE IF NOT EXISTS soul_church_attendance (
  soul_id TEXT NOT NULL REFERENCES soul_records(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  PRIMARY KEY (soul_id, date)
);
CREATE TABLE IF NOT EXISTS soul_notes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  soul_id  TEXT NOT NULL REFERENCES soul_records(id) ON DELETE CASCADE,
  when_ts  TEXT NOT NULL,
  text     TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS church_members (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  address              TEXT,
  mobile               TEXT,
  hotspot_id           TEXT REFERENCES hotspots(id) ON DELETE SET NULL,
  is_hotspot_leader    INTEGER NOT NULL DEFAULT 0,
  leader_or_discipler  TEXT,
  notes                TEXT,
  archived                 INTEGER NOT NULL DEFAULT 0,
  archive_reason_category  TEXT DEFAULT '',
  archive_reason_text      TEXT DEFAULT '',
  archived_at              TEXT
);
CREATE TABLE IF NOT EXISTS church_member_disciples (
  church_member_id  TEXT NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  disciple_id       TEXT NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  PRIMARY KEY (church_member_id, disciple_id)
);
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

const PLUG_STAGES = ["Guest", "Attends Hotspot", "Attends Get Set", "Service Team"];

// A sentinel "Won By" value (not a real church member) for someone who
// wasn't met/invited during outreach or soul-winning — they came to Sunday
// service through someone's invite or a social media post. Kept out of the
// hotspot-attribution reports (Report 4), since no hotspot's outreach effort
// won them.
const SUNDAY_GUEST_ID = "SUNDAY_GUEST";
const TIMEZONE_KEY = "tgc_rongai_tracker_timezone";
const DEFAULT_TIMEZONE = "Africa/Nairobi";

function uid(prefix) {
  return prefix + "_" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
}

// The campus's chosen timezone, stored in localStorage (an app-level
// preference, not campus data, so it lives outside the SQLite database).
// Every "what is today" / "how long ago" calculation and every displayed
// timestamp routes through this, so results are consistent regardless of
// which device or timezone someone happens to be viewing the tracker from.
function getAppTimezone() {
  try {
    return localStorage.getItem(TIMEZONE_KEY) || DEFAULT_TIMEZONE;
  } catch (e) {
    return DEFAULT_TIMEZONE;
  }
}

function setAppTimezone(tz) {
  try {
    localStorage.setItem(TIMEZONE_KEY, tz);
  } catch (e) { /* ignore (private browsing etc.) */ }
}

function todayISO() {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: getAppTimezone(), year: "numeric", month: "2-digit", day: "2-digit",
    }).format(new Date());
  } catch (e) {
    return new Date().toISOString().slice(0, 10); // fallback if the zone string is somehow invalid
  }
}

// Human-readable "date at time" for a stored ISO timestamp, rendered in
// the app's chosen timezone via Intl.DateTimeFormat.
function formatDateTime(isoString) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: getAppTimezone(), dateStyle: "medium", timeStyle: "short",
    }).format(new Date(isoString));
  } catch (e) {
    return new Date(isoString).toLocaleString();
  }
}

// A plain "YYYY-MM-DD" date, formatted as e.g. "5 July 2026".
function formatNiceDate(isoDateOnly) {
  if (!isoDateOnly) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: getAppTimezone(), day: "numeric", month: "long", year: "numeric",
    }).format(new Date(isoDateOnly + "T12:00:00Z"));
  } catch (e) {
    return isoDateOnly;
  }
}

function daysBetween(isoDate) {
  if (!isoDate) return null;
  const then = new Date(isoDate + "T00:00:00Z");
  const now = new Date(todayISO() + "T00:00:00Z"); // anchors "today" to the chosen timezone's calendar date
  const diff = Math.round((now - then) / 86400000);
  return diff;
}

function mostRecent(dates) {
  if (!dates || dates.length === 0) return null;
  return [...dates].sort().slice(-1)[0];
}

function base64ToUint8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

function uint8ToBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

const Store = {
  data: null,

  // ---------- Undo ----------
  // A lightweight, in-memory (not persisted) stack of prior states, snapshotted
  // right before any edit or delete that overwrites existing data. Capped so
  // it can't grow unbounded during a long session.
  undoStack: [],
  _snapshot() {
    try {
      this.undoStack.push(JSON.parse(JSON.stringify(this.data)));
      if (this.undoStack.length > 10) this.undoStack.shift();
    } catch (e) { /* ignore — undo is a convenience, not a guarantee */ }
  },
  canUndo() {
    return this.undoStack.length > 0;
  },
  undo() {
    if (!this.undoStack.length) return false;
    this.data = this.undoStack.pop();
    // Undo can resurrect a deleted row or remove one that was just added —
    // either way it needs the cloud to end up exactly matching this restored
    // state, so it uses the explicit full-replace path rather than the
    // normal incremental save() (which only ever adds/updates, never removes
    // rows based on absence).
    this._persistLocally();
    this._pendingDeletes = { members: [], hotspots: [], soul_records: [], church_members: [] };
    if (this._syncDebounceTimer) { clearTimeout(this._syncDebounceTimer); this._syncDebounceTimer = null; }
    this.cloudStatus = "pending";
    replaceAllInSupabase(this.data)
      .then(() => { this.cloudStatus = "connected"; if (typeof renderAdmin === "function") renderAdmin(); })
      .catch((e) => { this.cloudStatus = "offline"; console.warn("Supabase sync failed after undo.", e); if (typeof renderAdmin === "function") renderAdmin(); });
    return true;
  },

  // ---------- Pending deletes: rows explicitly removed locally, queued so
  // the next cloud sync deletes exactly those rows — never inferred from
  // "missing from the current payload," which is what keeps ordinary saves
  // from ever erasing data that only exists remotely so far.
  _pendingDeletes: { members: [], hotspots: [], soul_records: [], church_members: [] },
  _queueDelete(table, id) {
    if (!this._pendingDeletes[table]) this._pendingDeletes[table] = [];
    this._pendingDeletes[table].push(id);
  },

  // ---------- Load: Supabase first (cross-device source of truth), then
  // fall back to the local SQLite cache/bundled seed if offline or
  // unreachable. Either way, a local SQLite copy is kept for the Export
  // Database feature and as an offline fallback.
  cloudStatus: "unknown", // "connected" | "offline" | "unknown" | "pending"

  async load() {
    if (!SQL) {
      SQL = await initSqlJs({ locateFile: (f) => `vendor/sqljs/${f}` });
    }

    try {
      this.data = await loadFromSupabase();
      this._migrate();
      this._persistLocally(); // cache a local SQLite copy too, without re-pushing what we just pulled
      this.cloudStatus = "connected";
      return this.data;
    } catch (e) {
      console.warn("Supabase unreachable, falling back to the local copy on this device.", e);
      this.cloudStatus = "offline";
    }

    const cached = localStorage.getItem(DB_CACHE_KEY);
    if (cached) {
      const db = new SQL.Database(base64ToUint8(cached));
      this.data = this._hydrateFromDb(db);
      db.close();
      this._migrate();
      return this.data;
    }

    // No browser-local copy yet: fetch the database that ships with the repo.
    try {
      const resp = await fetch(DB_SEED_URL);
      if (!resp.ok) throw new Error("tracker.db not found");
      const buf = new Uint8Array(await resp.arrayBuffer());
      const db = new SQL.Database(buf);
      this.data = this._hydrateFromDb(db);
      db.close();
      this._migrate();
      this._persistLocally(); // cache a working copy for this browser
      return this.data;
    } catch (e) {
      console.warn("Could not load data/tracker.db, falling back to built-in demo data.", e);
      this.data = this._seed();
      this._migrate();
      this._persistLocally();
      return this.data;
    }
  },

  // Read every table out of an open sql.js Database into the same
  // plain-JS shape the rest of the app already expects.
  _hydrateFromDb(db) {
    const all = (sql) => {
      const res = db.exec(sql);
      if (!res.length) return [];
      const { columns, values } = res[0];
      return values.map((row) => Object.fromEntries(columns.map((c, i) => [c, row[i]])));
    };

    const members = all("SELECT id, name FROM members").map((m) => ({ id: m.id, name: m.name }));

    const hotspots = all("SELECT id, name, leader_id, capacity FROM hotspots").map((h) => ({
      id: h.id, name: h.name, leaderId: h.leader_id, capacity: h.capacity || 10,
    }));

    const soulRows = all(`SELECT id, name, won_by_id, date_of_outreach, mobile, status, context,
                                  follow_up_id, hotspot_id, plug_in_stage,
                                  archived, archive_reason_category, archive_reason_text, archived_at FROM soul_records`);
    const hotspotAtt = all("SELECT soul_id, date FROM soul_hotspot_attendance");
    const churchAtt = all("SELECT soul_id, date FROM soul_church_attendance");
    const notes = all("SELECT soul_id, when_ts, text FROM soul_notes ORDER BY id ASC");

    const soulRecords = soulRows.map((r) => ({
      id: r.id,
      name: r.name,
      wonById: r.won_by_id,
      dateOfOutreach: r.date_of_outreach,
      mobile: r.mobile,
      status: r.status,
      context: r.context,
      followUpId: r.follow_up_id,
      hotspotId: r.hotspot_id,
      plugInStage: r.plug_in_stage,
      hotspotAttendance: hotspotAtt.filter((a) => a.soul_id === r.id).map((a) => a.date),
      churchAttendance: churchAtt.filter((a) => a.soul_id === r.id).map((a) => a.date),
      notes: notes.filter((n) => n.soul_id === r.id).map((n) => ({ when: n.when_ts, text: n.text })),
      archived: !!r.archived,
      archiveReasonCategory: r.archive_reason_category || "",
      archiveReasonText: r.archive_reason_text || "",
      archivedAt: r.archived_at || null,
    }));

    const cmRows = all(`SELECT id, name, address, mobile, hotspot_id, is_hotspot_leader,
                                leader_or_discipler, notes,
                                archived, archive_reason_category, archive_reason_text, archived_at FROM church_members`);
    const discipleLinks = all("SELECT church_member_id, disciple_id FROM church_member_disciples");

    const churchMembers = cmRows.map((c) => ({
      id: c.id,
      name: c.name,
      address: c.address || "",
      mobile: c.mobile || "",
      hotspotId: c.hotspot_id,
      isHotspotLeader: !!c.is_hotspot_leader,
      leaderOrDiscipler: c.leader_or_discipler || "",
      notes: c.notes || "",
      discipleIds: discipleLinks.filter((d) => d.church_member_id === c.id).map((d) => d.disciple_id),
      archived: !!c.archived,
      archiveReasonCategory: c.archive_reason_category || "",
      archiveReasonText: c.archive_reason_text || "",
      archivedAt: c.archived_at || null,
    }));

    const settingsRows = all("SELECT key, value FROM settings");
    const settings = { noteWarnDays: 3, noteDangerDays: 7, weeklyHotspotTarget: 10, previousSoulsWonByYear: {}, colorPreset: "blue_purple", logoDataUrl: null, archiveReasonCategories: ["Relocated", "Assigned to Another Branch/Pastor", "Lost Contact", "Personal Request", "Other"] };
    const jsonEncodedKeys = ["previousSoulsWonByYear", "archiveReasonCategories"];
    settingsRows.forEach((s) => {
      if (jsonEncodedKeys.includes(s.key)) {
        try { settings[s.key] = JSON.parse(s.value); } catch (e) { /* keep the default already set above */ }
      } else {
        settings[s.key] = isNaN(s.value) ? s.value : Number(s.value);
      }
    });

    return { members, hotspots, soulRecords, churchMembers, settings };
  },

  // Rebuild a fresh SQLite database from the in-memory JS model.
  // Returns the raw Uint8Array (the real .sqlite file bytes).
  _buildDbBinary() {
    const db = new SQL.Database();
    db.run(SCHEMA_SQL);

    const d = this.data;
    d.members.forEach((m) => db.run("INSERT INTO members (id, name) VALUES (?, ?)", [m.id, m.name]));
    d.hotspots.forEach((h) => db.run("INSERT INTO hotspots (id, name, leader_id, capacity) VALUES (?, ?, ?, ?)", [h.id, h.name, h.leaderId || null, h.capacity || 10]));

    d.soulRecords.forEach((r) => {
      db.run(
        `INSERT INTO soul_records (id, name, won_by_id, date_of_outreach, mobile, status, context, follow_up_id, hotspot_id, plug_in_stage, archived, archive_reason_category, archive_reason_text, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [r.id, r.name, r.wonById || null, r.dateOfOutreach || null, r.mobile || "", r.status, r.context || "", r.followUpId || null, r.hotspotId || null, r.plugInStage,
         r.archived ? 1 : 0, r.archiveReasonCategory || "", r.archiveReasonText || "", r.archivedAt || null]
      );
      (r.hotspotAttendance || []).forEach((date) =>
        db.run("INSERT OR IGNORE INTO soul_hotspot_attendance (soul_id, date) VALUES (?, ?)", [r.id, date]));
      (r.churchAttendance || []).forEach((date) =>
        db.run("INSERT OR IGNORE INTO soul_church_attendance (soul_id, date) VALUES (?, ?)", [r.id, date]));
      (r.notes || []).forEach((n) =>
        db.run("INSERT INTO soul_notes (soul_id, when_ts, text) VALUES (?, ?, ?)", [r.id, n.when, n.text]));
    });

    d.churchMembers.forEach((c) => {
      db.run(
        `INSERT INTO church_members (id, name, address, mobile, hotspot_id, is_hotspot_leader, leader_or_discipler, notes, archived, archive_reason_category, archive_reason_text, archived_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [c.id, c.name, c.address || "", c.mobile || "", c.hotspotId || null, c.isHotspotLeader ? 1 : 0, c.leaderOrDiscipler || "", c.notes || "",
         c.archived ? 1 : 0, c.archiveReasonCategory || "", c.archiveReasonText || "", c.archivedAt || null]
      );
      (c.discipleIds || []).forEach((discId) =>
        db.run("INSERT OR IGNORE INTO church_member_disciples (church_member_id, disciple_id) VALUES (?, ?)", [c.id, discId]));
    });

    Object.entries(d.settings).forEach(([k, v]) => {
      if (v === null || v === undefined) return; // omit — _migrate() supplies the right default back
      const val = (typeof v === "object") ? JSON.stringify(v) : String(v);
      db.run("INSERT INTO settings (key, value) VALUES (?, ?)", [k, val]);
    });

    const binary = db.export();
    db.close();
    return binary;
  },

  // Persist locally: rebuild the real SQLite file from current data and
  // cache it. This is the local backup/offline fallback — it always runs
  // synchronously and immediately, completely independent of whether the
  // cloud sync below succeeds, fails, or hasn't fired yet. Also what backs
  // the "Export Database" feature.
  _persistLocally() {
    const binary = this._buildDbBinary();
    localStorage.setItem(DB_CACHE_KEY, uint8ToBase64(binary));
    localStorage.removeItem(STORE_KEY); // drop any legacy plain-JSON cache
  },

  // Persist: local backup happens immediately and synchronously (see
  // above), every time, no matter what. The cloud push is debounced —
  // rapid edits (adding several attendance dates, editing a few fields in a
  // row, etc.) collapse into a single sync 5 seconds after the last change,
  // instead of firing a network request per click. It's a safe, incremental
  // upsert: it only ever adds/updates rows for what's currently in `data`,
  // plus deletes for whatever's been explicitly queued in
  // `_pendingDeletes` — never a wipe-and-replace, so a save can't erase
  // something that only exists in the cloud so far (e.g. from another
  // device that hasn't been pulled here yet).
  _syncDebounceTimer: null,
  save() {
    this._persistLocally();
    this.cloudStatus = "pending";
    if (this._syncDebounceTimer) clearTimeout(this._syncDebounceTimer);
    this._syncDebounceTimer = setTimeout(() => {
      this._syncDebounceTimer = null;
      this._flushToCloud();
    }, 5000);
  },

  // Actually perform the debounced push. Also called immediately by the
  // manual controls (Members & Settings → Cloud Sync) so "Push now" doesn't
  // wait out the timer.
  async _flushToCloud() {
    const deletes = this._pendingDeletes;
    this._pendingDeletes = { members: [], hotspots: [], soul_records: [], church_members: [] };
    try {
      await saveToSupabase(this.data, deletes);
      this.cloudStatus = "connected";
    } catch (e) {
      this.cloudStatus = "offline";
      // Put the deletes back so the next successful sync still applies them.
      Object.keys(deletes).forEach((t) => {
        this._pendingDeletes[t] = (this._pendingDeletes[t] || []).concat(deletes[t]);
      });
      console.warn("Supabase sync failed — this change is saved locally but hasn't reached the cloud yet. Will retry on the next change or manual push.", e);
    }
    if (typeof renderAdmin === "function") renderAdmin();
  },

  // Manual controls (Members & Settings → Cloud Sync)
  async pushToCloud() {
    if (this._syncDebounceTimer) { clearTimeout(this._syncDebounceTimer); this._syncDebounceTimer = null; }
    // A deliberate, user-confirmed "make the cloud exactly match this
    // device" action — uses the explicit full-replace path, not the safe
    // incremental one, since the whole point is to force an exact match.
    await replaceAllInSupabase(this.data);
    this._pendingDeletes = { members: [], hotspots: [], soul_records: [], church_members: [] };
    this.cloudStatus = "connected";
  },

  async pullFromCloud() {
    if (this._syncDebounceTimer) { clearTimeout(this._syncDebounceTimer); this._syncDebounceTimer = null; }
    this._pendingDeletes = { members: [], hotspots: [], soul_records: [], church_members: [] };
    this.data = await loadFromSupabase();
    this._migrate();
    this._persistLocally();
    this.cloudStatus = "connected";
  },

  // Raw bytes of the current database, for the "Export Database" button.
  exportDbBinary() {
    return this._buildDbBinary();
  },

  // Load a .sqlite file the user picked (e.g. a teammate's exported copy).
  // Shared by Reset-to-demo, Import JSON, and Import Database: these are
  // deliberate, user-confirmed "replace everything" actions, so — unlike
  // the normal save() — they push an immediate, full replace rather than a
  // debounced incremental one.
  async _fullReplaceSave() {
    this._persistLocally();
    this._pendingDeletes = { members: [], hotspots: [], soul_records: [], church_members: [] };
    if (this._syncDebounceTimer) { clearTimeout(this._syncDebounceTimer); this._syncDebounceTimer = null; }
    try {
      await replaceAllInSupabase(this.data);
      this.cloudStatus = "connected";
    } catch (e) {
      this.cloudStatus = "offline";
      console.warn("Supabase sync failed for this action — saved locally; use Members & Settings → Cloud Sync → Push once back online.", e);
    }
  },

  async importDbBinary(uint8) {
    if (!SQL) SQL = await initSqlJs({ locateFile: (f) => `vendor/sqljs/${f}` });
    const db = new SQL.Database(uint8);
    if (this.data) this._snapshot();
    this.data = this._hydrateFromDb(db);
    db.close();
    this._migrate();
    await this._fullReplaceSave();
  },

  _migrate() {
    this.data.members = this.data.members || [];
    this.data.hotspots = this.data.hotspots || [];
    this.data.soulRecords = this.data.soulRecords || [];
    this.data.churchMembers = this.data.churchMembers || [];
    this.data.settings = this.data.settings || {};

    // Plug-In Stage rename: "New Soul" -> "Guest" (Status of Winning's own
    // "New Soul" option is untouched — these are two different fields that
    // happen to have shared the same label before this rename).
    this.data.soulRecords.forEach((r) => {
      if (r.plugInStage === "New Soul") r.plugInStage = "Guest";
    });
    if (this.data.settings.noteWarnDays == null) this.data.settings.noteWarnDays = 3;
    if (this.data.settings.noteDangerDays == null) this.data.settings.noteDangerDays = 7;
    if (this.data.settings.weeklyHotspotTarget == null) this.data.settings.weeklyHotspotTarget = 10;
    if (this.data.settings.previousSoulsWonByYear == null || typeof this.data.settings.previousSoulsWonByYear !== "object") {
      this.data.settings.previousSoulsWonByYear = {};
    }
    // Migrate the old flat single-number setting (pre-dates per-year tracking).
    const legacy = Number(this.data.settings.previousSoulsWon) || 0;
    if (legacy > 0) {
      const fallbackYear = String(Number(todayISO().slice(0, 4)) - 1);
      if (this.data.settings.previousSoulsWonByYear[fallbackYear] == null) {
        this.data.settings.previousSoulsWonByYear[fallbackYear] = legacy;
      }
    }
    delete this.data.settings.previousSoulsWon;
    if (this.data.settings.colorPreset == null) this.data.settings.colorPreset = "blue_purple";
    if (this.data.settings.logoDataUrl === undefined) this.data.settings.logoDataUrl = null;
    if (!Array.isArray(this.data.settings.archiveReasonCategories) || this.data.settings.archiveReasonCategories.length === 0) {
      this.data.settings.archiveReasonCategories = ["Relocated", "Assigned to Another Branch/Pastor", "Lost Contact", "Personal Request", "Other"];
    }

    // Backfill archive fields on records saved before the Archive feature existed.
    this.data.soulRecords.forEach((r) => {
      if (r.archived == null) r.archived = false;
      if (r.archiveReasonCategory == null) r.archiveReasonCategory = "";
      if (r.archiveReasonText == null) r.archiveReasonText = "";
      if (r.archivedAt === undefined) r.archivedAt = null;
    });
    this.data.churchMembers.forEach((c) => {
      if (c.archived == null) c.archived = false;
      if (c.archiveReasonCategory == null) c.archiveReasonCategory = "";
      if (c.archiveReasonText == null) c.archiveReasonText = "";
      if (c.archivedAt === undefined) c.archivedAt = null;
    });
  },

  _seed() {
    const members = [
      { id: "mem_grace", name: "Grace Wanjiru" },
      { id: "mem_kevin", name: "Kevin Otieno" },
      { id: "mem_faith", name: "Faith Njeri" },
      { id: "mem_brian", name: "Brian Mutiso" },
      { id: "mem_mercy", name: "Mercy Achieng" },
    ];

    const hotspots = [
      { id: "hot_zawadi", name: "Hotspot Zawadi", leaderId: "mem_grace", capacity: 10 },
      { id: "hot_amani",  name: "Hotspot Amani",  leaderId: "mem_kevin", capacity: 10 },
      { id: "hot_neema",  name: "Hotspot Neema",  leaderId: "mem_faith", capacity: 10 },
      { id: "hot_baraka", name: "Hotspot Baraka", leaderId: "mem_brian", capacity: 10 },
      { id: "hot_imani",  name: "Hotspot Imani",  leaderId: "mem_mercy", capacity: 10 },
    ];

    const soulRecords = [
      { id: "soul_peter", name: "Peter Kamau", wonById: "mem_kevin", dateOfOutreach: "2026-06-14", mobile: "0712 345 678", status: "New Soul", context: "Stays in Kware, works as a boda rider, met at the market outreach.", followUpId: "mem_grace", hotspotId: "hot_zawadi", plugInStage: "Guest", hotspotAttendance: [], churchAttendance: ["2026-06-15"], notes: [{ when: "2026-07-22T09:00:00.000Z", text: "Called him, he sounded excited about church. Invited him for hotspot this week." }] },
      { id: "soul_linet", name: "Linet Wambui", wonById: "mem_brian", dateOfOutreach: "2026-05-02", mobile: "0722 111 222", status: "Rededicated Their Life", context: "University student at TUK, rededicated her life during campus outreach.", followUpId: "mem_faith", hotspotId: "hot_amani", plugInStage: "Attends Hotspot", hotspotAttendance: ["2026-05-10", "2026-05-17", "2026-06-01"], churchAttendance: ["2026-05-04", "2026-05-11"], notes: [{ when: "2026-06-02T09:00:00.000Z", text: "Missed last two church services, exams. Will check in after exams end." }] },
      { id: "soul_samuel", name: "Samuel Ouma", wonById: "mem_mercy", dateOfOutreach: "2026-04-20", mobile: "0733 909 090", status: "New Soul", context: "Met through a friend's invite, works at a barber shop in Rongai.", followUpId: "mem_mercy", hotspotId: "hot_zawadi", plugInStage: "Attends Get Set", hotspotAttendance: ["2026-04-26", "2026-05-03"], churchAttendance: ["2026-04-27"], notes: [] },
      { id: "soul_james", name: "James Mwaura", wonById: "mem_grace", dateOfOutreach: "2026-07-18", mobile: "0710 223 344", status: "New Soul", context: "Met at the bus stop outreach, works at a hardware shop in Rongai town.", followUpId: "mem_grace", hotspotId: "hot_zawadi", plugInStage: "Guest", hotspotAttendance: [], churchAttendance: ["2026-07-20"], notes: [{ when: "2026-07-22T10:00:00.000Z", text: "Quick call, doing well, promised to attend hotspot this week." }] },
      { id: "soul_sarah", name: "Sarah Chepkemoi", wonById: "mem_kevin", dateOfOutreach: "2026-07-10", mobile: "0721 556 677", status: "Already Born Again", context: "Moved to Rongai recently from Eldoret, looking for a church home.", followUpId: "mem_kevin", hotspotId: "hot_amani", plugInStage: "Attends Hotspot", hotspotAttendance: ["2026-07-12"], churchAttendance: ["2026-07-13"], notes: [{ when: "2026-07-15T09:00:00.000Z", text: "Settling in well, connected her with two ladies in the hotspot." }] },
      { id: "soul_michael", name: "Michael Kariuki", wonById: "mem_faith", dateOfOutreach: "2026-06-25", mobile: "0733 889 900", status: "New Soul", context: "Works as a mechanic near Tuala, met through a workmate's invite.", followUpId: "mem_faith", hotspotId: "hot_neema", plugInStage: "Attends Get Set", hotspotAttendance: ["2026-06-28", "2026-07-05"], churchAttendance: [], notes: [] },
      { id: "soul_alice", name: "Alice Nyokabi", wonById: "mem_brian", dateOfOutreach: "2026-06-10", mobile: "0745 112 233", status: "Rededicated Their Life", context: "University student, rededicated during a hostel Bible study outreach.", followUpId: "mem_brian", hotspotId: "hot_baraka", plugInStage: "Attends Hotspot", hotspotAttendance: ["2026-06-20"], churchAttendance: ["2026-06-14"], notes: [{ when: "2026-07-20T09:00:00.000Z", text: "Doing well, exams are over, back to regular hotspot attendance." }] },
      { id: "soul_tom", name: "Tom Odongo", wonById: "mem_mercy", dateOfOutreach: "2026-05-28", mobile: "0700 998 877", status: "New Soul", context: "Boda rider met at the stage outreach near Kware.", followUpId: "mem_mercy", hotspotId: "hot_imani", plugInStage: "Guest", hotspotAttendance: [], churchAttendance: [], notes: [{ when: "2026-06-01T09:00:00.000Z", text: "Hard to reach, phone off most times. Will try visiting in person." }] },
      { id: "soul_lucy", name: "Lucy Wanjala", wonById: "mem_grace", dateOfOutreach: "2026-05-15", mobile: "0711 334 455", status: "New Soul", context: "Works at a salon in Rongai, very warm and welcoming personality.", followUpId: "mem_grace", hotspotId: "hot_zawadi", plugInStage: "Attends Hotspot", hotspotAttendance: ["2026-05-20", "2026-06-01"], churchAttendance: ["2026-05-18"], notes: [{ when: "2026-07-23T08:00:00.000Z", text: "Caught up after service today, she's doing really well." }] },
      { id: "soul_briank", name: "Brian Kiptanui", wonById: "mem_kevin", dateOfOutreach: "2026-04-30", mobile: "0722 665 544", status: "Already Born Again", context: "New to Rongai, previously fellowshipped at a church upcountry.", followUpId: "mem_kevin", hotspotId: "hot_amani", plugInStage: "Attends Get Set", hotspotAttendance: ["2026-05-02"], churchAttendance: ["2026-05-04"], notes: [{ when: "2026-05-05T09:00:00.000Z", text: "Attended Get Set once, hasn't been reachable since." }] },
      { id: "soul_nancy", name: "Nancy Cherotich", wonById: "mem_faith", dateOfOutreach: "2026-04-15", mobile: "0733 221 100", status: "New Soul", context: "Met at the market outreach, sells vegetables near Nkoroi.", followUpId: "mem_faith", hotspotId: "hot_neema", plugInStage: "Guest", hotspotAttendance: [], churchAttendance: [], notes: [] },
      { id: "soul_paul", name: "Paul Mbugua", wonById: "mem_brian", dateOfOutreach: "2026-03-22", mobile: "0710 887 766", status: "Rededicated Their Life", context: "Long-time Rongai resident, rededicated after a men's outreach breakfast.", followUpId: "mem_brian", hotspotId: "hot_baraka", plugInStage: "Attends Hotspot", hotspotAttendance: ["2026-04-01", "2026-05-01", "2026-06-01"], churchAttendance: ["2026-04-05"], notes: [{ when: "2026-07-21T09:00:00.000Z", text: "Very consistent, growing fast, considering him for Get Set next." }] },
      { id: "soul_faithn", name: "Faith Nekesa", wonById: "mem_mercy", dateOfOutreach: "2026-02-10", mobile: "0721 998 811", status: "New Soul", context: "Met through a friend's invite at a women's outreach event.", followUpId: "mem_mercy", hotspotId: "hot_imani", plugInStage: "Attends Get Set", hotspotAttendance: [], churchAttendance: ["2026-02-15"], notes: [{ when: "2026-03-01T09:00:00.000Z", text: "Been quiet for a while, need to schedule a home visit." }] },
    ];

    // 30 church members: 5 hotspot leaders + 5 disciples each.
    const leaderMeta = {
      hot_zawadi: { id: "cm_grace", name: "Grace Wanjiru", address: "Kware, Rongai", mobile: "0700 456 789", note: "Serving in the media department. Leads Hotspot Zawadi faithfully.", disciples: ["Esther Nyambura", "Dennis Kiptoo", "Caroline Atieno", "Joseph Mwangi", "Ruth Chebet"] },
      hot_amani:  { id: "cm_kevin", name: "Kevin Otieno", address: "Nkoroi, Rongai", mobile: "0711 222 333", note: "Serving in the ushering department. Leads Hotspot Amani with consistency.", disciples: ["Daniel Kimani", "Sharon Adhiambo", "Victor Omondi", "Ann Wangari", "Moses Korir"] },
      hot_neema:  { id: "cm_faith", name: "Faith Njeri", address: "Kandisi, Rongai", mobile: "0722 444 555", note: "Serving in the worship team. Leads Hotspot Neema with a strong prayer life.", disciples: ["Beatrice Wafula", "Collins Ochieng", "Purity Njoroge", "Elias Sang", "Winnie Auma"] },
      hot_baraka: { id: "cm_brian", name: "Brian Mutiso", address: "Simba Estate, Rongai", mobile: "0733 666 777", note: "Serving in the media department. Leads Hotspot Baraka, growing in leadership.", disciples: ["Patrick Njuguna", "Lilian Moraa", "Stephen Otieno", "Agnes Wambua", "David Kiplagat"] },
      hot_imani:  { id: "cm_mercy", name: "Mercy Achieng", address: "Rimpa, Rongai", mobile: "0744 888 999", note: "Serving in the children's department. Leads Hotspot Imani, very relational.", disciples: ["Nancy Wairimu", "Felix Odhiambo", "Grace Cherono", "Isaac Mutua", "Diana Nafula"] },
    };

    const slug = (n) => "cm_" + n.toLowerCase().replace(/[^a-z ]/g, "").replace(/ +/g, "_");

    const churchMembers = [];
    Object.entries(leaderMeta).forEach(([hotId, meta]) => {
      const discipleIds = meta.disciples.map(slug);
      churchMembers.push({
        id: meta.id, name: meta.name, address: meta.address, mobile: meta.mobile,
        hotspotId: hotId, isHotspotLeader: true, leaderOrDiscipler: "Pastor Benjamin",
        notes: meta.note, discipleIds,
      });
      meta.disciples.forEach((discName) => {
        churchMembers.push({
          id: slug(discName), name: discName, address: "Rongai", mobile: "07" + Math.floor(10000000 + Math.random() * 89999999),
          hotspotId: hotId, isHotspotLeader: false, leaderOrDiscipler: meta.name,
          notes: "Faithful in attendance, growing steadily in the Word.", discipleIds: [],
        });
      });
    });

    return {
      members,
      hotspots,
      soulRecords,
      churchMembers,
      settings: { noteWarnDays: 3, noteDangerDays: 7, weeklyHotspotTarget: 10, previousSoulsWonByYear: {}, colorPreset: "blue_purple", logoDataUrl: null, archiveReasonCategories: ["Relocated", "Assigned to Another Branch/Pastor", "Lost Contact", "Personal Request", "Other"] },
    };
  },

  // ---------- Members ----------
  addMember(name) {
    const m = { id: uid("mem"), name };
    this.data.members.push(m);
    this.save();
    return m;
  },
  removeMember(id) {
    this._snapshot();
    this.data.members = this.data.members.filter((m) => m.id !== id);
    this._queueDelete("members", id);
    this.save();
  },
  updateMember(id, name) {
    const m = this.data.members.find((x) => x.id === id);
    if (!m) return null;
    this._snapshot();
    m.name = name;
    this.save();
    return m;
  },
  memberName(id) {
    const m = this.data.members.find((x) => x.id === id);
    return m ? m.name : "—";
  },
  churchMemberName(id) {
    const c = this.data.churchMembers.find((x) => x.id === id);
    return c ? c.name : "—";
  },

  // ---------- Hotspots ----------
  addHotspot(name, leaderId, capacity) {
    const h = { id: uid("hot"), name, leaderId, capacity: capacity || 10 };
    this.data.hotspots.push(h);
    this.save();
    return h;
  },
  removeHotspot(id) {
    this._snapshot();
    this.data.hotspots = this.data.hotspots.filter((h) => h.id !== id);
    this._queueDelete("hotspots", id);
    this.save();
  },
  updateHotspot(id, patch) {
    const h = this.data.hotspots.find((x) => x.id === id);
    if (!h) return null;
    this._snapshot();
    Object.assign(h, patch);
    this.save();
    return h;
  },
  hotspotName(id) {
    const h = this.data.hotspots.find((x) => x.id === id);
    return h ? h.name : "Unassigned";
  },
  // Which hotspot a member leads, if any — used in Report 4 to attribute a
  // soul to a hotspot by whoever won them, rather than the soul's own
  // hotspot assignment.
  hotspotIdForMember(memberId) {
    const h = this.data.hotspots.find((x) => x.leaderId === memberId);
    return h ? h.id : null;
  },

  // "Won By" now draws from Church Members (a much longer list than the
  // Hotspot Leaders roster), plus the "Sunday Guest" sentinel. Falls back to
  // the old Hotspot-Leader-based lookup for records saved before this
  // change, so nothing already recorded breaks or needs migrating.
  wonByName(id) {
    if (!id) return "—";
    if (id === SUNDAY_GUEST_ID) return "Sunday Guest";
    const cm = this.data.churchMembers.find((c) => c.id === id);
    if (cm) return cm.name;
    return this.memberName(id); // legacy: recorded before Won By pulled from Church Members
  },

  // Which hotspot a soul's winner belongs to, for Report 4's attribution.
  // Sunday Guests return null (excluded from that report on purpose — see
  // SUNDAY_GUEST_ID above).
  hotspotIdForWonBy(id) {
    if (!id || id === SUNDAY_GUEST_ID) return null;
    const cm = this.data.churchMembers.find((c) => c.id === id);
    if (cm) return cm.hotspotId || null;
    return this.hotspotIdForMember(id); // legacy fallback
  },

  hotspotLeaderName(id) {
    const h = this.data.hotspots.find((x) => x.id === id);
    if (!h) return "—";
    return this.memberName(h.leaderId);
  },
  hotspotOccupancy(id) {
    return this.data.churchMembers.filter((c) => c.hotspotId === id).length;
  },

  // ---------- Soul Records ----------
  addSoulRecord(record) {
    record.id = uid("soul");
    record.hotspotAttendance = record.hotspotAttendance || [];
    record.churchAttendance = record.churchAttendance || [];
    record.notes = record.notes || [];
    this.data.soulRecords.push(record);
    this.save();
    return record;
  },

  updateSoulRecord(id, patch) {
    const rec = this.data.soulRecords.find((r) => r.id === id);
    if (!rec) return null;
    this._snapshot();
    const previousStage = rec.plugInStage;
    Object.assign(rec, patch);
    this.save();
    if (previousStage !== "Service Team" && rec.plugInStage === "Service Team") {
      this.promoteToChurchMember(rec);
    }
    return rec;
  },

  removeSoulRecord(id) {
    this._snapshot();
    this.data.soulRecords = this.data.soulRecords.filter((r) => r.id !== id);
    this._queueDelete("soul_records", id);
    this.save();
  },

  addAttendance(soulId, field, date) {
    const rec = this.data.soulRecords.find((r) => r.id === soulId);
    if (!rec) return;
    if (!rec[field].includes(date)) rec[field].push(date);
    this.save();
  },

  removeAttendance(soulId, field, date) {
    const rec = this.data.soulRecords.find((r) => r.id === soulId);
    if (!rec) return;
    rec[field] = rec[field].filter((d) => d !== date);
    this.save();
  },

  addNote(soulId, text) {
    const rec = this.data.soulRecords.find((r) => r.id === soulId);
    if (!rec) return;
    rec.notes.push({ when: new Date().toISOString(), text });
    this.save();
  },

  removeNote(soulId, index) {
    const rec = this.data.soulRecords.find((r) => r.id === soulId);
    if (!rec || !rec.notes[index]) return;
    this._snapshot();
    rec.notes.splice(index, 1);
    this.save();
  },

  // ---------- Promotion: Soul -> Church Member ----------
  // NOTE: the soul_record is kept (not deleted) so it remains part of the
  // permanent "souls won" history used by the Dashboard tab's reports.
  // Views scoped to active follow-up (Follow-Up Radar) simply filter out
  // Service Team stage instead of relying on the record being gone.
  promoteToChurchMember(rec) {
    const exists = this.data.churchMembers.find((cm) => cm.name === rec.name && cm.mobile === rec.mobile);
    if (exists) return exists;
    const cm = {
      id: uid("cm"),
      name: rec.name,
      address: "",
      mobile: rec.mobile,
      hotspotId: rec.hotspotId,
      isHotspotLeader: false,
      leaderOrDiscipler: this.hotspotLeaderName(rec.hotspotId),
      notes: rec.notes.length ? rec.notes[rec.notes.length - 1].text : "",
      discipleIds: [],
    };
    this.data.churchMembers.push(cm);
    this.save();
    return cm;
  },

  // ---------- Church Members ----------
  addChurchMember(data) {
    const cm = {
      id: uid("cm"),
      name: data.name,
      address: data.address || "",
      mobile: data.mobile || "",
      hotspotId: data.hotspotId || null,
      isHotspotLeader: !!data.isHotspotLeader,
      leaderOrDiscipler: data.leaderOrDiscipler || "",
      notes: data.notes || "",
      discipleIds: [],
    };
    this.data.churchMembers.push(cm);
    this.save();
    return cm;
  },

  updateChurchMember(id, patch) {
    const cm = this.data.churchMembers.find((c) => c.id === id);
    if (!cm) return null;
    this._snapshot();
    Object.assign(cm, patch);
    this.save();
    return cm;
  },

  removeChurchMember(id) {
    this._snapshot();
    this.data.churchMembers = this.data.churchMembers.filter((c) => c.id !== id);
    this._queueDelete("church_members", id);
    this.save();
  },

  // ---------- Archive ----------
  // Archiving removes someone from the active Follow-Up Radar / Church
  // Member Report without deleting anything — every field, note, and
  // attendance record is kept exactly as-is. Common reasons: relocated,
  // handed off to another branch/pastor, lost contact, etc.
  archiveSoul(id, category, reasonText) {
    const rec = this.data.soulRecords.find((r) => r.id === id);
    if (!rec) return;
    this._snapshot();
    rec.archived = true;
    rec.archiveReasonCategory = category || "";
    rec.archiveReasonText = reasonText || "";
    rec.archivedAt = todayISO();
    this.save();
  },
  unarchiveSoul(id) {
    const rec = this.data.soulRecords.find((r) => r.id === id);
    if (!rec) return;
    this._snapshot();
    rec.archived = false;
    this.save();
  },
  archiveChurchMember(id, category, reasonText) {
    const cm = this.data.churchMembers.find((c) => c.id === id);
    if (!cm) return;
    this._snapshot();
    cm.archived = true;
    cm.archiveReasonCategory = category || "";
    cm.archiveReasonText = reasonText || "";
    cm.archivedAt = todayISO();
    this.save();
  },
  unarchiveChurchMember(id) {
    const cm = this.data.churchMembers.find((c) => c.id === id);
    if (!cm) return;
    this._snapshot();
    cm.archived = false;
    this.save();
  },

  addArchiveReasonCategory(name) {
    const n = (name || "").trim();
    if (!n) return;
    if (!this.data.settings.archiveReasonCategories.includes(n)) {
      this.data.settings.archiveReasonCategories.push(n);
      this.save();
    }
  },
  removeArchiveReasonCategory(name) {
    this.data.settings.archiveReasonCategories = this.data.settings.archiveReasonCategories.filter((c) => c !== name);
    this.save();
  },

  // Last Physical Engagement: the more recent of church/hotspot attendance,
  // labelled with which one it was. Used on the Archive tab.
  lastPhysicalEngagement(rec) {
    const lastChurch = mostRecent(rec.churchAttendance);
    const lastHotspot = mostRecent(rec.hotspotAttendance);
    if (!lastChurch && !lastHotspot) return { date: null, type: null, label: "Never attended" };
    let date, type;
    if (lastChurch && (!lastHotspot || lastChurch >= lastHotspot)) {
      date = lastChurch; type = "Sunday Church";
    } else {
      date = lastHotspot; type = "Hotspot";
    }
    return { date, type, label: `${formatNiceDate(date)} - ${type}` };
  },

  // Overwrite the full set of disciples for a church member, chosen from
  // the Church Member Report itself (not free text) via a checklist modal.
  setDisciples(cmId, discipleIds) {
    const cm = this.data.churchMembers.find((c) => c.id === cmId);
    if (!cm) return;
    this._snapshot();
    cm.discipleIds = discipleIds.filter((id) => id !== cmId); // can't disciple yourself
    this.save();
  },

  // Compute the day-gap fields shared by every report: days since last
  // church attendance, hotspot attendance, and logged note.
  _computeGaps(rec) {
    const lastChurch = mostRecent(rec.churchAttendance);
    const lastHotspot = mostRecent(rec.hotspotAttendance);
    const lastNoteDate = rec.notes.length ? mostRecent(rec.notes.map((n) => n.when.slice(0, 10))) : null;
    return {
      rec,
      daysChurch: daysBetween(lastChurch),
      daysHotspot: daysBetween(lastHotspot),
      daysSinceNote: daysBetween(lastNoteDate),
    };
  },

  // ---------- Follow-Up Radar data ----------

  // Every soul not yet on the Service Team, with computed day-gaps.
  // Used as the shared base for all three Follow-Up Radar reports.
  _radarBase() {
    return this.data.soulRecords
      .filter((r) => r.plugInStage !== "Service Team" && !r.archived)
      .map((r) => this._computeGaps(r));
  },

  // (a) Anyone whose last logged note is `noteWarnDays`+ old, or who has
  // never had a note logged at all — sorted longest-quiet first.
  notContactedRows() {
    const warnDays = this.data.settings.noteWarnDays;
    return this._radarBase()
      .filter(({ daysSinceNote }) => daysSinceNote === null || daysSinceNote >= warnDays)
      .sort((a, b) => (b.daysSinceNote ?? 99999) - (a.daysSinceNote ?? 99999));
  },

  // (b) Simple attendance counts + the underlying rows, for the
  // click-to-expand "how many souls have attended X" cards.
  attendanceCounts() {
    const rows = this._radarBase();
    return {
      hotspot: rows.filter((r) => r.rec.hotspotAttendance.length > 0),
      church: rows.filter((r) => r.rec.churchAttendance.length > 0),
    };
  },

  // (c) Every soul won, most recent outreach date first, with the same
  // day-gap fields as the rest of the radar.
  soulsByDateWon() {
    return this._radarBase().sort((a, b) => (b.rec.dateOfOutreach || "").localeCompare(a.rec.dateOfOutreach || ""));
  },

  // (d) Anyone still active in follow-up with no hotspot assigned yet.
  // Hotspots are assigned based on where someone stays, so this is also
  // the "we still need to find out where they live" list.
  soulsNeedingHotspot() {
    return this._radarBase().filter(({ rec }) => !rec.hotspotId);
  },

  // ---------- Dashboard (custom reports) data ----------

  monthLabel(key) {
    const [y, m] = key.split("-");
    const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1, 12)); // noon UTC avoids date-boundary shifts across zones
    try {
      return new Intl.DateTimeFormat("en-US", { timeZone: getAppTimezone(), month: "short", year: "numeric" }).format(d);
    } catch (e) {
      return d.toLocaleString("en-US", { month: "short", year: "numeric" });
    }
  },

  availableYears() {
    const years = new Set(this.data.soulRecords.map((r) => (r.dateOfOutreach || "").slice(0, 4)).filter(Boolean));
    return Array.from(years).sort();
  },

  // 1. Souls won over time — every soul ever won, regardless of current
  // Plug-In stage, grouped by month or year of outreach date, split into:
  //   - "New Souls Won": Status of Winning = New Soul or Rededicated Their Life
  //     (a real decision moment — someone who gave/gave back their life to Christ)
  //   - "Already Born Again": already saved but without a church home, so we
  //     count them as reached, but separately from those who made a decision
  // Total People Reached = the two added together.
  // Grand total, for campuses adopting this tracker mid-year with souls
  // already won before they started using it. "Previously Recorded Souls
  // Won" is tracked per-year (set in Members & Settings) and added on top
  // of everything actually logged in the system for that specific year —
  // it deliberately does NOT bleed into other years or into month-on-month
  // breakdowns, since there's no month attached to a carried-over total.
  totalSoulsWonAllTime() {
    const byYear = this.data.settings.previousSoulsWonByYear || {};
    const previous = Object.values(byYear).reduce((sum, v) => sum + (Number(v) || 0), 0);
    return {
      previous,
      recorded: this.data.soulRecords.length,
      total: previous + this.data.soulRecords.length,
      byYear,
    };
  },

  addOrUpdatePreviousSoulsWon(year, count) {
    const y = String(year).trim();
    if (!y) return;
    this._snapshot();
    this.data.settings.previousSoulsWonByYear[y] = Math.max(0, Number(count) || 0);
    this.save();
  },

  removePreviousSoulsWonYear(year) {
    this._snapshot();
    delete this.data.settings.previousSoulsWonByYear[String(year)];
    this.save();
  },

  soulsWonSeries(granularity) {
    const buckets = {};
    this.data.soulRecords.forEach((r) => {
      if (!r.dateOfOutreach) return;
      const key = granularity === "year" ? r.dateOfOutreach.slice(0, 4) : r.dateOfOutreach.slice(0, 7);
      if (!buckets[key]) buckets[key] = { newSoulIds: [], abaIds: [] };
      if (r.status === "Already Born Again") buckets[key].abaIds.push(r.id);
      else buckets[key].newSoulIds.push(r.id); // New Soul + Rededicated Their Life
    });

    // Year-on-year only: fold in any carried-over total for that specific
    // year, so a year with no in-system records (e.g. before adoption)
    // still shows up. This never applies to month-on-month, since a
    // carried-over total has no month attached to it.
    const byYear = granularity === "year" ? (this.data.settings.previousSoulsWonByYear || {}) : {};
    Object.keys(byYear).forEach((y) => {
      if (!buckets[y]) buckets[y] = { newSoulIds: [], abaIds: [] };
    });

    return Object.keys(buckets).sort().map((key) => {
      const b = buckets[key];
      const carriedOver = Number(byYear[key]) || 0;
      return {
        key,
        label: granularity === "year" ? key : this.monthLabel(key),
        newSouls: b.newSoulIds.length,
        newSoulIds: b.newSoulIds,
        aba: b.abaIds.length,
        abaIds: b.abaIds,
        carriedOver,
        total: b.newSoulIds.length + b.abaIds.length + carriedOver,
        totalIds: [...b.newSoulIds, ...b.abaIds], // carried-over souls have no individual records to drill into
      };
    });
  },

  // 4. Souls won by hotspot, per week (Monday–Sunday). Attribution is by
  // the hotspot the soul was assigned to at the time they were won.
  weekRangeFor(dateStr) {
    const d = new Date((dateStr || todayISO()) + "T00:00:00Z");
    const dow = d.getUTCDay(); // 0 Sun .. 6 Sat
    const diffToMonday = (dow + 6) % 7;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - diffToMonday);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const iso = (dt) => dt.toISOString().slice(0, 10);
    return { mondayISO: iso(monday), sundayISO: iso(sunday) };
  },

  hotspotWeeklyCounts(dateStr) {
    const { mondayISO, sundayISO } = this.weekRangeFor(dateStr);
    const buckets = {};
    this.data.hotspots.forEach((h) => { buckets[h.id] = []; });
    this.data.soulRecords.forEach((r) => {
      if (!r.dateOfOutreach) return;
      if (r.dateOfOutreach < mondayISO || r.dateOfOutreach > sundayISO) return;
      // Attribution is by the hotspot of whoever WON the soul (i.e. the
      // hotspot they lead), not the hotspot the new convert was assigned to.
      const hid = this.hotspotIdForWonBy(r.wonById);
      if (!hid) return;
      (buckets[hid] = buckets[hid] || []).push(r.id);
    });
    const points = this.data.hotspots.map((h) => ({
      key: h.id,
      label: h.name,
      value: (buckets[h.id] || []).length,
      soulIds: buckets[h.id] || [],
    }));
    return { mondayISO, sundayISO, points, target: this.data.settings.weeklyHotspotTarget };
  },

  // 2. Top person winning souls — count of soul records by Won By,
  // optionally filtered to a specific year and/or month.
  topSoulWinners({ year, month } = {}) {
    const buckets = {};
    this.data.soulRecords.forEach((r) => {
      if (!r.dateOfOutreach) return;
      if (year && r.dateOfOutreach.slice(0, 4) !== String(year)) return;
      if (month && r.dateOfOutreach.slice(5, 7) !== String(month).padStart(2, "0")) return;
      const id = r.wonById || "unknown";
      (buckets[id] = buckets[id] || []).push(r.id);
    });
    return Object.entries(buckets)
      .map(([id, ids]) => ({ key: id, label: this.wonByName(id), value: ids.length, soulIds: ids }))
      .sort((a, b) => b.value - a.value);
  },

  // 3. Souls won by Follow-Up person — how many people each Hotspot
  // Leader currently has to follow up with (excludes Service Team, since
  // those souls no longer need active follow-up).
  followUpLoad() {
    const buckets = {};
    this.data.soulRecords
      .filter((r) => r.plugInStage !== "Service Team")
      .forEach((r) => {
        const id = r.followUpId || "unknown";
        (buckets[id] = buckets[id] || []).push(r.id);
      });
    return Object.entries(buckets)
      .map(([id, ids]) => ({ key: id, label: this.memberName(id), value: ids.length, soulIds: ids }))
      .sort((a, b) => b.value - a.value);
  },

  // Custom report builder: group all soul records by an arbitrary
  // dimension, with optional year/month filtering.
  customReport({ groupBy, year, month }) {
    let records = this.data.soulRecords.slice();
    if (year) records = records.filter((r) => (r.dateOfOutreach || "").slice(0, 4) === String(year));
    if (month) records = records.filter((r) => (r.dateOfOutreach || "").slice(5, 7) === String(month).padStart(2, "0"));

    const buckets = {};
    records.forEach((r) => {
      let key, label;
      switch (groupBy) {
        case "year": key = (r.dateOfOutreach || "").slice(0, 4) || "unknown"; label = key === "unknown" ? "Unknown" : key; break;
        case "hotspot": key = r.hotspotId || "none"; label = this.hotspotName(r.hotspotId); break;
        case "plugInStage": key = r.plugInStage; label = r.plugInStage; break;
        case "status": key = r.status; label = r.status; break;
        case "wonBy": key = r.wonById || "none"; label = this.wonByName(r.wonById); break;
        case "followUp": key = r.followUpId || "none"; label = this.memberName(r.followUpId); break;
        case "month":
        default: key = (r.dateOfOutreach || "").slice(0, 7) || "unknown"; label = key === "unknown" ? "Unknown" : this.monthLabel(key); break;
      }
      if (!buckets[key]) buckets[key] = { label, ids: [] };
      buckets[key].ids.push(r.id);
    });

    const arr = Object.entries(buckets).map(([key, b]) => ({ key, label: b.label, value: b.ids.length, soulIds: b.ids }));
    if (groupBy === "month" || groupBy === "year") arr.sort((a, b) => a.key.localeCompare(b.key));
    else arr.sort((a, b) => b.value - a.value);
    return arr;
  },

  // Drill-down: the actual people behind a bucket of soul IDs, for the
  // floating card shown when a chart marker/bar is clicked.
  soulDetailRows(ids) {
    return ids.map((id) => {
      const rec = this.data.soulRecords.find((r) => r.id === id);
      if (!rec) return null;
      const g = this._computeGaps(rec);
      return {
        name: rec.name,
        daysSinceNote: g.daysSinceNote,
        followUp: this.memberName(rec.followUpId),
        mobile: rec.mobile,
        lastNote: rec.notes.length ? rec.notes[rec.notes.length - 1].text : "",
        dateOfOutreach: rec.dateOfOutreach,
        plugInStage: rec.plugInStage,
      };
    }).filter(Boolean);
  },

  // ---------- Archive tab reports ----------

  archivedSoulsSeries(granularity) {
    const buckets = {};
    this.data.soulRecords.filter((r) => r.archived && r.archivedAt).forEach((r) => {
      const key = granularity === "year" ? r.archivedAt.slice(0, 4) : r.archivedAt.slice(0, 7);
      (buckets[key] = buckets[key] || []).push(r.id);
    });
    return Object.keys(buckets).sort().map((key) => ({
      key,
      label: granularity === "year" ? key : this.monthLabel(key),
      value: buckets[key].length,
      soulIds: buckets[key],
    }));
  },

  archivedMembersSeries(granularity) {
    const buckets = {};
    this.data.churchMembers.filter((c) => c.archived && c.archivedAt).forEach((c) => {
      const key = granularity === "year" ? c.archivedAt.slice(0, 4) : c.archivedAt.slice(0, 7);
      (buckets[key] = buckets[key] || []).push(c.id);
    });
    return Object.keys(buckets).sort().map((key) => ({
      key,
      label: granularity === "year" ? key : this.monthLabel(key),
      value: buckets[key].length,
      soulIds: buckets[key], // kept as "soulIds" for consistency with the shared chart/drilldown plumbing
    }));
  },

  archivedSoulDetailRows(ids) {
    return ids.map((id) => {
      const rec = this.data.soulRecords.find((r) => r.id === id);
      if (!rec) return null;
      return { name: rec.name, category: rec.archiveReasonCategory || "—", reasonText: rec.archiveReasonText || "" };
    }).filter(Boolean);
  },

  archivedMemberDetailRows(ids) {
    return ids.map((id) => {
      const cm = this.data.churchMembers.find((c) => c.id === id);
      if (!cm) return null;
      return { name: cm.name, category: cm.archiveReasonCategory || "—", reasonText: cm.archiveReasonText || "" };
    }).filter(Boolean);
  },

  archivedSouls() {
    return this.data.soulRecords.filter((r) => r.archived);
  },

  archivedChurchMembers() {
    return this.data.churchMembers.filter((c) => c.archived);
  },

  // ---------- Backup ----------
  exportJSON() {
    return JSON.stringify(this.data, null, 2);
  },

  async importJSON(json) {
    const parsed = JSON.parse(json);
    if (this.data) this._snapshot();
    this.data = parsed;
    this._migrate();
    await this._fullReplaceSave();
  },

  async resetAll() {
    if (this.data) this._snapshot();
    this.data = this._seed();
    await this._fullReplaceSave();
  },
};

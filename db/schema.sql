-- ============================================================
-- TGC Rongai Campus Tracker — Database Schema (SQLite)
-- Maps 1:1 to the fields described in the technical document.
-- ============================================================

PRAGMA foreign_keys = ON;

-- Current members: the campus roster. Feeds every "who did this"
-- dropdown in the app (won by, follow-up member, hotspot leader...).
CREATE TABLE IF NOT EXISTS members (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL
);

-- Hotspots: the "family" a soul is plugged into, each with a leader.
CREATE TABLE IF NOT EXISTS hotspots (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  leader_id TEXT REFERENCES members(id) ON DELETE SET NULL,
  capacity  INTEGER NOT NULL DEFAULT 10   -- hard ceiling per hotspot; campus target is 6
);

-- One row per soul won. This is the primary soul-winning record.
CREATE TABLE IF NOT EXISTS soul_records (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  won_by_id        TEXT REFERENCES members(id) ON DELETE SET NULL,
  date_of_outreach TEXT,                  -- ISO date (YYYY-MM-DD)
  mobile           TEXT,
  status           TEXT NOT NULL DEFAULT 'New Soul'
                     CHECK (status IN ('Already Born Again','Rededicated Their Life','New Soul')),
  context          TEXT,                  -- something memorable about them
  follow_up_id     TEXT REFERENCES members(id) ON DELETE SET NULL,
  hotspot_id       TEXT REFERENCES hotspots(id) ON DELETE SET NULL,
  plug_in_stage    TEXT NOT NULL DEFAULT 'Guest'
                     CHECK (plug_in_stage IN ('Guest','Attends Hotspot','Attends Get Set','Service Team')),
  -- Archive: removes someone from the active Follow-Up Radar without
  -- deleting anything. archived_at drives the Archive tab's time-series reports.
  archived                 INTEGER NOT NULL DEFAULT 0,
  archive_reason_category  TEXT DEFAULT '',
  archive_reason_text      TEXT DEFAULT '',
  archived_at              TEXT
);

-- Custom checklist of dates a soul attended their hotspot.
CREATE TABLE IF NOT EXISTS soul_hotspot_attendance (
  soul_id TEXT NOT NULL REFERENCES soul_records(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,                  -- ISO date
  PRIMARY KEY (soul_id, date)
);

-- Custom checklist of dates a soul attended church.
CREATE TABLE IF NOT EXISTS soul_church_attendance (
  soul_id TEXT NOT NULL REFERENCES soul_records(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,                  -- ISO date
  PRIMARY KEY (soul_id, date)
);

-- Append-only follow-up notes log per soul (Dashboard "Notes" field).
CREATE TABLE IF NOT EXISTS soul_notes (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  soul_id  TEXT NOT NULL REFERENCES soul_records(id) ON DELETE CASCADE,
  when_ts  TEXT NOT NULL,                 -- ISO datetime
  text     TEXT NOT NULL
);

-- Church Member Report: populated automatically the moment a
-- soul_record's plug_in_stage becomes 'Service Team'.
CREATE TABLE IF NOT EXISTS church_members (
  id                   TEXT PRIMARY KEY,
  name                 TEXT NOT NULL,
  address              TEXT,
  mobile               TEXT,
  hotspot_id           TEXT REFERENCES hotspots(id) ON DELETE SET NULL,
  is_hotspot_leader    INTEGER NOT NULL DEFAULT 0,   -- 0/1
  leader_or_discipler  TEXT,             -- "Hotspot Leader" name, or "Discipler" name if is_hotspot_leader=1
  notes                TEXT,
  archived                 INTEGER NOT NULL DEFAULT 0,
  archive_reason_category  TEXT DEFAULT '',
  archive_reason_text      TEXT DEFAULT '',
  archived_at              TEXT
);

-- Disciples checklist: the people in a hotspot leader's hotspot.
-- Disciples: who a hotspot leader is discipling, picked from the Church
-- Member Report itself (not free text) — a simple many-to-many link.
CREATE TABLE IF NOT EXISTS church_member_disciples (
  church_member_id  TEXT NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  disciple_id       TEXT NOT NULL REFERENCES church_members(id) ON DELETE CASCADE,
  PRIMARY KEY (church_member_id, disciple_id)
);

-- Follow-Up Radar thresholds: days since the last note was logged.
CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_soul_stage    ON soul_records(plug_in_stage);
CREATE INDEX IF NOT EXISTS idx_soul_hotspot  ON soul_records(hotspot_id);
CREATE INDEX IF NOT EXISTS idx_cm_hotspot    ON church_members(hotspot_id);

-- ============================================================
-- TGC Rongai Campus Tracker — Supabase (Postgres) schema
-- Run this once in your Supabase project: Project → SQL Editor →
-- New query → paste this whole file → Run.
--
-- This mirrors db/schema.sql (the local SQLite schema) but uses
-- native JSONB columns for the nested lists (attendance dates,
-- notes, disciple IDs) instead of separate child tables — simpler
-- to sync over REST, and idiomatic for Postgres.
-- ============================================================

create table if not exists members (
  id   text primary key,
  name text not null
);

create table if not exists hotspots (
  id        text primary key,
  name      text not null,
  leader_id text references members(id) on delete set null,
  capacity  integer not null default 10
);

create table if not exists soul_records (
  id                  text primary key,
  name                text not null,
  won_by_id           text references members(id) on delete set null,
  date_of_outreach    text,
  mobile              text,
  status              text not null default 'New Soul',
  context             text,
  follow_up_id        text references members(id) on delete set null,
  hotspot_id          text references hotspots(id) on delete set null,
  plug_in_stage       text not null default 'Guest',
  hotspot_attendance  jsonb not null default '[]'::jsonb,  -- array of "YYYY-MM-DD" strings
  church_attendance   jsonb not null default '[]'::jsonb,  -- array of "YYYY-MM-DD" strings
  notes               jsonb not null default '[]'::jsonb,  -- array of {when, text}
  archived                 boolean not null default false,
  archive_reason_category  text default '',
  archive_reason_text      text default '',
  archived_at              text
);

create table if not exists church_members (
  id                   text primary key,
  name                 text not null,
  address              text default '',
  mobile               text default '',
  hotspot_id           text references hotspots(id) on delete set null,
  is_hotspot_leader    boolean not null default false,
  leader_or_discipler  text default '',
  notes                text default '',
  disciple_ids         jsonb not null default '[]'::jsonb,  -- array of church_members.id
  archived                 boolean not null default false,
  archive_reason_category  text default '',
  archive_reason_text      text default '',
  archived_at              text
);

-- Single-row settings blob (key = 'app_settings') — simpler to sync as one
-- JSON document than one row per setting.
create table if not exists settings (
  key   text primary key,
  value jsonb not null default '{}'::jsonb
);

-- ============================================================
-- Row Level Security
--
-- IMPORTANT — read before running:
-- This app authenticates with the public "anon" key, not real user
-- logins. The policies below grant that anon key FULL read AND write
-- access to every row in every table below. Once this key is embedded
-- in the client-side app (as it must be, to work at all), anyone who
-- has your Supabase project URL + this key can read and modify all
-- of this data — including names and mobile numbers of new converts.
--
-- This is the simplest setup and matches "make it work across devices
-- with no login," but it is NOT the same as private/secured data. If
-- you want real access control, replace these policies with ones that
-- check `auth.uid()` after setting up Supabase Auth (email/password or
-- magic link) for your team, and only grant access to authenticated users.
-- ============================================================

alter table members enable row level security;
alter table hotspots enable row level security;
alter table soul_records enable row level security;
alter table church_members enable row level security;
alter table settings enable row level security;

create policy "anon full access" on members for all using (true) with check (true);
create policy "anon full access" on hotspots for all using (true) with check (true);
create policy "anon full access" on soul_records for all using (true) with check (true);
create policy "anon full access" on church_members for all using (true) with check (true);
create policy "anon full access" on settings for all using (true) with check (true);

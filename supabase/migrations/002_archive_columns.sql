-- ============================================================
-- Migration: Archive feature
-- Run this in your Supabase project: Project → SQL Editor → New
-- query → paste this whole file → Run.
--
-- This is a MIGRATION for a project that already ran the original
-- supabase/schema.sql — it only adds the new archive columns via
-- ALTER TABLE, so it's safe to run even with existing data. (A brand
-- new project can just run the updated supabase/schema.sql instead,
-- which already includes these columns.)
-- ============================================================

alter table soul_records
  add column if not exists archived                 boolean not null default false,
  add column if not exists archive_reason_category   text default '',
  add column if not exists archive_reason_text       text default '',
  add column if not exists archived_at               text;

alter table church_members
  add column if not exists archived                 boolean not null default false,
  add column if not exists archive_reason_category   text default '',
  add column if not exists archive_reason_text       text default '',
  add column if not exists archived_at               text;

-- ============================================================
-- Migration: Users (login / roles)
-- Run this in your Supabase project: Project → SQL Editor → New
-- query → paste this whole file → Run.
--
-- Safe to run on a project that already has data — this only adds a
-- new `users` table, nothing existing is touched.
-- ============================================================

create table if not exists users (
  id            text primary key,
  user_type     text not null check (user_type in ('Super Admin','Branch Admin','Hotspot Leader')),
  name          text not null,
  password_hash text not null,
  created_at    text not null
);

alter table users enable row level security;

create policy "anon full access" on users for all using (true) with check (true);

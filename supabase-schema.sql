-- ─────────────────────────────────────────────────────────────────
-- JobHunter AI — Supabase schema
-- Run this once in: Supabase dashboard → SQL Editor → New query
-- ─────────────────────────────────────────────────────────────────

-- Key-value store. All app data (profiles, jobs, applications) lives here.
create table if not exists kv_store (
  id         uuid        default gen_random_uuid() primary key,
  user_id    text        not null,
  key        text        not null,
  value      jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, key)
);

create index if not exists kv_store_user_key on kv_store (user_id, key);
alter table kv_store disable row level security;

-- ─────────────────────────────────────────────────────────────────
-- Background job queue
-- Tracks status of async AI tasks (ATS scan, Find Jobs)
-- status: pending → processing → done | error
-- ─────────────────────────────────────────────────────────────────

create table if not exists bg_jobs (
  id         text        primary key,  -- client-generated jobId
  user_id    text        not null,
  type       text        not null,     -- 'ats_scan' | 'find_jobs'
  status     text        not null default 'pending',
  result     jsonb,
  error      text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists bg_jobs_user_id on bg_jobs (user_id);
create index if not exists bg_jobs_status  on bg_jobs (status);
alter table bg_jobs disable row level security;

-- ─────────────────────────────────────────────────────────────────
-- User roles table
-- ─────────────────────────────────────────────────────────────────

create table if not exists user_roles (
  id         uuid        default gen_random_uuid() primary key,
  user_id    text        not null unique,
  email      text        not null,
  role       text        not null default 'user' check (role in ('admin', 'user')),
  disabled   boolean     not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists user_roles_user_id on user_roles (user_id);
create index if not exists user_roles_role    on user_roles (role);
alter table user_roles disable row level security;

-- ─────────────────────────────────────────────────────────────────
-- To make yourself admin, run this after your first login:
--
-- UPDATE user_roles SET role = 'admin' WHERE email = 'your@email.com';
-- ─────────────────────────────────────────────────────────────────

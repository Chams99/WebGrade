create table if not exists audit_runs (
  id text primary key,
  owner_id text,
  target_url text not null,
  created_at timestamptz not null default now(),
  status text not null check (status in ('queued', 'running', 'completed', 'failed', 'expired', 'cancelled')),
  public_provider_consent boolean not null default false,
  report_json jsonb,
  expires_at timestamptz not null default now() + interval '90 days',
  read_capability_hash text
);

create index if not exists audit_runs_owner_created on audit_runs (owner_id, created_at desc);
alter table audit_runs add column if not exists read_capability_hash text;
alter table audit_runs add column if not exists cloudflare_consent boolean not null default false;
alter table audit_runs add column if not exists observatory_consent boolean not null default false;
alter table audit_runs drop constraint if exists audit_runs_status_check;
alter table audit_runs add constraint audit_runs_status_check check (status in ('queued', 'running', 'completed', 'failed', 'expired', 'cancelled'));

create table if not exists audit_results (
  id bigserial primary key,
  run_id text not null references audit_runs(id) on delete cascade,
  strategy text not null check (strategy in ('mobile', 'desktop')),
  provider text not null,
  status text not null,
  payload jsonb not null,
  engine_version text,
  created_at timestamptz not null default now(),
  unique (run_id, strategy, provider)
);

create table if not exists jobs (
  id bigserial primary key,
  run_id text references audit_runs(id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued' check (status in ('queued', 'running', 'completed', 'failed')),
  attempts integer not null default 0,
  available_at timestamptz not null default now(),
  lease_until timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists jobs_claimable on jobs (status, available_at);
create unique index if not exists jobs_schedule_once on jobs ((payload ->> 'scheduleId'), kind, available_at) where kind = 'scheduled-run';

create table if not exists schedules (
  id bigserial primary key,
  owner_id text not null,
  project_name text not null,
  targets jsonb not null,
  cadence text not null check (cadence in ('daily', 'weekly')),
  next_due_at timestamptz not null,
  enabled boolean not null default true,
  public_provider_consent boolean not null default false,
  created_at timestamptz not null default now()
);
alter table schedules add column if not exists cloudflare_consent boolean not null default false;
alter table schedules add column if not exists observatory_consent boolean not null default false;

create table if not exists share_links (
  id bigserial primary key,
  run_id text not null references audit_runs(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  report_json jsonb not null,
  created_at timestamptz not null default now()
);
alter table share_links add column if not exists report_json jsonb;

create table if not exists alerts (
  id bigserial primary key,
  owner_id text not null,
  run_id text references audit_runs(id) on delete set null,
  kind text not null,
  message text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

-- Better Auth's Drizzle adapter uses these four tables. They are kept in the
-- same migration so a fresh VPS can boot authentication and WebGrade data
-- together without a second, undocumented schema step.
create table if not exists "user" (
  id text primary key,
  name text not null,
  email text not null unique,
  email_verified boolean not null default false,
  image text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists session (
  id text primary key,
  expires_at timestamptz not null,
  token text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  user_id text not null references "user"(id) on delete cascade
);

create index if not exists session_user_id_idx on session (user_id);

create table if not exists account (
  id text primary key,
  account_id text not null,
  provider_id text not null,
  user_id text not null references "user"(id) on delete cascade,
  access_token text,
  refresh_token text,
  id_token text,
  access_token_expires_at timestamptz,
  refresh_token_expires_at timestamptz,
  scope text,
  password text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, account_id)
);

create index if not exists account_user_id_idx on account (user_id);

create table if not exists verification (
  id text primary key,
  identifier text not null,
  value text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists verification_identifier_idx on verification (identifier);

create table if not exists provider_usage (
  provider text not null,
  usage_day date not null default current_date,
  used integer not null default 0,
  primary key (provider, usage_day)
);

create table if not exists worker_heartbeats (
  worker_id text primary key,
  last_seen_at timestamptz not null,
  status text not null default 'running'
);

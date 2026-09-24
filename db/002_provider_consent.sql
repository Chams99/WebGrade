-- Keep the original flag for immutable v1 reports, while future runs retain
-- independent consent for each public provider.
alter table audit_runs add column if not exists cloudflare_consent boolean not null default false;
alter table audit_runs add column if not exists observatory_consent boolean not null default false;
alter table schedules add column if not exists cloudflare_consent boolean not null default false;
alter table schedules add column if not exists observatory_consent boolean not null default false;

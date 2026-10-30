-- Apply explicitly in the review environment. No automatic schema changes.
create table if not exists hms_reminder_settings (
 organization uuid primary key, config jsonb not null, contacts jsonb not null default '[]',
 updated_at timestamptz not null default now()
);
create table if not exists hms_reminder_jobs (
 id bigserial primary key, organization uuid not null, game_id uuid not null,
 recipient text not null, kind text not null default 'match-reminder', mode text not null check(mode='test'),
 payload jsonb not null, status text not null default 'queued', attempts integer not null default 0,
 available_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(organization,game_id,recipient,kind,mode)
);
create table if not exists hms_reminder_attempts (
 id bigserial primary key, job_id bigint not null references hms_reminder_jobs(id),
 attempt integer not null, outcome text not null, created_at timestamptz not null default now()
);
create index if not exists hms_reminder_due on hms_reminder_jobs(organization,status,available_at);
-- Server-only service credentials. Never expose contact/job tables to public roles.
alter table hms_reminder_settings enable row level security;
alter table hms_reminder_jobs enable row level security;
alter table hms_reminder_attempts enable row level security;

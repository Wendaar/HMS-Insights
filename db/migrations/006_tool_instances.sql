-- Shared application settings. No sporting/contact source rows are stored here.
create table if not exists hms_tool_instances (
  tool text not null,
  organization text not null,
  slug text not null,
  draft jsonb not null,
  published jsonb,
  revision integer not null default 1,
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  primary key (tool, organization, slug)
);

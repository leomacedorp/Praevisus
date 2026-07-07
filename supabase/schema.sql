create extension if not exists "pgcrypto";

create table if not exists public.monitor_runs (
  id uuid primary key default gen_random_uuid(),
  generated_at timestamptz not null default now(),
  source_count integer not null,
  item_count integer not null,
  signal_count integer not null,
  noise_count integer not null,
  alert_level text not null default 'green',
  report_html_path text,
  report_json_path text,
  local_context jsonb not null default '{}'::jsonb,
  domain_breakdown jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.monitor_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid references public.monitor_runs(id) on delete cascade,
  source text not null,
  title text not null,
  link text not null,
  published_at text,
  domain text not null,
  verdict text not null,
  confidence double precision not null default 0,
  cui_bono text,
  local_impact text,
  action text,
  horizon_hours integer,
  specialist_briefs jsonb not null default '[]'::jsonb,
  raw jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists monitor_items_run_id_idx on public.monitor_items(run_id);
create index if not exists monitor_runs_generated_at_idx on public.monitor_runs(generated_at desc);
create index if not exists monitor_items_verdict_idx on public.monitor_items(verdict);

alter table public.monitor_runs enable row level security;
alter table public.monitor_items enable row level security;


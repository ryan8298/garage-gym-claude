-- One row per user holding their own program choices: place in the rotation,
-- which pull they train, pins, bans and added video links. The program itself
-- (days, slots, pools) is defined in the app code.
create table public.program_state (
  id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index program_state_synced on public.program_state (synced_at);
create trigger program_state_sync before insert or update on public.program_state
  for each row execute function public.sync_stamp();
alter table public.program_state enable row level security;
create policy program_state_read on public.program_state for select to authenticated using (true);
create policy program_state_insert on public.program_state for insert to authenticated with check (id = (select auth.uid()));
create policy program_state_update on public.program_state for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

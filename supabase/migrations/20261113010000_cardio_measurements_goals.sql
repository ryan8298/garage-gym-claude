-- Cardio entries, monthly body measurements and goals.
create table public.cardio_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  kind text not null,
  minutes numeric(6,1),
  distance numeric(6,2),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table public.body_measurements (
  id text primary key, -- "<user_id>_<yyyy-mm-dd>"
  user_id uuid not null references auth.users(id) on delete cascade,
  measured_on date not null,
  waist numeric(5,1), chest numeric(5,1), hips numeric(5,1), arm numeric(5,1), thigh numeric(5,1),
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table public.goals (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('body_weight','lift')),
  exercise_key text,
  target_value numeric(7,2) not null,
  target_date date,
  start_value numeric(7,2),
  start_date date not null,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index cardio_entries_synced on public.cardio_entries (synced_at);
create index cardio_entries_user on public.cardio_entries (user_id);
create index body_measurements_synced on public.body_measurements (synced_at);
create index body_measurements_user on public.body_measurements (user_id);
create index goals_synced on public.goals (synced_at);
create index goals_user on public.goals (user_id);
do $$
declare t text;
begin
  foreach t in array array['cardio_entries','body_measurements','goals'] loop
    execute format('create trigger %I_sync before insert or update on public.%I for each row execute function public.sync_stamp()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;
create policy cardio_entries_read on public.cardio_entries for select to authenticated using (true);
create policy goals_read on public.goals for select to authenticated using (true);
-- Measurements are private unless their owner has turned sharing on.
create policy body_measurements_read on public.body_measurements for select to authenticated using (
  user_id = (select auth.uid())
  or coalesce((select (p.data->>'shareMeasurements')::boolean from public.program_state p where p.id = body_measurements.user_id), false)
);

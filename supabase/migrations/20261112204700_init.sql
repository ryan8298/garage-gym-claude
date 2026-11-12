-- Garage Gym (Claude build): core schema, sync columns and row level security.
-- Every synced table carries:
--   updated_at  client clock, used for last-write-wins
--   synced_at   server clock, used as the pull cursor
--   deleted     soft delete, so removals sync like any other change

create or replace function public.sync_stamp() returns trigger
language plpgsql set search_path = '' as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return null; -- an older write never replaces a newer one
  end if;
  -- clock_timestamp, not now(): rows written in one statement must get
  -- different stamps, or a paged pull could skip some of them.
  new.synced_at := clock_timestamp();
  return new;
end $$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  weekly_target int not null default 4 check (weekly_target between 1 and 7),
  step_target int not null default 8000,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.daily_logs (
  id text primary key, -- "<user_id>_<yyyy-mm-dd>", so two devices cannot make duplicates
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  body_weight numeric(5,1),
  steps int,
  sleep_hours numeric(3,1),
  energy int check (energy between 1 and 5),
  soreness int check (soreness between 1 and 5),
  note text,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false,
  unique (user_id, log_date)
);

create table public.workout_sessions (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  template_key text,
  title text not null,
  local_date date not null,
  started_at timestamptz not null,
  finished_at timestamptz,
  block_phase text,
  block_week int,
  effort int check (effort between 1 and 5),
  note text,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.session_exercises (
  id uuid primary key,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_key text not null,
  name text not null, -- copied in, so program edits never rewrite history
  position int not null,
  is_main boolean not null default false,
  superset_group int,
  measure text not null default 'weight_reps',
  target jsonb,
  note text,
  skipped boolean not null default false,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);

create table public.sets (
  id uuid primary key,
  session_exercise_id uuid not null references public.session_exercises(id) on delete cascade,
  session_id uuid not null references public.workout_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  position int not null,
  set_type text not null default 'normal' check (set_type in ('warmup','normal','drop','failure')),
  weight numeric(6,2),
  reps int,
  duration_seconds int,
  distance numeric(7,2),
  side text check (side in ('left','right')),
  reps_in_reserve int,
  done boolean not null default false,
  done_at timestamptz,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);

create index daily_logs_synced on public.daily_logs (synced_at);
create index workout_sessions_synced on public.workout_sessions (synced_at);
create index workout_sessions_user on public.workout_sessions (user_id);
create index session_exercises_synced on public.session_exercises (synced_at);
create index session_exercises_session on public.session_exercises (session_id);
create index session_exercises_user on public.session_exercises (user_id);
create index sets_synced on public.sets (synced_at);
create index sets_exercise on public.sets (session_exercise_id);
create index sets_session on public.sets (session_id);
create index sets_user on public.sets (user_id);
create index profiles_synced on public.profiles (synced_at);

do $$
declare t text;
begin
  foreach t in array array['profiles','daily_logs','workout_sessions','session_exercises','sets'] loop
    execute format('create trigger %I_sync before insert or update on public.%I for each row execute function public.sync_stamp()', t, t);
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Reading: both signed-in members can read these tables (workouts, body
-- weight and streaks are shared between the two of us).
-- Writing: each person can only write their own rows. Nothing is hard-deleted.
create policy profiles_read on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

do $$
declare t text;
begin
  foreach t in array array['daily_logs','workout_sessions','session_exercises','sets'] loop
    execute format('create policy %I on public.%I for select to authenticated using (true)', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;

-- Exactly two accounts, ever. A third sign-up is refused by the database
-- itself, whatever the dashboard sign-up setting says.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from auth.users) > 2 then
    raise exception 'This app is limited to two accounts.';
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, initcap(split_part(new.email, '@', 1)));
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.sync_stamp() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

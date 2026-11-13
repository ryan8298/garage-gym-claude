-- AI coach: each person's private conversation with the coach, and a daily
-- count of use that only the server function writes.
create table public.coach_messages (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null,
  role text not null check (role in ('user','coach')),
  kind text not null default 'chat',
  body text not null,
  proposals jsonb not null default '[]'::jsonb,
  quick_workout jsonb,
  session_id uuid,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index coach_messages_synced on public.coach_messages (synced_at);
create index coach_messages_user on public.coach_messages (user_id);
create trigger coach_messages_sync before insert or update on public.coach_messages for each row execute function public.sync_stamp();
alter table public.coach_messages enable row level security;
create policy coach_messages_read on public.coach_messages for select to authenticated using (user_id = (select auth.uid()));
create policy coach_messages_insert on public.coach_messages for insert to authenticated with check (user_id = (select auth.uid()));
create policy coach_messages_update on public.coach_messages for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

create table public.coach_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null,
  messages int not null default 0,
  input_tokens bigint not null default 0,
  output_tokens bigint not null default 0,
  primary key (user_id, day)
);
alter table public.coach_usage enable row level security;
create policy coach_usage_read on public.coach_usage for select to authenticated using (user_id = (select auth.uid()));

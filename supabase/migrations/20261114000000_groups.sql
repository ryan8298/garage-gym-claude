-- Groups: people see and share data only with the members of their own group
-- (a couple, or a few lifting partners). Accounts are created by invitation
-- only. This replaces the "exactly two accounts, everyone sees everything"
-- rules the app started with.

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
-- One group per person for now.
create table public.group_members (
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create table public.invites (
  code text primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '7 days',
  used_by uuid references auth.users(id) on delete set null,
  used_at timestamptz
);
create index invites_group on public.invites (group_id);
create index invites_created_by on public.invites (created_by);
create index groups_created_by on public.groups (created_by);

-- Everyone already here is one group.
with g as (insert into public.groups (created_by) select id from auth.users order by created_at limit 1 returning id)
insert into public.group_members (group_id, user_id) select g.id, u.id from g, auth.users u;
update auth.users set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"invited": true}'::jsonb;

/** Me and everyone in my group. The basis of every sharing rule below. */
create function public.my_people() returns setof uuid
language sql stable security definer set search_path = '' as $$
  select (select auth.uid())
  union
  select other.user_id
  from public.group_members mine
  join public.group_members other on other.group_id = mine.group_id
  where mine.user_id = (select auth.uid())
$$;
revoke execute on function public.my_people() from public, anon;
grant execute on function public.my_people() to authenticated;

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.invites enable row level security;
create policy group_members_read on public.group_members for select to authenticated using (user_id in (select public.my_people()));
create policy groups_read on public.groups for select to authenticated using (id in (select group_id from public.group_members where user_id = (select auth.uid())));
create policy invites_read on public.invites for select to authenticated using (created_by = (select auth.uid()));
-- No direct writes: groups, members and invites change only through the functions below.

-- ---- sharing rules: my group, not everyone ----
do $$
declare t text;
begin
  -- Read by my group, written by the owner only.
  foreach t in array array['cardio_entries','daily_logs','feed_reactions','goals'] loop
    execute format('drop policy %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id in (select public.my_people()))', t || '_read', t);
  end loop;
  -- Read and written by my group: one phone logs a shared workout for both people.
  foreach t in array array['workout_sessions','session_exercises','sets'] loop
    execute format('drop policy %I on public.%I', t || '_read', t);
    execute format('drop policy %I on public.%I', t || '_insert', t);
    execute format('drop policy %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for select to authenticated using (user_id in (select public.my_people()))', t || '_read', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id in (select public.my_people()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id in (select public.my_people())) with check (user_id in (select public.my_people()))', t || '_update', t);
  end loop;
end $$;

drop policy profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (id in (select public.my_people()));

drop policy program_state_read on public.program_state;
drop policy program_state_insert on public.program_state;
drop policy program_state_update on public.program_state;
create policy program_state_read on public.program_state for select to authenticated using (id in (select public.my_people()));
create policy program_state_insert on public.program_state for insert to authenticated with check (id in (select public.my_people()));
create policy program_state_update on public.program_state for update to authenticated using (id in (select public.my_people())) with check (id in (select public.my_people()));

drop policy body_measurements_read on public.body_measurements;
create policy body_measurements_read on public.body_measurements for select to authenticated using (
  user_id = (select auth.uid())
  or (user_id in (select public.my_people())
      and coalesce((select (p.data ->> 'shareMeasurements')::boolean from public.program_state p where p.id = body_measurements.user_id), false))
);

-- ---- accounts by invitation only ----
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  -- Only the join function, which checks an invite code, marks an account as invited.
  if coalesce(new.raw_app_meta_data ->> 'invited', '') <> 'true' then
    raise exception 'Accounts are by invitation only.';
  end if;
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), initcap(split_part(new.email, '@', 1))));
  return new;
end $$;

-- ---- invitations ----
/** Make a one-use code that lets someone join my group. Starts a group for me if I have none. */
create function public.create_invite() returns text
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  g uuid;
  new_code text;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  select group_id into g from public.group_members where user_id = me;
  if g is null then
    insert into public.groups (created_by) values (me) returning id into g;
    insert into public.group_members (group_id, user_id) values (g, me);
  end if;
  if (select count(*) from public.group_members where group_id = g) >= 6 then raise exception 'A group can have up to 6 people.'; end if;
  if (select count(*) from public.invites where created_by = me and used_at is null and expires_at > now()) >= 5 then raise exception 'You already have 5 unused invitations.'; end if;
  -- Eight characters from letters and digits that are hard to confuse.
  select string_agg(substr('ABCDEFGHJKMNPQRSTUVWXYZ23456789', 1 + floor(random() * 31)::int, 1), '') into new_code from generate_series(1, 8);
  insert into public.invites (code, group_id, created_by) values (new_code, g, me);
  return new_code;
end $$;

/** Join the group an invitation belongs to, leaving my current one. For people who already have an account. */
create function public.accept_invite(p_code text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  inv public.invites;
  old uuid;
begin
  if me is null then raise exception 'Not signed in.'; end if;
  select * into inv from public.invites where code = upper(trim(p_code)) for update;
  if inv.code is null or inv.used_at is not null or inv.expires_at < now() then raise exception 'That code is not valid any more.'; end if;
  if inv.created_by = me then raise exception 'That is your own invitation.'; end if;
  if (select count(*) from public.group_members where group_id = inv.group_id) >= 6 then raise exception 'That group is full.'; end if;
  select group_id into old from public.group_members where user_id = me;
  if old = inv.group_id then raise exception 'You are already in that group.'; end if;
  delete from public.group_members where user_id = me;
  if old is not null and not exists (select 1 from public.group_members where group_id = old) then delete from public.groups where id = old; end if;
  insert into public.group_members (group_id, user_id) values (inv.group_id, me);
  update public.invites set used_by = me, used_at = now() where code = inv.code;
end $$;

/** Leave my group. My own data stays mine; I stop seeing theirs and they stop seeing mine. */
create function public.leave_group() returns void
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  old uuid;
begin
  select group_id into old from public.group_members where user_id = me;
  delete from public.group_members where user_id = me;
  if old is not null and not exists (select 1 from public.group_members where group_id = old) then delete from public.groups where id = old; end if;
end $$;

/** Delete my account and everything in it. Cannot be undone. */
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
declare me uuid := (select auth.uid());
begin
  if me is null then raise exception 'Not signed in.'; end if;
  delete from auth.users where id = me;
end $$;

revoke execute on function public.create_invite(), public.accept_invite(text), public.leave_group(), public.delete_my_account() from public, anon;
grant execute on function public.create_invite(), public.accept_invite(text), public.leave_group(), public.delete_my_account() to authenticated;

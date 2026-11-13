-- Reactions to a partner's workout, progress photo records, push
-- subscriptions, a private bucket for photos and a server-only secrets table.
create table public.feed_reactions (
  id text primary key, -- "<user_id>_<session_id>"
  user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);
create table public.progress_photos (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  taken_on date not null,
  path text not null,
  updated_at timestamptz not null default now(),
  synced_at timestamptz not null default now(),
  deleted boolean not null default false
);
create index feed_reactions_synced on public.feed_reactions (synced_at);
create index feed_reactions_user on public.feed_reactions (user_id);
create index progress_photos_synced on public.progress_photos (synced_at);
create index progress_photos_user on public.progress_photos (user_id);
do $$
declare t text;
begin
  foreach t in array array['feed_reactions','progress_photos'] loop
    execute format('create trigger %I_sync before insert or update on public.%I for each row execute function public.sync_stamp()', t, t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (user_id = (select auth.uid()))', t || '_insert', t);
    execute format('create policy %I on public.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))', t || '_update', t);
  end loop;
end $$;
create policy feed_reactions_read on public.feed_reactions for select to authenticated using (true);
-- Photos are always private to the person who took them.
create policy progress_photos_read on public.progress_photos for select to authenticated using (user_id = (select auth.uid()));

create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
create index push_subscriptions_user on public.push_subscriptions (user_id);
alter table public.push_subscriptions enable row level security;
create policy push_subscriptions_read on public.push_subscriptions for select to authenticated using (user_id = (select auth.uid()));
create policy push_subscriptions_insert on public.push_subscriptions for insert to authenticated with check (user_id = (select auth.uid()));
create policy push_subscriptions_update on public.push_subscriptions for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy push_subscriptions_delete on public.push_subscriptions for delete to authenticated using (user_id = (select auth.uid()));

-- Readable only by server-side code (no policies, so no app user can read it).
-- Holds the private half of the push key; its value is not in this repo.
create table public.app_secrets (
  name text primary key,
  value text not null,
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('progress-photos', 'progress-photos', false, 3145728, array['image/jpeg'])
on conflict (id) do nothing;
create policy "progress photos: owner reads" on storage.objects for select to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress photos: owner adds" on storage.objects for insert to authenticated
  with check (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "progress photos: owner deletes" on storage.objects for delete to authenticated
  using (bucket_id = 'progress-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

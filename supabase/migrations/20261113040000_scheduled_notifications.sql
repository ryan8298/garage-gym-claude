-- Scheduled push notifications: a Sunday summary and a nudge after four days
-- without a workout. The database's scheduler calls the notify function with
-- a secret that is generated here and never leaves the database.
create extension if not exists pg_cron;
create extension if not exists pg_net;

insert into public.app_secrets (name, value)
values ('cron_secret', replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- Times are UTC. Sunday 23:30 UTC is Sunday late afternoon or evening in the US.
select cron.schedule('garage-gym-weekly-summary', '30 23 * * 0', $$
  select net.http_post(
    url := 'https://kfmxfnayiaxducmcexye.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where name = 'cron_secret')),
    body := '{"type":"weekly_summary"}'::jsonb
  )
$$);
select cron.schedule('garage-gym-nudge', '0 22 * * *', $$
  select net.http_post(
    url := 'https://kfmxfnayiaxducmcexye.supabase.co/functions/v1/notify',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-secret', (select value from public.app_secrets where name = 'cron_secret')),
    body := '{"type":"nudge"}'::jsonb
  )
$$);

-- A tracked run or walk keeps its route: a list of [latitude, longitude] points.
alter table public.cardio_entries add column if not exists route jsonb;

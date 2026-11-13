-- Training together on one phone. A shared workout is two sessions, one per
-- person, linked by pair_id. The phone that logs it writes both people's
-- sessions, lifts and sets, and moves the partner's rotation forward, so a
-- signed-in user may now write those rows for the other person.
--
-- This is safe only while every account is a partner of every other. Before
-- anyone outside the household signs up, these rules must be narrowed to
-- "members of my group" (backlog item 6.2).
alter table public.workout_sessions add column if not exists pair_id uuid;

drop policy workout_sessions_insert on public.workout_sessions;
drop policy workout_sessions_update on public.workout_sessions;
create policy workout_sessions_insert on public.workout_sessions for insert to authenticated with check (true);
create policy workout_sessions_update on public.workout_sessions for update to authenticated using (true) with check (true);

drop policy session_exercises_insert on public.session_exercises;
drop policy session_exercises_update on public.session_exercises;
create policy session_exercises_insert on public.session_exercises for insert to authenticated with check (true);
create policy session_exercises_update on public.session_exercises for update to authenticated using (true) with check (true);

drop policy sets_insert on public.sets;
drop policy sets_update on public.sets;
create policy sets_insert on public.sets for insert to authenticated with check (true);
create policy sets_update on public.sets for update to authenticated using (true) with check (true);

drop policy program_state_insert on public.program_state;
drop policy program_state_update on public.program_state;
create policy program_state_insert on public.program_state for insert to authenticated with check (true);
create policy program_state_update on public.program_state for update to authenticated using (true) with check (true);

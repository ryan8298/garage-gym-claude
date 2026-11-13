# Progress

## Phase 1: foundation (done; iPhone checklist passed on Ryan's phone 2026-11-12)

Done:
- Design system as tokens in `src/index.css`, following the approved mockups (dark ground, lime accent, blue for the coach, Space Grotesk numerals, Inter text).
- Installable PWA: manifest, icons, standalone display, offline app shell, self-hosted fonts.
- Email and password sign-in. The signed-in user is remembered on the phone; offline or an expired token never signs you out.
- Supabase project `garage-gym` with the core schema and RLS applied: profiles, daily_logs, workout_sessions, session_exercises, sets. A database trigger refuses a third account.
- Local database (Dexie) and sync outbox, with 11 passing tests covering retries, lost responses, edits during a push, ordering, conflicts and paging.
- "Update available" prompt that never appears during an open workout. Version and build in Settings.
- Tab shell with five tabs, bottom sheets that drag to dismiss, and the custom number pad.
- Add to Home Screen guide when opened in Safari, and per-phone capability checks in Settings.
- Working ahead so sync can be tested for real: the daily log (body weight, steps, sleep, energy, soreness, note) and the weekly strip on Today.

Decisions:
- Both members can read each other's rows in the shared tables. Daily log rows carry body weight (shared by request), so sleep, energy, soreness and the note are readable by the partner too. Measurements and photos will be private tables.
- Exercise, program, goal and coach tables are added in the phase that needs them, after the program is approved.
- iOS splash screens are left for the polish phase; the launch background already matches the app.
- Stack-style push transitions and swipe-back are basic for now (a short slide on navigation); the full version comes with the workout flow in phase 3.

Infrastructure:
- GitHub: `ryan8298/garage-gym-claude`. Every push to `main` deploys.
- Vercel: project `garage-gym-claude` in the Demo Hub team, with the two Supabase environment variables set.
- Supabase: project `garage-gym` (ref `kfmxfnayiaxducmcexye`).

Not done yet in this phase:
- The two user accounts (created by hand in the Supabase dashboard).

Program direction (decided 2026-11-12, applies from phase 2):
- Free weights first. Ryan and Stella train together almost every session, so a spotter is present. Main lifts default to the free barbell (squat in the rack with safety arms, deadlifts on bumpers, bench, overhead press, row); accessories prefer dumbbell and barbell versions.
- The Smith bar is used where it is the better tool (hip thrust, calf raise) and as the "training alone today" swap for each main lift.

## iPhone checklist for phase 1

1. Open the address in Safari. The Add to Home Screen guide appears.
2. Add to Home Screen, open from the icon: full screen, no Safari bars, dark status bar area.
3. Sign in. Close the app fully and reopen: still signed in, no login flash.
4. Log tab: enter body weight with the number pad. The iOS keyboard does not appear.
5. Turn on airplane mode. Change weight, steps and energy. The badge says "Saved on this phone".
6. Close and reopen the app in airplane mode: the app opens and the entries are still there.
7. Turn airplane mode off: within a few seconds the badge says "Saved and synced".
8. On the second phone, signed in as the other person: nothing breaks, and each person sees their own log.
9. Try to pinch-zoom, double-tap zoom and pull down to refresh: none of them work.
10. Settings, This phone: note which items show a warning.

## Phase 1 result

Ryan ran the checklist: installed full screen, stayed signed in, number pad shown, saved offline, survived an offline restart, synced on reconnect (one daily log row arrived exactly once), no browser behaviour, no capability warnings. Still to do: Stella signing in on her phone.

## Phase 2: exercise library and program (done; iPhone checklist passed 2026-11-13, video paste not tested by choice)

Done:
- Exercise library: 86 exercises we can do on our equipment, each with muscles, steps and a setup note for the M1 Pro. 69 have start and end pictures from free-exercise-db (public domain, license checked); the pictures are stored in the app and work offline. The catalog is `scripts/catalog.mjs`; `scripts/build-exercises.mjs` regenerates the data.
- Library screens: search, muscle and equipment filters, and a page per exercise with pictures, setup, steps, things to watch for, and "always use" and "never use" switches.
- Video: paste a YouTube link on any exercise and it plays inside the app. No links were invented; every exercise starts without one and has a "Search YouTube" button.
- The approved program in `src/lib/program.ts`, exactly as in `PROGRAM_PROPOSAL.md`.
- The programming engine in `src/lib/engine.ts`: blocks and phases, accessory counts, half-rotation per block, recovery week every eighth week, Day C top-ups, Day D catch-up slots, core finishers, supersets, the 70-minute cap, pins, bans and "training alone" swaps. 18 tests simulate 24 weeks.
- Per-user program state (place in the rotation, Day B pull choice, equipment, pins, bans, video links), saved offline and synced.
- Today shows the next workout with every lift; a preview screen shows sets and reps; swap day and skip work.

Decisions:
- 17 exercises have no picture because the dataset has no match (for example landmine squat, cable leg curl, Copenhagen plank). They show written steps only.
- "Things to watch for" is written for the main lifts only.
- Blocks are counted in calendar weeks from the first workout. Until a workout is started (phase 3) the app shows block 1, week 1.
- Day C keeps at least three core slots as well as its top-ups.

## iPhone checklist for phase 2

1. Open the app and accept the "Update available" prompt. Today shows "Next up · Day A, Legs & Lower Back" with 8 lifts.
2. Tap View workout: two main lifts, four accessories, two core finisher exercises, with sets and reps.
3. Turn on "Training alone today": the squat changes to the Smith squat and the Romanian deadlift to dumbbells.
4. Tap a lift: its page shows pictures, setup note and steps.
5. Settings, My program: set your Day B pull (Ryan: pull-ups). Go back, Swap day to Day B, View workout: the second main lift matches.
6. Library: search "curl", then filter by Cable. Results update as you type.
7. On any exercise, tap Search YouTube, copy a link, come back, Add video, paste, Save. The video plays inside the app.
8. Airplane mode, close and reopen: Today, the workout preview, the Library and exercise pictures all still work.
9. On an exercise page tap "Never use", then check that it no longer appears in that day's workout.

## Phase 3: the workout session (done; iPhone checklist passed 2026-11-13, sets synced with no duplicates)

Done:
- Start the next workout, a previewed day, or an empty freestyle workout. Starting the first workout sets the program's start week.
- Workout screen: progress strip, the current exercise with last time, target and the reason for today's numbers, set rows, and the full exercise list.
- Number pad for weight, reps and time. Weight steps by the smallest amount we can load, typed weights snap to the nearest loadable one, and the plate breakdown shows live, with a warning over the Smith bar's 275 lb plate limit.
- Plate math in `src/lib/plates.ts`: 45 lb barbell, 33 lb Smith bar, cable and landmine stacks, dumbbells 5 to 50 in 5 lb steps.
- Weight suggestions in `src/lib/progression.ts`: double progression, add reps first when the next weight is a big jump, ease back 10% after two missed sessions, 10% lighter after two weeks away, earlier progress when the last set felt easy.
- Set types (warm-up, normal, drop, failure), warm-up calculator, add and delete sets, swap an exercise (today only or also in the program), skip, add an exercise, per-exercise note.
- Exercises measured by weight and reps, bodyweight reps with optional added weight, time, and carries.
- Supersets: ticking a set on the first lift jumps to its partner, and rest starts after the second.
- Rest timer from a stored end time, with plus and minus 15 seconds, sound at the end, and the screen kept awake.
- Personal record banner and sound the moment the set is ticked. "Reps left in the tank" after an exercise's last set.
- Resume bar on every other screen while a workout is open.
- Finish screen: minutes, pounds lifted, sets, records, effort and note. Finishing moves the rotation on.
- Tests: 52 unit tests (sync, engine, plate math, suggestions) and a phone-size browser test that logs sets, goes offline, reloads, finishes, and checks exactly the ticked sets were recorded once (`npm run test:e2e`).

Decisions and known gaps:
- Repeating a past workout and logging one with a past date move to phase 4, where history is built.
- Deleting a set and changing its type are in the number pad, not a swipe or a tap on the set number.
- The browser test has no server, so it proves offline saving and one queued upload per set; the no-duplicates-on-retry rule is covered by the sync unit tests.
- One-sided exercises are logged as one row per set ("each side"), not separate left and right rows.
- A first-time exercise has no suggested weight. Entering one on the first set carries it to the rest.

## iPhone checklist for phase 3

1. Accept "Update available". On Today tap Start workout.
2. Tap the weight on set 1: the app's pad opens, not the iPhone keyboard. Type 136: it says it can't be loaded and offers 135. Tap Next, enter reps, Done. The same weight appears on sets 2 and 3, with "Per side: 45 on the 45 lb bar".
3. Tick set 1: the rest timer appears at 2:00 and counts down. Try +15, then lock the phone for 20 seconds and unlock: the time is correct.
4. Let a rest run out with the phone unlocked: you hear a beep (ringer switch on, volume up).
5. Leave the phone untouched for a minute during the workout: the screen stays awake.
6. Open the three-dot menu: swap the exercise, then add warm-up sets on a lift that has a weight.
7. Tap the down arrow: Today shows a "Workout in progress" bar. Tap it to return.
8. Airplane mode. Tick two more sets, close the app fully, reopen: the workout and every ticked set are still there.
9. Finish the workout. The finish screen shows minutes, pounds and sets. Rate it and save.
10. Today now shows Day B next and 1 workout this week. Turn airplane mode off: the badge reaches "Saved and synced".
11. Start Day B and check your pull main lift, then discard that workout from Finish.

## Phase 4: log, goals, progress and history (done; iPhone checklist passed 2026-11-13)

Done:
- Log tab: cardio entries (type, minutes, miles) with a bar toward 150 minutes a week, and tape measurements (waist, chest, hips, arm, thigh).
- Goals: target body weight or a target for any logged lift, with a progress bar and a projected date from the recent trend. Shown on Progress and on Today.
- Progress: this week against last (workouts, pounds lifted, cardio minutes and miles, average steps), body weight with a 7-day average line, sets per muscle group against the target of 10, estimated-max chart per lift, personal records, and a 26-week grid of training days.
- History: every finished workout, openable. Tap a set to correct it, do the workout again, delete it, or log a past workout on a chosen date.
- After Day C the finish screen links to the cardio log.
- Tests: 5 more unit tests for trends and projections (57 in all); the browser test now also checks Progress, History and cardio.

Decisions and known gaps:
- Charts are drawn directly as SVG instead of with Recharts: fewer moving parts and a smaller download.
- Sets per muscle is shown as bars. The body-outline map is left for the polish phase, since it needs licensed artwork.
- Lift goals track the weight of your best set, not the estimated max.
- Measurements are private unless "Share my measurements" is on in Settings. Progress photos come with phase 5.
- A workout logged for a past date has no duration.
- Progress shows your own data. Viewing your partner's, and the combined view, come with phase 5.
- Deleting a workout does not move the day rotation back.

## iPhone checklist for phase 4

1. Accept "Update available". Open Progress: the tiles show this week's workout and pounds lifted, and your test workout appears in the lift chart picker.
2. Log tab: add a 30-minute walk with a distance. The bar moves toward 150 and Progress shows the minutes and miles.
3. Log tab: enter a waist measurement.
4. Progress, Goals, Add goal: set a target body weight. It appears on Progress and on Today.
5. Progress, Workout history: open your workout, tap a set and change its reps. The numbers update.
6. In that workout tap "Do this workout again", then discard it from Finish.
7. History, Log a past workout: pick yesterday and Day B, tick a few sets, Finish. It is listed under yesterday's date and yesterday's dot fills in on Today.
8. If the earlier test workout should not count, delete it from its history page.
9. Airplane mode: Progress, History and the Log tab all still open and accept entries.

## Phase 5: together, notifications and photos (built, waiting on the iPhone checklist)

Done:
- Us tab: both of our weeks side by side (workouts against target, week streak, cardio, PRs), body weight change for both on one chart, an activity feed of finished workouts with one-tap cheers, and a recap of last week for each of us.
- Progress has a Me / partner switch. A partner's goals are shown read-only and their history is not opened.
- App icon badge: the number of partner workouts not yet seen on the Us tab.
- Push notifications: enabled from Settings with a button (never on first launch), with a switch per type and a test button. Sent by the `notify` Edge Function when a partner finishes a workout or cheers one. The subscription is renewed quietly each time the app opens.
- Progress photos: taken or chosen on the phone, shrunk before upload, stored in a private bucket, shown through short-lived private links, with a two-photo side-by-side comparison. Always private to the person who took them.
- Tests: 58 unit tests; the browser test now also opens the Us tab.

Decisions and known gaps:
- Push has not been verified end to end. It needs two real iPhones: the sandbox cannot receive pushes, and the function was deployed but not called.
- The weekly summary notification and the nudge after four days off are not built. Both need a scheduled job that knows each person's time zone.
- The private half of the push key is kept in a database table that only server-side code can read (`app_secrets`), not in the repo.
- The activity feed is worked out from the workouts themselves, so there is no separate feed table.
- A week counts toward the streak with 3 or more workouts.
- Photos need a connection to upload and to view.

## iPhone checklist for phase 5

Both phones are needed for most of this.

1. Both: accept "Update available", then open the app from the Home Screen icon.
2. Both: Settings, Notifications, Enable notifications, Allow. Then "Send a test notification": one arrives on that phone.
3. Both: open the Us tab. Each of you sees both cards, with the other person's name.
4. Ryan: finish a short workout (freestyle with one set is enough). Stella: a notification arrives, the app icon shows a badge, and the workout is in her Us feed.
5. Stella: tap the thumbs-up on that workout. Ryan: a notification arrives and the feed shows that Stella cheered.
6. Stella: turn off "My partner finishes a workout" in Settings. Ryan finishes another short workout: Stella gets no notification.
7. Ryan: Progress, switch to Stella and back. Her numbers show; her history button does not.
8. Either: Log tab, Progress photos, add two photos, tap both to compare. Sign in on the other phone is not needed: the other person can never see them.
9. Us tab: open last week's recap.

## Next

Phase 6: full settings, the program editor, data export and the first-run setup flow.


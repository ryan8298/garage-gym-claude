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

## Phase 2: exercise library and program (built, waiting on the iPhone checklist)

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

## Next

Phase 3: the workout session. Start a workout, log sets with the number pad and plate breakdown, set types, warm-ups, supersets, weight suggestions, rest timer and PR moments.


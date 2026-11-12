# Progress

## Phase 1: foundation (built, waiting on the iPhone checklist)

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

## Next

Phase 2: exercise library and the program. Starts with the gap analysis, slot pools and proposed main lifts for approval.

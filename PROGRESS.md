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

## Phase 5: together, notifications and photos (done; iPhone checklist passed on both phones 2026-11-13, including push)

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

## Phase 6: settings, program editor, export and first-run setup (done; iPhone checklist passed 2026-11-13)

Done:
- Program editor (Settings, Edit my program): per day, change either main lift within its family, reorder the accessory slots by priority, and lock any slot or finisher to one exercise or let it rotate. A reset button puts a day back to standard. Each person edits only their own copy.
- Settings: rest timer length for each kind of lift, sound on or off, daily step target, and the plates we own by pair. Changing the plates changes every suggested weight and breakdown.
- Export: everything as one JSON file, plus CSV files of workouts and the daily log, through the iPhone share sheet. Made from the copy on the phone, so it works offline.
- First-run setup for someone with no workouts yet: name, body weight, workouts per week, the pull-up question and the ankle strap.
- Tests: 60 unit tests; the browser test reorders a slot in the editor and checks the next workout follows it.

Decisions and known gaps:
- The editor does not change sets or rep ranges, or add brand-new slots. Sets and reps come from the training phase; extra exercises are added during a workout.
- Moving a slot changes its priority only. The exercise in it does not change.
- Custom exercises (adding one that is not in the library) are not built.
- Progress photos are not part of the export.
- First-run setup is skipped for anyone who already has a workout, and waits for the first sync so a new phone does not ask a returning user again.

## iPhone checklist for phase 6

1. Accept "Update available". Settings, Edit my program: on Day A move Calves to the top, then check the Day A preview lists the calf exercise first among accessories.
2. In the editor tap a main lift and choose another, then tap a slot and lock it to one exercise. The preview follows both. Tap Reset Day A to standard.
3. Settings, Rest timer: change Main lifts to 2:30. Start a workout, tick a main-lift set: the timer starts at 2:30. Discard the workout.
4. Settings, Sounds off: no beep at the end of a rest. Turn it back on.
5. Settings, Plates I own: set the 2.5 lb pairs to 0. In a workout the barbell weight now steps by larger amounts. Set it back to 1.
6. Settings, My data: export everything. The share sheet opens; save to Files and open the file.
7. Stella, if she has no workouts yet: she sees the first-run questions once after updating.

## Phase 7: AI coach (done; iPhone checklist passed 2026-11-13)

Done:
- Coach screen, opened from the button in the Today header, the finish screen and the Progress tab. Chat with suggested prompts, a post-workout debrief on request, and a weekly review.
- Program changes come back as cards with a reason; each is accepted or rejected on its own. Accepting applies it to that person's program only. The coach can propose: swapping a main lift, locking a slot to one exercise, removing an exercise from the rotation, and reordering a day's slots.
- One-off workouts: the coach can build a session for today, which starts with one tap.
- Every answer is checked twice (on the server, then on the phone) against `supabase/functions/coach/rules.ts`: unknown exercises, exercises needing equipment we lack, exercises in the wrong slot, incomplete slot orders and nonsense set counts are all discarded. 7 tests feed it bad output.
- The `coach` Edge Function calls the Anthropic API with the official TypeScript SDK (`claude-opus-5-5`, changeable with a `COACH_MODEL` secret), returns schema-checked structured output, and caches the instructions, library and program.
- Limits: 30 messages per person per day, counted on the server. Settings shows this month's messages and an upper cost estimate, and has an on/off switch.
- Conversations are private to each person and sync between their devices.
- With the coach off, offline, or without a key, everything else works; the browser test checks that the coach fails politely.
- Tests: 67 unit tests. No key or secret appears in the built app files.

Decisions and known gaps:
- Replies arrive whole, not word by word. Streaming and schema-checked output did not combine simply, and correct proposals mattered more.
- After the first real use, replies were changed from long paragraphs to one lead sentence plus short labelled bullets, with tighter word limits; the app renders the bullets and bold labels.
- Weights mentioned in the coach's text are guided by a note on what can be loaded, not enforced. Proposals carry no weights; set-by-set numbers stay with the rule-based engine.
- Server-side refusal fallback to another model is not enabled; a declined request returns a plain "try asking another way".
- The weekly review is on request. A scheduled Sunday review with a push notification is not built.
- The daily limit resets at midnight UTC, not local time.

## iPhone checklist for phase 7

1. Accept "Update available". Today shows a coach button next to the settings gear.
2. Ask "What should I focus on next?". A reply arrives in under about 30 seconds and refers to your own data.
3. Tap "Only 30 minutes today". A workout card appears; tap Start this workout, then discard it from Finish.
4. Ask it to swap a main lift, for example "Swap my squat to the Smith machine for now". A card appears. Accept it, and check the Day A preview shows the change. Then reset Day A in the program editor.
5. Ask for something impossible: "Add leg press to my leg day". It should explain that you cannot do that exercise and must not produce a card for it.
6. Finish a short workout and tap "Get a debrief" on the finish screen.
7. Progress, "Ask the coach to review my week".
8. Settings, AI coach: the month's message count has gone up. Turn the coach off: the coach button disappears and everything else still works. Turn it back on.
9. Airplane mode: asking the coach shows "The coach needs a connection" and nothing else breaks.

## Phase 8: polish pass (done; iPhone checklist passed 2026-11-13)

Done:
- Every screen was screenshotted at phone size and reviewed against the design system.
- On/off settings are iOS-style switches instead of browser checkboxes (Settings, workout preview, swap sheet).
- Program editor reorder controls are proper buttons with chevrons.
- Screen movement has direction: going deeper slides in from the right, going back slides from the left, switching tabs fades. All respect Reduce Motion.
- Swipe from the left edge goes back on every screen that has a back button, and the screen follows the finger.
- iOS splash screens for current iPhone sizes, so launch shows the logo on the app background, not a white flash. iOS only picks these up when the app is added to the Home Screen, so an existing install must be removed and re-added to get them.
- Scheduled notifications: a Sunday summary (23:30 UTC, Sunday afternoon or evening in the US) and a nudge on the day the gap since the last workout reaches four days (checked daily at 22:00 UTC). Each has its own switch in Settings. The database scheduler calls the notify function with a secret generated inside the database. A test call through the scheduler path returned success.
- Small fixes: plate labels no longer wrap, single-point charts show one axis label.

Not built, by decision:
- Custom exercises, the body-outline muscle map (bars are used), streamed coach replies, and changing sets and reps in the program editor.
- The swipe-back is edge-only and the outgoing screen is not shown underneath, unlike a native stack.

## iPhone checklist for phase 8

1. Accept "Update available".
2. Settings: every on/off control is a switch and toggles smoothly.
3. Settings, Edit my program: the up and down buttons reorder slots.
4. From Today open Settings, then Edit my program. Swipe from the left edge of the screen: it goes back one screen each time and follows your finger. A short swipe springs back.
5. Tab changes fade; opening a screen slides in from the right; Back slides from the left.
6. During a workout the app's own swipe-back is off, but iOS's edge swipe still minimizes the workout to the home screen. Ryan prefers this; the workout stays open behind the resume bar. Keep it.
7. Settings, Notifications: two new switches, "Sunday summary of our week" and "A nudge after 4 days without a workout". The first summary arrives this Sunday.
8. Optional, for the splash screen: remove the app from the Home Screen, add it again from Safari, sign in. Launch now shows the logo on a dark background. Your data comes back from the server after sign-in; make sure the sync indicator showed everything synced before removing.

## Release A, part 1: logging (done; iPhone checklist passed 2026-11-13)

Work now follows `BACKLOG.md`. This part is epic 1.

Done:
- A pinned note per exercise (rack heights, bench notch) that shows on the workout screen every time. Edited from the exercise's options. Stored in the person's program settings, so it syncs.
- Last time's weight and reps shown on each set row.
- Move earlier, Move later and Remove from this workout in the exercise options.
- Undo for a deleted set (6 seconds).
- Saved routines: "Save as a routine" on any past workout; start one from Today, Other.
- Interval timer (work, rest, rounds, presets) under Today, Other. Beeps at each change, keeps the screen on, and can log its minutes as cardio. Timer logic has 4 unit tests.
- Today's third button is now "Other" (freestyle, interval timer, routines).
- Tests: 71 unit tests; the browser test covers the pinned note and the timer.

Notes:
- Effort ("reps left in the tank") was already asked once per lift after the last set and already feeds the weight suggestions. An earlier gap analysis wrongly said it could not be entered.
- The interval timer does not run in the background: locking the phone or leaving the app stops the sounds.

## iPhone checklist for release A, part 1

1. Accept "Update available".
2. Start a workout. On a lift you have done before, each set row shows "last 135 x 8" style text.
3. Exercise options (the three dots): type a note under "My note for this exercise, shown every time". It appears under the lift name, and again next time you do that lift.
4. Exercise options: Move later moves the lift down the list; Remove from this workout takes it out.
5. Tap a set's weight, then Delete set. "Set deleted, Undo" appears; Undo brings it back.
6. Workout history, open a workout, Save as a routine. Then Today, Other: the routine is listed and starts a workout.
7. Today, Other, Interval timer: pick 20 / 10 x 8, Start. It counts down 5 seconds, then alternates Work and Rest with a beep, and offers to log the minutes at the end.

## Release A, part 1b: the exercise queue (done; iPhone checklist passed 2026-11-13)

From Ryan's feedback: reordering through the three-dot menu was not friendly, and the list of today's exercises should be edited directly, the way a Spotify queue is.

Done:
- "Today's exercises" on the workout screen is now a queue. Drag the handle on the right of a row to reorder. Swipe a row left to remove it (with Undo), or right to open its swap choices. Tap still jumps to the lift.
- Move earlier and Move later were removed from the three-dot menu. Remove and Skip remain there too.
- "Suggest for gaps" next to "+ Add exercise": lists up to four exercises for muscle groups that will still be under 10 sets this week after this workout, each added with one tap. Groups that fit today's kind of workout come first.
- Tests: 75 unit tests (4 for the suggestions); the browser test swipes, undoes, drags and adds a suggestion.

Decision: the suggestions are worked out on the phone from the last 7 days, not by the AI coach. That makes them instant, free and usable without signal in the garage. A coach-written version could be added behind the same button later.

## iPhone checklist for release A, part 1b

1. Accept "Update available" and start a workout. Scroll to "Today's exercises".
2. Press the handle (two lines) on a row and drag up or down: the row follows your finger and the others make room. It stays where you drop it.
3. Swipe a row left past "Release to remove": it goes, and "removed, Undo" appears. Undo puts it back in the same place.
4. Swipe a row right past "Release to swap": the swap choices for that lift open.
5. Scrolling the page up and down with a finger on the list still works, and a normal tap on a row still jumps to that lift.
6. Tap "Suggest for gaps": it lists exercises with a reason such as "Calves: 2 of 10 sets this week". Tap one: it joins the end of the queue.

## Release A, part 1c: swap for anything (works; Ryan wants more from it later, see BACKLOG 4.10 and 4.11)

From Ryan's feedback: the swap list was too short. Any lift should be swappable for any other, with recommendations leading and nothing hidden.

Done:
- The swap list is now "Recommended swaps", followed by "Choose any exercise", which searches the whole library with the same muscle group listed first.
- A swap chosen from the whole library is for today only. Changing the program itself to any exercise is backlog item 4.11.
- BACKLOG.md now carries two standing rules: recommend, never restrict; and any lift can be swapped for any other. Items 3.10 (where am I training today) and 4.10 (swaps drawn from the whole library) were added.

iPhone check: in a workout, three dots, Choose any exercise. Search, pick one: the lift is replaced and its sets get fresh suggestions.

## Release A, part 2: training together (done; iPhone checklist passed 2026-11-13)

Backlog items 2.1, 2.2, 2.3 (in part) and 2.5.

How it works:
- Today has a "Training with <partner>" switch. With it on, Start creates two sessions, one per person, linked by `pair_id`. Each person's lifts come from their own program for the same day, so their weights, history, records and suggestions are their own.
- The workout screen shows one person at a time, with a two-button switch at the top. Ticking a set passes the turn to the other person on the same lift; the rest timer starts once both have done that set.
- Finish closes both sessions and moves both rotations on. Discard removes both.
- The partner's phone shows their half as a workout in progress and can log to it as well.
- No pairing step: the two accounts are already each other's partner. A partner list and invitations belong to backlog epic 6.

Database: `workout_sessions.pair_id` added. Insert and update rules on workout_sessions, session_exercises, sets and program_state now allow any signed-in user, so one phone can write both people's rows. Approved by Ryan for sessions, lifts and sets; program_state was added because the partner's rotation and pinned notes live there. This must be narrowed to group members before anyone outside the household signs up (backlog 6.2).

Not built yet: partner effort rating on the finish screen, shared sessions for freestyle, routines and coach workouts, more than two people, a push invitation, and a faster live view between two phones (it follows the normal sync).

Tests: a second browser test (`tests/e2e/together.e2e.cjs`) runs a two-person workout and checks two linked sessions, each person's set in their own account, and both rotations advanced. It cannot test the real server rules; the iPhone checklist does.

## iPhone checklist for release A, part 2

1. Accept "Update available" on both phones.
2. On Ryan's phone, Today shows "Training with Stella" switched on and the button reads "Start workout together". Start it.
3. The workout screen shows Ryan and Stella at the top with Ryan selected. Log Ryan's first set: the screen switches to Stella with her own weights. Log hers: it switches back and the rest timer starts.
4. On Day B (or by swapping the day), Ryan's lift is pull-ups where Stella's is lat pulldown.
5. Tap the other name at any time to switch by hand. Notes, swaps and the queue apply to whoever is selected.
6. Check the sync indicator on Today reports everything synced (this proves the phone was allowed to save Stella's rows). Within a minute or so Stella's phone shows "Workout in progress" with the sets logged for her.
7. Finish: the sheet says "Finish both workouts?". Afterwards each phone's history has that person's workout with their own sets, and each person's next workout has moved on.
8. Switch "Training with Stella" off: Start begins a workout for one person as before.

## Release B, part 1: any gym (done; iPhone checklist passed 2026-11-13)

Backlog epics 3 and 4, first pass.

Library (epic 4):
- 758 exercises: our own 86 plus 672 from the same public-domain source (free-exercise-db, pinned to one commit). Built by `scripts/build-library.mjs` into `src/data/library.json` (list data) and `src/data/library-steps.json` (how-to text, loaded only when an exercise is opened).
- Every exercise has a muscle group and an equipment tag: barbell, Smith bar, cable, landmine, dumbbell, bodyweight, machine, kettlebell, bands, EZ curl bar, medicine ball, exercise ball, other.
- Pictures for the added exercises are loaded from the source's own address and kept on the phone once seen. Not seen before and no signal means a letter tile. They are not in our repo or the offline bundle (about 70 MB otherwise).
- Machines, kettlebells and other equipment without plate math take any weight in 2.5 lb steps.

Gym profiles (epic 3):
- Settings, "Where I train": a home gym (our garage, carrying over the old plate setting) and a public gym that has everything. Places can be added, edited and removed. Each has equipment switches, bar weights, plate counts and a dumbbell range.
- Today: "Training at <place>, Change". The choice sets the plate math and what is recommended.
- Recommend, never restrict: the Library opens on what can be done here with a "Show everything" switch; swap search lists same muscle group, then what fits here, and marks the rest "not at <place>"; gap suggestions only offer what fits here.
- The old "Plates I own" card moved into the home gym's page.

Not done in this pass:
- The 4-day program is still built from our own 86 exercises. At a place missing some of that equipment the plan does not adapt yet (3.6, 3.7), and the wider library is not used by the plan or the coach.
- Weight units are pounds only (3.3). One "machine" switch covers all machines (3.2).
- Custom exercises (4.4), a review of the added names and text (4.5), other names in search (4.6), library in the database (4.8).
- The added exercises' text and pictures are public domain, so the rights check (4.9) is low risk, but self-hosting the pictures is needed before a launch.

Tests: 84 unit tests (9 new for the library, gyms and gym-specific plate math). Both browser tests pass.

## iPhone checklist for release B, part 1

1. Accept "Update available".
2. Library says "Search 758 exercises" and lists what you can do at Home gym. "Show everything" lists the rest, marked "not at Home gym".
3. Tap the Machine chip with "Show everything" on, and open one: steps and pictures load. (Pictures need signal the first time.)
4. Settings, Where I train, Home gym: the plate counts match what you had. Fix the 2.5 lb pair here if it still says 0.
5. Today, "Training at Home gym", Change, Public gym. Start a workout on a barbell lift, enter 315: it loads as three 45s a side. Smith lifts use a 25 lb bar (editable under Public gym).
6. Still at Public gym: in a workout, three dots, Choose any exercise, search "leg press", pick it. Any weight can be typed in 2.5 lb steps, with no plate picture.
7. Switch back to Home gym: 315 on the barbell loads with your own plates again, and Smith lifts go back to the 33 lb bar.
8. Settings, Where I train, Add a place: name it, switch equipment on and off, and it appears in the Today picker.

## Release B, part 2: the plan follows the place, your own exercises, better search (iPhone checklist passed 2026-11-13 except editing a new place, fixed below)

Backlog 3.6, 3.7, 4.4, 4.6.

Done:
- The 4-day plan now uses only what the chosen place has. A main lift whose equipment is missing is replaced by its closest alternative that can be done there, and Today says so ("Adapted for here: Goblet squat in place of Barbell back squat"). A slot whose whole pool is unavailable is filled from the wider library: same muscle group, our own exercises first, simple before advanced, never jumping drills.
- At the home gym and the public gym the plan is unchanged, because both have everything the program was written for. A shared workout builds both people's plans for the phone owner's place.
- Your own exercises: Library, "+ Add your own exercise" (name, muscle group, equipment, how it is logged, one side at a time). Saved in the person's settings, synced, and usable by both. They can be added to a workout, swapped in, and removed from their page. They count toward weekly sets for their muscle group.
- Search understands other names (RDL, OHP, DB, pullup, skull crusher, abs, delts, lats) and words in any order, and matches muscle group and equipment as well as the name. Used in the Library and in the workout's add and swap search.

Known limits:
- Stand-ins from the wider library are chosen by muscle group and difficulty only, so a bodyweight-only place gets a thinner, less balanced plan than a dumbbell place.
- Removing a custom exercise only works for the person who added it.
- The coach still knows only our own 86 exercises.

Tests: 92 unit tests (8 new: plans for full, dumbbell-only and no equipment; search; custom exercises).

## iPhone checklist for release B, part 2

1. Accept "Update available".
2. Settings, Where I train, Add a place: call it "Hotel", tap "Clear all", switch on Dumbbell only. Set its dumbbells to 5 to 50.
3. Today, Change, Hotel: the card lists dumbbell and bodyweight lifts only, and the line under "Training at Hotel" says which main lifts were replaced.
4. Change back to Home gym: your normal plan returns.
5. Library: search "rdl", "ohp" and "pullup". Each finds the right lifts.
6. Library, "+ Add your own exercise": add one (for example "Belt squat", Quads, Machine). It shows in the Library marked "yours".
7. In a workout, "+ Add exercise", search your new exercise and add it. Log a set. After a sync it also shows in the other phone's Library.
8. Open your exercise in the Library and remove it. The workout you logged keeps it in history.

## Fixes after the release B, part 2 checklist (waiting on a recheck)

- A newly added place could not be edited: its page redirected to Settings before the saved list had been read. Fixed, with a browser test.
- Quick edits to a place could overwrite each other. Each change is now applied to the latest saved copy, in order.
- "+ Add your own" moved to the top of the Library.
- Tapping the strip at the very top of the screen (clock and battery) scrolls the page back to the top.

Recheck on the iPhone: add a place, rename it, Clear all, switch on Dumbbell; "+ Add your own" is at the top of the Library; scroll far down the Library and tap the clock.

## Whole-page scrolling (built, waiting on the iPhone check)

Ryan asked for the native "tap the top of the screen to scroll up". The first attempt (an invisible button over the status bar) did nothing on the iPhone, because iOS keeps status-bar taps for itself and only scrolls the page as a whole. The tab screens used a scrolling box inside a fixed page, which iOS ignores.

Change: the tab screens (Today, Library, Log, Progress, Us and everything opened from them) now scroll the page itself, with the tab bar, resume bar and update prompt fixed over the bottom. Sheets hold the page still while open. Each screen still opens at its top.

Not covered: the workout screen, the coach and the finish screen keep their own scrolling areas (they have fixed bars inside them), so the status-bar tap does not apply there.

Risks to watch on the iPhone: the fixed tab bar while the keyboard is open, and any rubber-band bounce at the top or bottom of a page.

Recheck: scroll far down the Library and tap the clock; open and close a sheet on a scrolled page; type in the Library search and in a Log note with the keyboard up; swipe back from Settings.

## Release C, part 1: program builder (done; iPhone checklist passed 2026-11-14)

Backlog 5.1, 5.2, 5.3, 5.9 in part.

Done:
- Four programs to choose from, all built from the same exercises, blocks, progression and place settings: the standard four days (legs, upper, core, full body), Full body (3 days), Upper / lower (4 days) and Push / pull / legs (3 days, or run twice for 5 to 6). Defined in `src/lib/program.ts` as `TEMPLATES`.
- "Build my program" (Settings, Edit my program, Change program): goal, days a week and longest session. It recommends a program with the reason, and any of the four can be chosen instead. Switching keeps history and records and restarts the rotation.
- Session length is respected: shorter sessions drop the lowest-priority accessories; main lifts always stay. Goal changes accessory work by one slot (more for muscle, fewer for strength).
- Sets and rep ranges can be set per main lift and per slot in the program editor, with "Back to automatic".
- Each person chooses their own program. In a shared workout the partner does the phone owner's day, with their own lift choices and numbers.
- The coach reads whichever program the person is on. The coach function was redeployed (version 5) with a day key that is no longer limited to A to D.
- Tests: 101 unit tests (9 new: every program and day in every block, pull choice, rotation, session length, goal, own numbers, builder).

Known limits:
- The builder chooses between four fixed programs; it does not generate a new split, and experience level is not asked.
- A program entered by hand from a coach or a book (5.10) is not built.
- Progression that uses effort more finely, plateau detection and fatigue-based recovery weeks (5.4 to 5.6) are not built.
- The coach has not been tried against a non-standard program with a real key.
- Settings still offers only 3 or 4 workouts a week in the profile card; the builder sets 2 to 6.

## iPhone checklist for release C, part 1

1. Accept "Update available". Today and your plan are unchanged.
2. Settings, Edit my program: a card at the top names your program. Tap Change program.
3. In the builder, change the goal and days a week: the Recommended badge moves and its reason changes.
4. Pick Upper / lower and tap Use this program. The editor now shows Upper 1, Lower 1, Upper 2, Lower 2, and Today shows Upper 1 next.
5. In the editor, tap a main lift: set Sets to 4 and the rep range to 5 to 8. Today and the preview show those numbers. "Back to automatic" restores them.
6. Start a workout together on the new program: Stella gets the same day with her own pull choice and weights.
7. Builder, Longest session 30 min, save: Today's workout is shorter and still has both main lifts.
8. Ask the coach "What is my program this week?": it describes the new days, not legs, upper, core, full body.
9. Switch back to "Legs, upper, core, full body" and 60 or 75 minutes if you want your old plan. Your earlier program changes are still there.

## Release C, part 2: groups (done; iPhone checklist passed 2026-11-14, including a real invitation, leave and account deletion)

Backlog 6.1, 6.2, 6.3 in part, 6.4, 6.5, 6.7.

Database (`20261114000000_groups.sql`, applied):
- `groups`, `group_members` (one group per person, up to 6) and `invites` (8-character code, one use, 7 days).
- Every sharing rule now reads "me and the members of my group" through `my_people()`. This replaces "any signed-in user", including the wide write rule added for shared workouts. Ryan and Stella were placed in one group, so nothing changes for them.
- Accounts are by invitation only. The database refuses a new user unless the `join` function created it; the earlier "exactly two accounts" rule is gone.
- Functions: `create_invite`, `accept_invite`, `leave_group`, `delete_my_account`.
- Checked in rolled-back transactions: both members see all 24 sessions and 432 sets, an outsider sees nothing; own invite refused; used and made-up codes refused; leaving shows only own data; rejoining restores sight; a sign-up without an invitation is refused.

Server functions: `join` (new: invitation code, name, email, password to account in the inviter's group), `notify` (workout and cheer notifications and the Sunday summary now stay inside the group).

App:
- Sign-in screen: "I have an invitation".
- Settings, Training partners: who is in your group, Invite a partner (code with a share button), enter a code from someone else, Leave this group.
- Settings: Delete my account (two confirmations).
- After joining or leaving, other people's rows are removed from the phone and everything is read again. At launch the phone also drops copies of anyone it can no longer see.
- On your own, the Us tab points to the invitation in Settings.

Known limits:
- The `join` function has not been run end to end: this build environment cannot reach the server, and a real run creates a real account. The first invitation is the test.
- No password reset, email confirmation or Sign in with Apple (6.3). The invited person's email is not verified.
- With more than two people in a group, the app still treats one of them as "the partner" for shared workouts and the Us tab (2.8, 6.8).
- Per-person privacy choices beyond measurements (6.6) and paged sync for large histories (6.9) are not built.
- The security advisor flags the five new functions as callable by signed-in users. That is intended: each acts only for the caller.
- Leaked-password protection is still off in the Supabase dashboard.

## iPhone checklist for release C, part 2

1. Accept "Update available" on both phones. Everything looks as before: each of you still sees the other on the Us tab, and the sync indicator is clean.
2. Do one shared workout set and check it syncs to the other phone (the write rule changed).
3. Settings, Training partners lists the other person. Tap Invite a partner: an 8-character code appears with Send it.
4. To test a new account, use a second email address you own: sign out on one phone (after it has synced), tap "I have an invitation", and enter the code, a name, that email and a password. It signs in as the new person, who sees both of you on the Us tab.
5. As the new person: Settings, Leave this group. The Us tab now shows only them, with the prompt to invite a partner.
6. As the new person: Settings, Delete my account. It returns to the sign-in screen, and signing in with that email no longer works.
7. Sign back in as yourself: your data returns after a sync.
8. A made-up code on the sign-in screen is refused with a clear message.

## Release D: redesign (in progress)

Design canvas with the six approved mockups: https://claude.ai/artifact/TmVyfo15Gz41xz11pTg6Q9 (sources in the build scratchpad, not in this repo). Ryan approved on 2026-11-14: four tabs with a new Plan tab; one set at a time on the workout screen; Progress with both a body figure and the bars. Each person has a colour everywhere: the phone owner lime, the partner blue.

### Part 1: tabs, Today, Plan (done; iPhone checklist passed 2026-11-14)

- Tabs are now Today, Plan, Progress, Us. Library and Log are no longer tabs: Library opens from Plan, and the daily log from Today. Both have a way back and swipe-back.
- Today: one card with who (a chip that switches between together and alone), where (a chip that opens the place picker), time, each main lift with today's weight and the reason, one Start button, and three links (Preview, Different day, Something else). Both people's weeks as two coloured rows. Weight, steps and sleep as tiles that open the number pad in place.
- Plan: the program with its days (tap a day to edit it), Change program, the places (tap to train there, Edit, Add a place), and links to the library, workout history and interval timer.
- Settings still holds its own copies of the program and places cards for now.

Still to build from the mockups: the one-set-at-a-time workout screen, the queue sheet with swaps in place, Progress with the body figure, and the four-step first run.

### iPhone checklist for release D, part 1

1. Accept "Update available". The tab bar shows Today, Plan, Progress, Us.
2. Today: the card shows a "With Stella" chip and a "Home gym" chip. Tapping the first switches to "On my own" and the button to "Start workout"; tapping again switches back.
3. The place chip opens the picker; choosing Public gym changes the chip.
4. Each main lift shows today's weight on the right and a reason under its name.
5. Under the card, two coloured rows show each of your weeks.
6. Tap the Weight tile, enter a number, Done: the tile shows it. Same for Steps and Sleep. "Full daily log" opens the old Log page, with a Today link back.
7. Plan tab: tap a day and the editor opens on that day. Tap Public gym, then Home gym: "Here now" moves. Exercise library opens the Library with a back button.
8. Start a workout from Today and finish it: nothing else has changed yet.

### Part 2: workout screen, Progress figure, shared styles (done; iPhone checklist passed 2026-11-14 with the two fixes below)

Ryan's feedback on part 1: it worked, but screens outside the ones just rebuilt still had the old look. And the first body figure in the mockup "looked horrible"; it was redrawn as a faceted muscle figure (39 pieces, front and back, mirrored from one half) and Ryan was sent a preview.

- Workout screen: one set at a time. Sets are chips (done ones show their numbers; tap one to un-tick it). The set in focus has weight and reps at 56 px with plus and minus under each, the plate breakdown, and last time's numbers. One full-width button marks it done: "Set done" alone, or "<name> did it" in that person's colour when training together, with a line saying who goes next. The three dots became a Swap button.
- Today's lifts moved from the bottom of the page into a sheet opened from an "Up next / All N lifts" bar. Drag, swipe, add and gap suggestions work inside it, and Undo shows there too.
- Finishing the last set of a lift now keeps that lift on screen, so "reps left in the tank" is always asked before moving on. Before, it was skipped unless the lift had been tapped.
- Progress: the body figure above the bars, each piece coloured by its muscle group's sets this week (none, low, part way, on target); bars in two columns with the same colours.
- Shared look: card corners 22 px and the large primary button everywhere; each person's turn in their own colour.
- Settings no longer repeats the places card; it links to Plan.

Not built yet from the mockups: swap suggestions opening in place inside the lift sheet, the four-step first run, the "Coach noticed" card and the Ryan / Stella / Both switch on Progress. Screens not yet restyled beyond the shared corners and buttons: Us, Log, Library, exercise page, history, coach, Settings.

### iPhone checklist for release D, part 2

1. Accept "Update available" and start a workout together.
2. The screen shows one set with large weight and reps. Plus and minus under each change it; tapping a number opens the pad.
3. The big button reads "Ryan did it" in lime. Tap it: the screen switches to Stella in blue, and the button reads "Stella did it". After hers, the rest timer starts.
4. Done sets appear as chips with their numbers. Tapping one un-ticks it.
5. After the last set of a lift, "Reps left in the tank" appears with a "Next" button.
6. The bar at the bottom shows what is up next. Tap it: the lift sheet opens. Drag to reorder, swipe left to remove (Undo appears in the sheet), swipe right to swap, tap a lift to jump to it.
7. The Swap button next to the lift name opens the swap choices.
8. Progress: the body figure shows, front and back, coloured where you have trained this week, with the bars beneath in matching colours.
9. Settings has a "Program and places" link to the Plan tab.

### Fixes after the part 2 checklist (confirmed 2026-11-14)

- Training together, the turn no longer passes when someone finishes their last set of a lift. Their "reps left in the tank" card stays, in their own colour, with a "Now <partner>" button that passes the turn. After the second person's card, "Next: <lift>" moves on.
- The body figure and bars now count what was actually worked: one set gives a full set to the lift's main muscle and half a set to each muscle that helps (squats now show on glutes and hamstrings as well as quads). The same counting feeds the gap suggestions and the plan's top-ups, so the numbers agree everywhere. Half sets show as, for example, 4.5.

### Part 3: swaps in place and the first run (swaps confirmed 2026-11-14; first run not yet seen on a phone)

- In the lift sheet, swiping a lift right now opens its swap choices under that row: up to three alternatives for the same movement (ones that fit the place first), "Search all", a "use it every time" switch and "Keep it". No second sheet.
- First run is four steps with a progress bar and Back: about you (name, weight); what you train for (goal, days, session length, with the recommended program shown); where you train (home with equipment chips, or a gym; pull-ups; ankle strap); who you train with (get a code to send, enter a code, or on your own). It saves the program, the home gym's equipment and the active place. A person who joined by invitation sees who they are connected to.
- New browser test `tests/e2e/onboarding.e2e.cjs` runs the four steps and checks Today shows the recommended program adapted to a dumbbell-only home gym.

Still to do in release D: restyle Us, the daily log, Library, the exercise page, history, the coach and Settings to the new look; the "Coach noticed" card and Ryan / Stella / Both switch on Progress.

### iPhone checklist for release D, part 3

1. Accept "Update available". In a workout, open the lift sheet and swipe a lift right: its swap choices open under it. Pick one: the lift changes and the panel closes. "Keep it" closes it without changing anything.
2. "Search all" in that panel opens the full library search for that lift.
3. First run only shows for someone with no workouts. To see it, invite a test account with a second email (as before): after signing in it walks through four steps, the last one saying who it is connected to. Delete the test account afterwards.

## Cardio page with map tracking (built, waiting on the iPhone checklist)

Ryan could not find where to log a run after the Log tab was removed, and asked for a cardio page with GPS tracking on a map.

- Cardio page (`/cardio`), opened from Today (a Cardio row, and "Something else") and from Plan: this week's minutes against 150, "Track a run or walk", "Log one by hand", the interval timer, and recent entries.
- Live tracking (`/cardio/track`): Run, Walk, Hike or Bike; distance, time and pace; the route drawn on an OpenStreetMap street map that follows you; Pause, Resume, Finish, Discard. A reload mid-run keeps the route, paused. Readings the phone is unsure of, tiny moves and impossible jumps are ignored (`src/lib/track.ts`, 4 unit tests).
- Each entry has a page with its map, miles, minutes and pace. `cardio_entries.route` (a list of points) was added to the database; partners can see each other's routes, as with all cardio.
- New browser test `tests/e2e/cardio.e2e.cjs` walks a simulated route and checks the saved distance and route.

Limits:
- Tracking only works while the app is open with the screen on. A home-screen web app cannot follow location with the phone locked or another app in front; only an App Store app can. The gap is joined with a straight line.
- Map pictures need a connection; without one the route shows on a plain ground. OpenStreetMap's free map service is fine for two people but not for a public launch.
- Time is saved in whole minutes, so pace on a short entry is approximate.
- Not tested on a real phone: the iPhone location prompt, accuracy, and battery use.

### iPhone checklist for cardio

1. Accept "Update available". Today has a Cardio row. Open it.
2. Tap "Track a run or walk", choose Walk, Start. Allow location when iPhone asks.
3. Walk outside for a couple of minutes with the screen on: the map follows you and distance, time and pace update.
4. Pause and Resume work. Finish saves it and shows the route on the map.
5. The entry appears under Recent on the Cardio page and counts toward this week's minutes.
6. "Log one by hand" still opens the daily log for cardio without a map.

## Next

Release D in BACKLOG.md (the design overhaul) or the open items of releases A to C. Open in epic 6: password reset and Sign in with Apple, groups of three or more in the screens, privacy choices, paged sync.

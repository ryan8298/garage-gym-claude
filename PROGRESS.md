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

## Release A, part 2: training together (built, waiting on the iPhone checklist)

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

## Next

After this checklist: release B in BACKLOG.md (equipment profiles and the larger exercise library, which must ship together). Remaining release A items: 2.4 faster live view, 2.6 invite, 2.7 joint goals, 2.8 three or more people.

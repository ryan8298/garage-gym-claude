# Garage Gym roadmap

Written 2026-11-13, after phases 1 to 8. It sets out what to build next and why, from two inputs: what people praise and complain about in the leading workout trackers, and the gaps in this app today.

For now this is a personal app for two people. The order below puts the features Ryan and Stella will feel every session first, and leaves everything that only matters for strangers until a decision to ship is made.

## What the market says

Sources are 2026 app comparisons, review roundups and Reddit summaries. Many of those pages are written by app makers or affiliates, so the rankings are unreliable; the praise and complaints below are the ones that repeat across sources.

| App | Praised for | Criticised for |
| --- | --- | --- |
| Strong | Fastest logging (2 to 3 taps a set), clean and simple, Apple Watch logging | No programs, no social layer, free tier limits |
| Hevy | Generous free tier, routines and volume analytics, friends feed | Feed and social alerts distract, import problems |
| Fitbod | Builds the workout for you, recovery-aware | Whole app behind a subscription after 3 workouts, suggestions feel generic |
| JEFIT | Large library, deep analytics | Ads, feels like a content platform |
| Boostcamp | Library of proven programs | Analytics behind Pro, no Apple Watch app |
| MacroFactor Workouts | Smart progression, control over the program, analytics | Apple Watch support |
| Ladder | Coach-built programs | Subscription only |

Complaints that repeat across all of them: features moved behind paywalls, lost or unsynced workouts, watch sync failures, too many taps to log, bloat, generic auto-generated workouts, rigid programs, unreliable rest alerts, no export, and weak support for two people who train together.

What people stay for: logging speed, a visible record of progress, a plan they trust, and not being charged for the basics.

## Where this app stands

| What matters | Status today |
| --- | --- |
| Logging speed | Good: number pad, carried weights, plate math. Not yet measured against Strong's 2 to 3 taps. |
| Never losing data, working offline | Strong: saves on the phone first, syncs later. |
| A plan that adapts | Good on paper: rotating program, progression, coach. Untested over weeks. |
| Flexibility | Partial: swap and reorder, but no custom exercises and no editing of sets and reps. |
| Two people training together | Partial: feed, cheers and summary, but each person logs alone. |
| Recovery awareness | Missing: no effort per set, no muscle freshness. |
| Conditioning | Missing: Day C has no interval timer. |
| Watch, Apple Health, lock-screen timer | Not possible as a home-screen web app. |
| Paywalls, ads, bloat, lock-in | None, and export exists. |

## Principles to protect

1. Logging a set stays the fastest thing in the app. No feature may add a tap to it.
2. A logged set is never lost. Every new feature saves on the phone first.
3. Every suggestion can explain itself in one sentence. This is the answer to "generic AI" complaints.
4. The plan bends: any exercise, day or number can be changed without breaking the rest.
5. No feed of strangers, no articles, no streak pressure beyond what the two of you chose.

## Roadmap

### Stage 1: use it for four weeks (now)

Train on the app as it is. The biggest open risk is whether exercise choices and weight suggestions feel right over time, and only real use shows that. Keep a short list of every moment the app slowed you down or suggested something odd.

Exit: four weeks of real workouts from both people.

### Stage 2: everyday gaps (can start alongside stage 1)

Small features used every session.

- Pinned notes per exercise (rack heights, bench notch) that show every time.
- Effort per set: one optional tap for "reps left". The data column already exists.
- Last time's numbers shown on each set row, not only in the summary card.
- Custom exercises, with station and muscle group so plate math and volume still work.
- Sets and reps editable per lift in the program editor.
- Saved routines: name a freestyle workout and reuse it.
- Count the taps to log a set and remove any that are not needed.

### Stage 3: train together

The feature no leading app does well, and the one that fits how you train.

- A shared session on one phone: both people's sets for the same lift on one screen, alternating, with one rest timer.
- Each person keeps their own weights, history and records.
- Works from either phone and syncs to both accounts.
- Partner's current set visible live when you each use your own phone.

### Stage 4: conditioning for Day C

- Interval timer: work and rest lengths, rounds, sound cues, screen stays on.
- A small set of equipment-free and dumbbell circuits, logged as cardio minutes.
- Coach can build a circuit on request.

### Stage 5: smarter programming

Depends on stage 1 history and stage 2 effort data.

- Progression uses effort: an easy 8 moves up sooner than a hard 8.
- Plateau detection per lift, with a specific proposed change.
- Recovery view: which muscles are fresh, on a body outline.
- Recovery week triggered by signs of fatigue as well as the calendar.
- "Why this?" on every suggested weight and every rotated exercise.
- Streamed coach replies.

### Stage 6: insight and motivation

- Per-lift charts for best set, session volume and total reps.
- Monthly review: what changed in strength, body weight, measurements and photos.
- Milestones chosen for meaning (first bodyweight squat, 50th workout), not daily badges.
- A shareable image of a finished workout.

### Stage 7: decide whether to ship

A decision point, not a build. If the answer is yes, the work below starts; none of it is worth doing for two people.

Needs a real App Store app (a native shell around this code, or a rewrite):

- Apple Watch logging, Apple Health sync, lock-screen rest timer and reliable rest alerts.
- These are the most common requests in the category and the hard limit of the current form.

Needs product changes:

- Households or pairs of any size in place of two fixed accounts, with invitations.
- Equipment profiles, so the program and plate math fit any gym, not one garage.
- A general first-run flow that builds a program from goals, days and equipment.
- Import from Strong and Hevy exports, since switching cost is a top reason people stay put.
- Android testing.
- Account deletion, privacy policy, terms, and support.

Needs a business decision:

- Pricing that avoids the category's worst complaint: logging, history and export free for good; charge only for what costs money to run, which is the coach.
- A per-person cap or metering for coach use, because each message is paid for.
- Rights check on exercise images and text for commercial use.

## Not planned

- Nutrition tracking: out of scope by choice. Revisit only as a link to a dedicated app.
- A public social feed, leaderboards or challenges with strangers.
- Articles, videos or other content.

## Sources

- https://www.sensai.fit/blog/hevy-vs-strong-vs-fitbod-vs-jefit
- https://www.jefit.com/blog/best-workout-apps-for-2026-top-7-options-tested-and-reviewed
- https://www.boostcamp.app/best/workout-logging
- https://unstar.app/blog/strava-strong-fitbod-nike-run-club-peloton-apple-fitness-workout-apps-ranked-2026
- https://setgraph.app/ai-blog/best-weightlifting-app-reddit
- https://getfitcraft.com/compare/best-fitness-apps-reddit
- https://www.garagegymreviews.com/best-workout-apps
- https://www.garagegymreviews.com/boostcamp-review
- https://repreturn.com/strong-app-review/
- https://alphaprogression.com/en/blog/best-strength-training-apps
- https://getfitcraft.com/blog/best-fitness-apps-for-couples

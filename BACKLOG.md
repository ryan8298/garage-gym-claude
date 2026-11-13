# Garage Gym backlog

Written 2026-11-13. This is the working list for growing the app from a two-person tool into a product. `ROADMAP.md` gives the reasoning and the market research; this file is the list of work.

## Product direction

A simple workout app for couples and lifting partners. One flat price, capped at $9.99 a month, raised only if AI costs force it. Works for a solo lifter or a small group, but training together is what it is sold on.

Still a personal app today. Nothing here commits to a launch date.

## How to read this

- Priority: **P0** blocks the direction above, **P1** important, **P2** valuable, **P3** later or optional.
- Size: **S** about a day, **M** a few days, **L** one to two weeks, **XL** more than two weeks. Sizes are rough estimates for planning order, not promises.
- "Today" describes how the app works now, so each item's starting point is clear.

## Rules that apply across the backlog

- **Recommend, never restrict.** Equipment, location and program shape what the app suggests and the order things are listed in. They never remove an exercise from what a person can choose. Someone who trains at home and at a public gym sees the full library in both places.
- **Any lift can be swapped for any other.** Recommendations lead; the whole library is always one tap further.

## Suggested order

1. Release A, better for the two of you: epics 1 and 2 (logging and training together).
2. Release B, any gym: epics 3 and 4 (equipment profiles and the larger library). These two must ship together.
3. Release C, any person: epics 5 and 6 (program builder and groups).
4. Release D, the redesign: epic 7, done once the features above have settled what the screens must hold.
5. Release E, launch readiness: epics 8 to 11.

Epic 7 comes after 3 to 6 on purpose. Redesigning first would mean redesigning twice.

---

## Epic 1: logging that beats the fastest apps

Status 2026-11-13: built and deployed, waiting on the iPhone checklist. 1.1: a set with history takes one tap; a first-time lift takes one weight entry, then one tap a set. 1.3 already existed per lift (asked after the last set, and used by the weight suggestions); per-set effort was not added. 1.5 is covered by sets arriving pre-filled. 1.8 is done with Move earlier and Move later buttons, not drag.

Today: number pad, carried weights, plate math, rest timer, set types. Notes belong to one workout. Effort is not recorded.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 1.1 | Count taps to log a set against Strong's 2 to 3 and remove any extra | P0 | S |
| 1.2 | Pinned note per exercise that shows every session (rack height, bench notch) | P1 | S |
| 1.3 | Effort per set: optional "reps left" tap. Column exists, no screen for it | P1 | S |
| 1.4 | Last time's weight and reps shown on each set row | P1 | S |
| 1.5 | One-tap "same as last set" and "same as last time" | P1 | S |
| 1.6 | Saved routines: name a freestyle workout and reuse it | P2 | M |
| 1.7 | Interval timer (work, rest, rounds) for conditioning days | P2 | M |
| 1.8 | Reorder, add and remove lifts during a workout by drag | P2 | M |
| 1.9 | Undo for delete set, skip lift and discard workout | P2 | S |

## Epic 2: training together (the headline feature)

Status 2026-11-13: 2.1, 2.2, 2.5 built and confirmed on both phones; 2.3 where the two programs differ. Open: 2.4, 2.6, 2.7, 2.8, 2.9.

Today: each person logs alone. The Us tab shows a feed, cheers, a weekly comparison and a Sunday summary.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 2.1 | Shared session on one phone: both people's sets for a lift on one screen, alternating turns, one rest timer | P0 | L |
| 2.2 | Each person keeps their own weights, targets, history and records inside a shared session | P0 | M |
| 2.3 | Partners on different programs or different lifts in the same session (one squats while the other does lunges) | P1 | M |
| 2.4 | Live view across two phones: see your partner's current set and timer | P1 | L |
| 2.5 | "Your turn" cue and a shared rest timer that follows whoever just lifted | P1 | S |
| 2.6 | Invite to train: start a session and pull the partner in with a notification | P2 | M |
| 2.7 | Joint goals and a shared streak ("we trained 3 times this week") | P2 | M |
| 2.8 | Sessions of three or more people | P2 | M |
| 2.9 | Training solo while the partner is away: the plan adjusts spotter-dependent lifts | P2 | S |

## Epic 3: equipment profiles

Status 2026-11-13: first pass built (3.1, 3.2 as broad tags, 3.4, 3.5, 3.8 by using one phone's choice, 3.9, 3.10; 3.3 without kg). Open: 3.6 and 3.7 for the program itself, kg, finer machine list.

Today: the equipment is fixed in the code. One rack, one barbell at 45 lb, a Smith bar at 33 lb, two cables, dumbbells 5 to 50 lb, an editable plate count. Every exercise is tagged to one of those stations.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 3.1 | A gym profile: name, type (home, commercial, hotel, outdoors) and a list of equipment | P0 | L |
| 3.2 | Equipment catalogue to pick from: bars, racks, Smith, cables, machines, benches, dumbbells, kettlebells, bands, pull-up bar, cardio machines | P0 | M |
| 3.3 | Details that drive the math: each bar's weight, plate inventory, dumbbell range and steps, cable ratio, weight units (lb and kg) | P0 | L |
| 3.4 | "Commercial gym" preset that assumes everything, so no one fills in a long form | P0 | S |
| 3.5 | Several profiles per person, with a switch at the start of a workout (home, work gym, travel) | P1 | M |
| 3.6 | The plan, the library and the coach all filter by the active profile | P0 | L |
| 3.7 | Edit equipment later; the program adapts and says what changed | P1 | M |
| 3.8 | A shared profile for partners who train in the same place | P1 | S |
| 3.10 | Where am I training? Asked before a workout starts (home gym, public gym, or a saved profile). The answer ranks and recommends; it never hides an exercise from being chosen | P0 | M |
| 3.9 | Move plate math and loading rules from fixed code to profile data | P0 | L |

## Epic 4: exercise library

Status 2026-11-13: first pass built (4.1 at 758 exercises, 4.2 for group and equipment, 4.10). Open: 4.3 substitution map beyond same muscle group, 4.4, 4.5, 4.6, 4.7, 4.8, 4.11, and self-hosted pictures.

Today: 86 exercises, 69 with pictures, chosen for one garage. No custom exercises.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 4.1 | Expand to several hundred exercises. The public-domain source already in use has about 870 | P0 | L |
| 4.2 | Tag every exercise with required equipment, primary and secondary muscles, movement pattern and difficulty | P0 | L |
| 4.3 | Substitution map: for any exercise, the closest alternatives with the equipment at hand | P0 | M |
| 4.4 | Custom exercises, with the same tags so volume and plate math still work | P1 | M |
| 4.5 | Review pass on names, instructions and pictures; the source text is uneven | P1 | L |
| 4.6 | Search that handles other names ("RDL", "skull crusher") and filters by muscle and equipment | P1 | M |
| 4.7 | Short demo clips or consistent illustrations in place of mixed photos | P2 | XL |
| 4.8 | Move the library from a file in the app to the database, so it can grow without an app update | P1 | M |
| 4.10 | Swapping draws on the whole library: recommended alternatives first (same movement, then same muscle group, then what fits the equipment where you are), with everything else still searchable. Today the recommended list is short because the library is 86 exercises | P0 | M |
| 4.11 | Swap any lift for any exercise in the program itself, not only for today. Today a program-level swap is limited to each main lift's listed alternatives | P1 | M |
| 4.9 | Rights check on all exercise media and text for commercial use | P0 | S |

## Epic 5: a program for anyone

Today: one hand-built 4-day program with fixed main lifts, rotating accessory slots, 4-week blocks and a recovery week. The editor swaps and reorders but cannot change sets, reps or the split.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 5.1 | Program builder: goal, days per week, session length, experience and equipment produce a plan | P0 | XL |
| 5.2 | Standard splits as templates: full body, upper/lower, push/pull/legs, and the current 4-day plan | P0 | L |
| 5.3 | Edit sets, reps and rest per lift; add and remove slots and days | P1 | M |
| 5.4 | Progression that uses effort data: an easy set moves up sooner | P1 | M |
| 5.5 | Plateau detection with a specific proposed change | P1 | M |
| 5.6 | Recovery week triggered by fatigue signs as well as the calendar | P2 | M |
| 5.7 | Missed-week handling: the plan resumes sensibly after a break | P1 | S |
| 5.8 | "Why this?" on every suggested weight and every chosen exercise | P1 | M |
| 5.9 | Paired programs: two plans built to run in the same session with shared equipment | P1 | L |
| 5.10 | Bring-your-own program: enter a plan from a coach or a book | P2 | L |

## Epic 6: more than two people

Today: two accounts created by hand. Every signed-in user can read every other user's shared data, because the app assumes they are partners. No sign-up, no invitations.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 6.1 | Groups: a person belongs to one or more small groups (a couple, a lifting crew) | P0 | L |
| 6.2 | Rewrite data access so people see only their own group's data. Today's rule would expose everyone to everyone | P0 | L |
| 6.3 | Sign-up, email confirmation, password reset, Sign in with Apple | P0 | M |
| 6.4 | Invite a partner by link or code | P0 | M |
| 6.5 | Solo mode: everything works with no partner, with gentle prompts to invite one | P0 | M |
| 6.6 | Per-person privacy choices for weight, measurements and photos | P1 | S |
| 6.7 | Leave a group, remove a member, delete account and data | P0 | M |
| 6.8 | The Us tab redesigned for one, two or several people | P1 | M |
| 6.9 | Sync that scales: pull only your group's changes, and page through long histories | P1 | L |

## Epic 7: design and experience overhaul

Today: a consistent dark design built screen by screen across eight phases. It was shaped by two known users and one garage.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 7.1 | Usability review with people who have never seen the app; fix what they stumble on | P0 | M |
| 7.2 | Rethink the tabs around what people do: train, look back, be together, ask the coach | P1 | L |
| 7.3 | New first-run flow: goal, equipment, partner invite, first workout in under two minutes | P0 | L |
| 7.4 | The workout screen redesigned for shared sessions and one-handed use | P0 | L |
| 7.5 | A Today screen that answers "what do I do now" for solo, pair and rest days | P1 | M |
| 7.6 | Design system pass: type scale, spacing, components, icons, written down | P1 | M |
| 7.7 | Light theme and system text-size support | P2 | M |
| 7.8 | Accessibility: VoiceOver labels, contrast, tap targets, reduced motion | P1 | M |
| 7.9 | Body-outline muscle map for volume and recovery | P2 | M |
| 7.10 | Richer charts: best set, volume, total reps, compare two people | P2 | M |
| 7.11 | Finish screen and a shareable workout image | P2 | M |
| 7.12 | Milestones that mean something, shown to both partners | P2 | S |
| 7.13 | Monthly review: strength, body weight, measurements, photos | P2 | M |
| 7.14 | Brand: name, icon, voice. "Garage Gym" is close to existing fitness brands and stops fitting once commercial gyms are supported | P1 | M |

## Epic 8: the coach at scale

Today: one large model answers every question, 30 messages a day each, billed to one API key. Replies arrive whole.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 8.1 | Measure real cost per message and per active person from the usage already recorded | P0 | S |
| 8.2 | Send simple questions to a cheaper model and keep the large one for reviews and program changes | P0 | M |
| 8.3 | Monthly allowance per subscription with a clear meter, in place of a daily cap | P0 | M |
| 8.4 | Streamed replies | P2 | M |
| 8.5 | Proactive notes: the coach flags a plateau or a skipped muscle group without being asked | P1 | M |
| 8.6 | Coach for the pair: advice that considers both people's sessions | P1 | M |
| 8.7 | A test set of questions with expected behaviour, run before any prompt or model change | P1 | M |
| 8.8 | Coach proposals extended to sets, reps and whole-day changes | P2 | M |

## Epic 9: a real App Store app

Today: a home-screen web app. It cannot use Apple Watch, Apple Health, the lock screen or reliable timed alerts, and it cannot be found in the App Store.

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 9.1 | Decide between wrapping the current code in a native shell and rebuilding natively. Recommendation: wrap first | P0 | S |
| 9.2 | Native shell with App Store and TestFlight delivery | P0 | L |
| 9.3 | Rest timer on the lock screen and Dynamic Island, with a reliable alert | P0 | L |
| 9.4 | Apple Health: read weight, steps and sleep; write workouts | P1 | L |
| 9.5 | Apple Watch: log sets and see the timer | P1 | XL |
| 9.6 | Haptics, native share sheet, home-screen widget | P2 | M |
| 9.7 | Android release | P2 | L |
| 9.8 | Import from Strong and Hevy exports | P1 | M |

## Epic 10: business and launch

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 10.1 | Pricing model decided (see open questions) | P0 | S |
| 10.2 | Subscriptions through the App Store, with one subscription covering a partner | P0 | L |
| 10.3 | Free period or free tier defined; logging and export never locked | P0 | S |
| 10.4 | Privacy policy, terms, health disclaimer | P0 | M |
| 10.5 | Landing page and App Store listing built around training together | P1 | M |
| 10.6 | Closed beta with 10 to 20 pairs before any public launch | P0 | M |
| 10.7 | Support inbox and an in-app way to report a problem | P1 | S |
| 10.8 | Privacy-respecting usage measurement, to see where people drop off | P1 | M |

## Epic 11: reliability and operations

| ID | Item | Priority | Size |
| --- | --- | --- | --- |
| 11.1 | Error reporting from phones | P0 | S |
| 11.2 | Separate test and live databases | P0 | M |
| 11.3 | Database backups tested by restoring one | P0 | S |
| 11.4 | Automated tests run on every change before deploy | P1 | M |
| 11.5 | Load check on sync with thousands of users' worth of data | P1 | M |
| 11.6 | Turn on leaked-password protection and review all access rules | P0 | S |
| 11.7 | Scheduled notifications in each person's own time zone | P2 | S |

---

## Open questions on pricing

These need an answer before 10.1 and affect the pitch.

1. **Per person or per pair?** $9.99 a month is at the top of the category; Hevy Pro and Strong cost roughly half that or less on annual plans. $9.99 covering both partners would be a strong offer and fits the positioning. $9.99 each would be hard to sell.
2. **Apple's cut.** The App Store keeps 15 to 30 percent, so $9.99 nets about $7 to $8.50.
3. **What the coach costs.** Unknown until 8.1 is done. A heavy user on the largest model could cost several dollars a month, which is why 8.2 and 8.3 are P0.
4. **The price promise.** "Never raised unless AI costs force it" is a good promise and a binding one. Consider promising it to existing subscribers only, so new-customer pricing can still change.
5. **Is there a free tier?** The category's loudest complaint is paywalled basics. Free logging with a paid coach and paid partner features is one answer, but it leaves the headline feature behind the paywall.

## Not on the backlog

- Nutrition tracking.
- A public feed, leaderboards or challenges among strangers.
- Articles and other content.

# Garage Gym (Claude build)

A private, offline-first workout tracker for two people, built as an installable iPhone web app for a RitFit M1 Pro home gym.

Stack: Vite, React, TypeScript, Tailwind, vite-plugin-pwa, Dexie (IndexedDB) with a sync outbox, Supabase (Postgres, Auth, Row Level Security), hosted on Vercel.

See `PROGRESS.md` for what is built and what comes next.

## How saving works

1. Every change is written to the phone's own database and to an outbox in one transaction, then shown as saved. No network is involved.
2. The sync engine sends outbox rows to Supabase as upserts keyed by ids made on the phone, parents before children. Sending a row twice cannot create a duplicate.
3. An outbox entry is removed only after the server confirms the write, and only if the row was not edited again in the meantime.
4. Conflicts are last write wins on `updated_at`. The database refuses older writes.
5. Pulls use a server-side `synced_at` cursor and never overwrite a row that has unsent changes.
6. Being offline, or having an expired sign-in, never signs you out or blocks logging.

## Local development

```bash
npm install
```

```bash
cp .env.example .env.local
```

Fill in the Supabase URL and publishable key, then:

```bash
npm run dev
```

```bash
npm test
```

## Supabase

Project: `garage-gym` (ref `kfmxfnayiaxducmcexye`). The schema in `supabase/migrations` is already applied.

One-time steps in the Supabase dashboard:

1. Authentication, Sign In / Providers: turn off "Allow new users to sign up". (The database also refuses a third account on its own.)
2. Authentication, Users, Add user, Create new user: once for Ryan and once for Stella, with "Auto Confirm User" ticked.
3. Each person sets their display name in the app under Settings.

Passwords are reset from the same Users page.

## Vercel

Environment variables, for Production and Preview:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_KEY` (the publishable key; safe in the browser because Row Level Security protects the data)

Every push to `main` deploys. The installed app shows "Update available" when a new version is ready and never reloads during a workout.

## Installing on iPhone

1. Open the production address in Safari.
2. Share, Add to Home Screen, Add.
3. Open it from the Home Screen icon and sign in once.

The app shows these steps itself if it is opened in Safari.

## Adding an exercise or a video

- Exercise: add a line to `scripts/catalog.mjs` (name, muscle group, equipment, how it is measured, setup note, and either the matching name in free-exercise-db or your own steps), then run `node scripts/build-exercises.mjs` and commit the result. To use it in the program, add its key to a pool in `src/lib/program.ts`.
- Video: open the exercise in the app, tap Add video and paste a YouTube link. It is saved to your account and plays inside the app.

Exercise pictures and instructions come from [free-exercise-db](https://github.com/yuhonas/free-exercise-db), which is in the public domain (Unlicense).

## Layout

```
src/lib/         database, sync engine, sign-in, dates, platform checks
src/components/  UI kit: cards, buttons, bottom sheet, number pad, sync badge
src/screens/     Today, Log, Settings, Sign in
supabase/        migrations
tests/           sync engine tests
scripts/         icon generator
```

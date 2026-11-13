// Builds src/data/classes.json and public/classes/*.jpg: follow-along sessions
// (mobility and mat work) whose pictures come from the same public-domain
// exercise set as the library. Yoga is added separately, with credited photos.
// Run: node scripts/build-classes.mjs [path/to/exercises.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}`
const local = process.argv[2]
const dataset = local ? JSON.parse(readFileSync(local, 'utf8')) : await (await fetch(`${BASE}/dist/exercises.json`)).json()
const byName = new Map(dataset.map((e) => [e.name, e]))

// [name in the exercise set, name shown, seconds, each side?, cue]
const s = (src, name, seconds, cue, side = false) => ({ src, name, seconds, cue, side })
const CLASSES = [
  {
    id: 'mobility_morning', kind: 'mobility', title: 'Whole-body loosen up', level: 'Easy', needs: [],
    about: 'An unhurried loosen-up for stiff mornings and rest days.',
    steps: [
      s('Cat Stretch', 'Cat stretch', 45, 'On hands and knees, round your back up slowly, then let it sink. Move with your breath.'),
      s("Child's Pose", "Child's pose", 60, 'Sit back on your heels, arms long in front, forehead down. Breathe into your back.'),
      s("World's Greatest Stretch", "World's greatest stretch", 40, 'Long lunge, both hands inside the front foot, then reach the inside arm to the ceiling.', true),
      s('Kneeling Hip Flexor', 'Kneeling hip flexor', 40, 'Back knee down, tuck your tail under and ease the hips forward. Stay tall.', true),
      s('Seated Floor Hamstring Stretch', 'Seated hamstring', 45, 'Legs straight, hinge forward from the hips with a long back. No bouncing.'),
      s('Lying Glute', 'Lying glute stretch', 40, 'On your back, ankle over the opposite knee, pull the legs gently toward you.', true),
      s('Knee Across The Body', 'Knee across the body', 40, 'On your back, draw one knee across and let it fall, shoulders staying down.', true),
      s('Spinal Stretch', 'Seated twist', 40, 'Sit tall, cross one leg over and turn toward it. Lengthen as you breathe in, turn as you breathe out.', true),
      s('Shoulder Stretch', 'Shoulder stretch', 30, 'Draw one arm across your chest with the other. Keep the shoulder away from your ear.', true),
      s('Standing Lateral Stretch', 'Side bend', 30, 'Reach one arm up and over. Hips stay square, both feet heavy.', true),
      s('Standing Toe Touches', 'Standing forward fold', 40, 'Soft knees, let your head and arms hang. Roll up slowly at the end.'),
    ],
  },
  {
    id: 'mobility_legs', kind: 'mobility', title: 'After leg day', level: 'Easy', needs: [],
    about: 'Hips, quads, hamstrings and calves, while they are warm.',
    steps: [
      s('Quad Stretch', 'Quad stretch', 40, 'Heel toward your seat, knees together, hips pressed gently forward.', true),
      s('Seated Hamstring', 'Seated hamstring', 40, 'One leg long, fold over it from the hips with a flat back.', true),
      s('Lying Glute', 'Lying glute stretch', 40, 'Ankle over the opposite knee, pull both legs in.', true),
      s('IT Band and Glute Stretch', 'Outer hip stretch', 35, 'Cross one leg over and hug the knee toward the opposite shoulder.', true),
      s('Adductor/Groin', 'Inner thigh stretch', 45, 'Wide stance, sink toward one side keeping the other leg straight.', true),
      s('Kneeling Hip Flexor', 'Kneeling hip flexor', 40, 'Back knee down, tail tucked, hips forward.', true),
      s('Calf Stretch Hands Against Wall', 'Calf stretch', 35, 'Hands on the wall, back heel down and leg straight, lean in.', true),
      s("Child's Pose", "Child's pose", 60, 'Sit back on your heels and let your back let go.'),
    ],
  },
  {
    id: 'mobility_upper', kind: 'mobility', title: 'After upper-body day', level: 'Easy', needs: [],
    about: 'Chest, shoulders, lats and neck.',
    steps: [
      s('Shoulder Circles', 'Shoulder circles', 30, 'Slow, big circles forward, then back.'),
      s('Chest And Front Of Shoulder Stretch', 'Chest and front shoulder', 40, 'Hands clasped behind you, lift the arms and open the chest.'),
      s('One Arm Against Wall', 'Chest stretch at the wall', 35, 'Palm on the wall at shoulder height, turn your body away from it.', true),
      s('Overhead Lat', 'Lat stretch', 35, 'One arm overhead, hold the wrist and lean away.', true),
      s('Upper Back Stretch', 'Upper back stretch', 40, 'Clasp your hands in front, round between the shoulder blades and push away.'),
      s('Triceps Stretch', 'Triceps stretch', 30, 'Elbow up by your ear, ease it back with the other hand.', true),
      s('Side Neck Stretch', 'Side neck stretch', 30, 'Ear toward shoulder, the opposite arm long and heavy.', true),
      s('Cat Stretch', 'Cat stretch', 45, 'Finish on hands and knees, rounding and releasing the spine.'),
    ],
  },
  {
    id: 'mat_core', kind: 'pilates', title: 'Mat core, pilates style', level: 'Moderate', needs: ['mat'],
    about: 'Controlled floor work for the deep core, hips and back. Slow and precise beats fast.',
    steps: [
      s('Pelvic Tilt Into Bridge', 'Pelvic tilt into bridge', 45, 'Flatten your lower back, then peel the spine up one bone at a time. Roll down the same way.'),
      s('Flat Bench Lying Leg Raise', 'Leg lowers', 40, 'On your back, lower both legs only as far as your lower back stays down.'),
      s('Scissor Kick', 'Scissors', 40, 'Legs long and low, switch them in small, even beats. Ribs down.'),
      s('Leg Pull-In', 'Double leg pull', 40, 'Draw both knees in, then reach the legs away without arching.'),
      s('Air Bike', 'Criss-cross', 40, 'Elbow toward the opposite knee, turning from the ribs, not the neck.'),
      s('Superman', 'Swimming', 40, 'Face down, lift opposite arm and leg and switch in a steady flutter.'),
      s('Side Bridge', 'Side plank', 30, 'Elbow under shoulder, one long line from head to heels.', true),
      s('Side Leg Raises', 'Side leg lifts', 40, 'On your side, lift the top leg without rocking the hips.', true),
      s('Plank', 'Plank', 40, 'Forearms down, squeeze your seat, breathe steadily.'),
      s('Cat Stretch', 'Cat stretch', 40, 'Round and release the spine to ease the back.'),
      s("Child's Pose", "Child's pose", 60, 'Rest back on your heels and breathe.'),
    ],
  },
]

mkdirSync('public/classes', { recursive: true })
const missing = []
const out = []
for (const c of CLASSES) {
  const steps = []
  for (const step of c.steps) {
    const found = byName.get(step.src)
    if (!found?.images?.length) {
      missing.push(`${c.id}: "${step.src}"`)
      continue
    }
    const file = `public/classes/${found.id}.jpg`
    if (!existsSync(file)) {
      const res = await fetch(`${BASE}/exercises/${found.images[0]}`)
      if (!res.ok) throw new Error(`image ${found.images[0]}: ${res.status}`)
      writeFileSync(file, Buffer.from(await res.arrayBuffer()))
    }
    steps.push({ name: step.name, seconds: step.seconds, side: step.side, cue: step.cue, image: `/classes/${found.id}.jpg` })
  }
  out.push({ id: c.id, kind: c.kind, title: c.title, level: c.level, needs: c.needs, about: c.about, steps })
}
if (missing.length) {
  console.error('Not found in the exercise set:\n' + missing.join('\n'))
  process.exit(1)
}
writeFileSync('src/data/classes.json', JSON.stringify(out, null, 1) + '\n')
console.log(out.map((c) => `${c.title}: ${c.steps.length} steps, ${Math.round(c.steps.reduce((n, x) => n + x.seconds * (x.side ? 2 : 1), 0) / 60)} min`).join('\n'))

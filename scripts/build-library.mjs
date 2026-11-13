// Builds the extended exercise library from the public-domain
// free-exercise-db dataset (Unlicense): every strength exercise that is not
// already in our hand-written catalog.
//   src/data/library.json        what the app needs to list, filter and log them
//   src/data/library-steps.json  the how-to text, loaded only when one is opened
// Run: node scripts/build-library.mjs [path/to/exercises.json]
import { readFileSync, writeFileSync } from 'node:fs'
import { catalog } from './catalog.mjs'

// Pinned to one commit so pictures and text cannot change underneath us.
export const COMMIT = 'f00c92c7dcf1216a928a52c3706c7ce8e2f71ed5'
const BASE = `https://raw.githubusercontent.com/yuhonas/free-exercise-db/${COMMIT}`
const local = process.argv[2]
const dataset = local ? JSON.parse(readFileSync(local, 'utf8')) : await (await fetch(`${BASE}/dist/exercises.json`)).json()

const KEEP = new Set(['strength', 'powerlifting', 'olympic weightlifting', 'strongman', 'plyometrics'])
const group = {
  quadriceps: 'quads', hamstrings: 'hamstrings', glutes: 'glutes', calves: 'calves', chest: 'chest',
  lats: 'back', 'middle back': 'back', traps: 'back', 'lower back': 'lower_back', shoulders: 'shoulders',
  biceps: 'biceps', triceps: 'triceps', forearms: 'forearms', abdominals: 'core', abductors: 'hips', adductors: 'hips', neck: 'neck',
}
const muscle = { quadriceps: 'quads', abdominals: 'abs', 'middle back': 'mid back', abductors: 'outer hip', adductors: 'inner hip' }
const plain = (m) => muscle[m] ?? m

/** The one piece of equipment an exercise depends on most. */
function equipOf(e) {
  const n = e.name.toLowerCase()
  if (/smith/.test(n)) return 'smith'
  if (/landmine|t-bar/.test(n)) return 'landmine'
  if (/\bez[- ]|e-z/.test(n) || e.equipment === 'e-z curl bar') return 'ez_bar'
  return (
    { barbell: 'barbell', dumbbell: 'dumbbell', cable: 'cable', machine: 'machine', kettlebells: 'kettlebell', bands: 'band', 'medicine ball': 'medicine_ball', 'exercise ball': 'exercise_ball', 'body only': 'bodyweight' }[e.equipment] ??
    (e.equipment === null ? 'bodyweight' : 'other')
  )
}
/** How its weight is entered and checked. Only our own bar, Smith bar, cables and dumbbells have plate math. */
const stationOf = (equip) => (['barbell', 'smith', 'cable', 'landmine', 'dumbbell', 'bodyweight'].includes(equip) ? equip : 'free')

const used = new Set(catalog.map((c) => c.src).filter(Boolean))
const taken = new Set(catalog.map((c) => c.name.toLowerCase()))
const items = []
const steps = {}
for (const e of dataset) {
  if (!KEEP.has(e.category) || used.has(e.name) || taken.has(e.name.toLowerCase())) continue
  if (e.equipment === 'foam roll' || !e.primaryMuscles.length) continue
  const equip = equipOf(e)
  const n = e.name.toLowerCase()
  const key = `x_${e.id.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`
  const measure = /farmer|carry|\bwalk\b/.test(n) && equip !== 'bodyweight' ? 'carry' : /plank|\bhold\b|isometric|wall sit|\bhang\b|l-sit/.test(n) ? 'time' : equip === 'bodyweight' ? 'bw' : 'wr'
  items.push({
    key,
    name: e.name,
    group: group[e.primaryMuscles[0]],
    station: stationOf(equip),
    equip,
    measure,
    side: /one[- ]arm|one[- ]leg|single[- ](arm|leg)|alternat/.test(n) && !/alternat/.test(n) ? true : /one[- ]arm|one[- ]leg|single[- ](arm|leg)/.test(n),
    level: e.level,
    ...(e.category === 'plyometrics' ? { plyo: true } : {}),
    ...(e.mechanic === 'compound' ? { compound: true } : {}),
    images: e.images.slice(0, 2).map((p) => `${BASE}/exercises/${p}`),
    primary: e.primaryMuscles.map(plain),
    secondary: e.secondaryMuscles.map(plain),
  })
  steps[key] = e.instructions.map((s) => s.trim()).filter(Boolean)
}
items.sort((a, b) => a.name.localeCompare(b.name))
writeFileSync('src/data/library.json', JSON.stringify(items) + '\n')
writeFileSync('src/data/library-steps.json', JSON.stringify(steps) + '\n')
const count = (f) => Object.entries(items.reduce((m, i) => ((m[i[f]] = (m[i[f]] ?? 0) + 1), m), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(', ')
console.log(`${items.length} extended exercises\nby equipment: ${count('equip')}\nby group: ${count('group')}\nby measure: ${count('measure')}`)

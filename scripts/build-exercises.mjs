// Builds src/data/exercises.json and public/exercises/*.jpg from the catalog
// and the public-domain free-exercise-db dataset (Unlicense).
// Run: node scripts/build-exercises.mjs [path/to/exercises.json]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { catalog } from './catalog.mjs'

const BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main'
const local = process.argv[2]
const dataset = local ? JSON.parse(readFileSync(local, 'utf8')) : await (await fetch(`${BASE}/dist/exercises.json`)).json()
const byName = new Map(dataset.map((e) => [e.name, e]))

// The dataset's muscle names, mapped to plainer ones.
const muscle = { quadriceps: 'quads', abdominals: 'abs', 'middle back': 'mid back', 'lower back': 'lower back', lats: 'lats', traps: 'traps', abductors: 'outer hip', adductors: 'inner hip' }
const plain = (m) => muscle[m] ?? m

mkdirSync('public/exercises', { recursive: true })
mkdirSync('src/data', { recursive: true })

const out = []
const missing = []
for (const item of catalog) {
  const { src, steps, ...rest } = item
  const entry = { ...rest, side: !!item.side, images: [], primary: [], secondary: [], steps: steps ?? [] }
  if (src) {
    const found = byName.get(src)
    if (!found) {
      missing.push(`${item.key}: "${src}"`)
    } else {
      entry.primary = found.primaryMuscles.map(plain)
      entry.secondary = found.secondaryMuscles.map(plain)
      if (!steps) entry.steps = found.instructions.map((s) => s.trim()).filter(Boolean)
      for (const [i, path] of found.images.slice(0, 2).entries()) {
        const file = `public/exercises/${found.id}-${i}.jpg`
        if (!existsSync(file)) {
          const res = await fetch(`${BASE}/exercises/${path}`)
          if (!res.ok) throw new Error(`image ${path}: ${res.status}`)
          writeFileSync(file, Buffer.from(await res.arrayBuffer()))
        }
        entry.images.push(`/exercises/${found.id}-${i}.jpg`)
      }
    }
  }
  if (entry.steps.length === 0) missing.push(`${item.key}: no steps`)
  out.push(entry)
}

if (missing.length) {
  console.error('Problems:\n' + missing.join('\n'))
  process.exit(1)
}
writeFileSync('src/data/exercises.json', JSON.stringify(out, null, 1) + '\n')
console.log(`${out.length} exercises, ${out.filter((e) => e.images.length).length} with images, ${out.filter((e) => !e.images.length).length} without`)

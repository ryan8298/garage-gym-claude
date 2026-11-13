import { cx } from './ui'

/**
 * A front and back figure with each muscle as its own piece, coloured by how
 * close that muscle group is to its weekly sets. Pieces are drawn for one
 * half of the body and mirrored, so the figure is always symmetrical.
 */
interface Piece {
  /** The muscle group it shows, or null for head, hands, knees and feet. */
  group: string | null
  mirror: boolean
  points: string
}

const FRONT: Piece[] = [
  { group: null, mirror: false, points: '89,8 111,8 120,20 121,38 113,54 100,60 87,54 79,38 80,20' },
  { group: null, mirror: false, points: '90,58 100,63 110,58 113,72 100,77 87,72' },
  { group: "back", mirror: true, points: '86,64 86,75 98,79 66,80 74,72' },
  { group: "shoulders", mirror: true, points: '63,82 49,86 39,98 37,116 46,122 57,106 62,92' },
  { group: "chest", mirror: true, points: '66,83 98,82 98,116 84,124 68,119 60,108 64,94' },
  { group: "biceps", mirror: true, points: '48,124 58,110 61,128 58,150 50,162 42,158 40,138' },
  { group: "triceps", mirror: true, points: '36,120 45,125 38,140 40,158 33,152 32,134' },
  { group: "forearms", mirror: true, points: '32,158 41,162 50,166 46,196 40,214 30,212 27,186' },
  { group: null, mirror: true, points: '29,216 40,218 40,234 34,244 26,238' },
  { group: "core", mirror: true, points: '86,127 98,121 98,144 85,146' },
  { group: "core", mirror: true, points: '85,149 98,147 98,170 85,171' },
  { group: "core", mirror: true, points: '85,174 98,173 98,208 90,202 86,190' },
  { group: "core", mirror: true, points: '67,122 83,128 82,172 84,192 88,204 74,200 66,178 64,148' },
  { group: "hips", mirror: true, points: '74,204 98,210 98,231 90,220 80,221' },
  { group: "quads", mirror: true, points: '63,202 72,207 79,224 77,266 72,308 63,300 56,264 56,228' },
  { group: "quads", mirror: true, points: '81,224 89,222 97,236 96,284 88,314 75,312 80,266' },
  { group: null, mirror: true, points: '66,314 87,318 85,334 68,333' },
  { group: "calves", mirror: true, points: '64,336 74,338 76,372 73,406 66,392 60,362' },
  { group: "calves", mirror: true, points: '77,338 86,338 91,360 88,384 82,406 77,406 79,372' },
  { group: null, mirror: true, points: '66,410 83,410 88,426 62,428' },
]
const BACK: Piece[] = [
  { group: null, mirror: false, points: '89,8 111,8 120,20 121,38 113,54 100,60 87,54 79,38 80,20' },
  { group: null, mirror: false, points: '90,58 100,62 110,58 112,66 100,70 88,66' },
  { group: "back", mirror: true, points: '87,68 99,72 99,96 84,88 64,80 74,74' },
  { group: "back", mirror: true, points: '84,91 99,99 99,138 90,120' },
  { group: "shoulders", mirror: true, points: '63,82 49,86 39,98 37,116 46,122 57,106 62,92' },
  { group: "back", mirror: true, points: '64,96 82,92 88,122 98,142 98,176 84,188 72,172 64,146 60,112' },
  { group: "lower_back", mirror: true, points: '86,191 98,180 98,206 84,204' },
  { group: "triceps", mirror: true, points: '48,124 58,110 61,128 58,150 50,162 42,158 40,138' },
  { group: "triceps", mirror: true, points: '36,120 45,125 38,140 40,158 33,152 32,134' },
  { group: "forearms", mirror: true, points: '32,158 41,162 50,166 46,196 40,214 30,212 27,186' },
  { group: null, mirror: true, points: '29,216 40,218 40,234 34,244 26,238' },
  { group: "core", mirror: true, points: '66,150 71,175 82,190 82,204 70,200 64,178' },
  { group: "glutes", mirror: true, points: '66,204 84,207 98,209 98,246 86,258 68,252 58,236 60,216' },
  { group: "hamstrings", mirror: true, points: '58,242 67,255 76,259 74,300 68,316 61,300 56,268' },
  { group: "hamstrings", mirror: true, points: '79,260 88,260 98,250 98,276 92,304 86,318 76,316 77,290' },
  { group: null, mirror: true, points: '68,320 86,322 84,332 70,332' },
  { group: "calves", mirror: true, points: '61,334 74,336 76,366 72,396 64,380 57,356' },
  { group: "calves", mirror: true, points: '77,336 87,336 92,356 88,382 80,398 78,368' },
  { group: null, mirror: true, points: '72,400 80,401 82,410 70,410' },
  { group: null, mirror: true, points: '68,412 83,412 86,426 64,428' },
]

export type Level = 'none' | 'low' | 'part' | 'full'
export function levelOf(sets: number, target: number): Level {
  if (sets <= 0) return 'none'
  if (sets >= target * 0.8) return 'full'
  return sets >= target * 0.4 ? 'part' : 'low'
}
export const levelFill: Record<Level, string> = { none: '#30363e', low: 'var(--color-danger)', part: 'var(--color-warn)', full: 'var(--color-accent)' }
export const levelBar: Record<Level, string> = { none: 'bg-raised', low: 'bg-danger', part: 'bg-warn', full: 'bg-accent' }
const levelWord: Record<Level, string> = { none: 'no sets', low: 'low', part: 'part way', full: 'on target' }

const mirrored = (points: string) =>
  points
    .split(' ')
    .map((p) => {
      const [x, y] = p.split(',')
      return `${200 - Number(x)},${y}`
    })
    .join(' ')

function Figure({ pieces, sets, target, label }: { pieces: Piece[]; sets: Record<string, number>; target: number; label: string }) {
  const groups = [...new Set(pieces.map((p) => p.group).filter((g): g is string => !!g))]
  const summary = groups.map((g) => `${g.replace('_', ' ')} ${levelWord[levelOf(sets[g] ?? 0, target)]}`).join(', ')
  return (
    <div className="flex flex-col items-center gap-1">
      <svg role="img" aria-label={`${label} of the body: ${summary}`} viewBox="14 0 172 436" className="block h-[270px] w-[107px]">
        {pieces.map((p, i) => {
          const fill = p.group ? levelFill[levelOf(sets[p.group] ?? 0, target)] : '#30363e'
          const common = { fill, stroke: 'var(--color-surface)', strokeWidth: 1.5, strokeLinejoin: 'round' as const, opacity: p.group ? 1 : 0.6 }
          return (
            <g key={i}>
              <polygon points={p.points} {...common} />
              {p.mirror && <polygon points={mirrored(p.points)} {...common} />}
            </g>
          )
        })}
      </svg>
      <span className="text-[11px] font-semibold tracking-[1px] text-muted">{label.toUpperCase()}</span>
    </div>
  )
}

export function BodyMap({ sets, target }: { sets: Record<string, number>; target: number }) {
  return (
    <div className="flex flex-col gap-2.5">
      <div className="grid grid-cols-2 gap-3">
        <Figure pieces={FRONT} sets={sets} target={target} label="Front" />
        <Figure pieces={BACK} sets={sets} target={target} label="Back" />
      </div>
      <div className="flex flex-wrap justify-center gap-x-3.5 gap-y-1 text-xs text-muted">
        {(
          [
            ['full', 'On target'],
            ['part', 'Part way'],
            ['low', 'Low'],
            ['none', 'None'],
          ] as [Level, string][]
        ).map(([level, text]) => (
          <span key={level} className="flex items-center gap-1.5">
            <span className={cx('h-2.5 w-2.5 rounded-full', levelBar[level], level === 'none' && 'border border-faint')} />
            {text}
          </span>
        ))}
      </div>
    </div>
  )
}

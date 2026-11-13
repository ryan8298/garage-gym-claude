import { useNavigate, useParams, Navigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from '../lib/auth'
import { db } from '../lib/db'
import { EQUIPMENT, equipLabels, equipmentHint, gymsOf, type Gym } from '../lib/gym'
import { PLATE_PAIRS } from '../lib/plates'
import { defaultProgram, saveProgram, useProgram } from '../lib/programState'
import { Button, Card, Label, RoundButton, cx, icons } from '../components/ui'

let queue: Promise<void> = Promise.resolve()

/** One place I train: what it has and what its bars and weights are. */
export function GymEditor() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const program = useProgram(user!.id)
  const gyms = gymsOf(program)
  const gym = gyms.find((g) => g.id === id)
  // Wait until the saved settings have been read: a place just added is not in the built-in list.
  const loaded = useLiveQuery(() => db.program_state.get(user!.id).then((r) => r ?? null), [user!.id])
  if (loaded === undefined) return null
  if (!gym) return <Navigate to="/settings" replace />

  // Each change is applied to the latest saved copy, one after another, so quick taps never undo each other.
  const update = (change: (g: Gym) => Partial<Gym>) => {
    const uid = user!.id
    queue = queue.then(async () => {
      const row = await db.program_state.get(uid)
      const list = gymsOf({ ...defaultProgram, ...(row?.data ?? {}) })
      await saveProgram(uid, { gyms: list.map((g) => (g.id === id ? { ...g, ...change(g) } : g)) })
    })
  }
  const stepper = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-lg'
  const Row = ({ label, value, onStep, by }: { label: string; value: string; onStep(dir: 1 | -1): void; by: string }) => (
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <span className="text-sm font-medium">{label}</span>
      <span className="flex items-center gap-1.5">
        <button aria-label={`${label}: less by ${by}`} className={stepper} onClick={() => onStep(-1)}>
          −
        </button>
        <span className="num w-16 text-center text-[15px] font-semibold">{value}</span>
        <button aria-label={`${label}: more by ${by}`} className={stepper} onClick={() => onStep(1)}>
          +
        </button>
      </span>
    </div>
  )
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))
  const has = (e: string) => gym.equipment.includes(e)

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">{gym.name}</h1>
          <span className="text-[13px] text-muted">This shapes what is recommended here. Every exercise can still be chosen.</span>
        </div>
      </header>

      <Card className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-xs text-muted">
          Name
          <input
            type="text"
            defaultValue={gym.name}
            maxLength={30}
            onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== gym.name && ((name) => update(() => ({ name })))(e.target.value.trim())}
            className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none focus:border-accent"
          />
        </label>
        <div className="grid grid-cols-2 gap-2" role="group" aria-label="Kind of gym">
          {(
            [
              ['home', 'Home gym'],
              ['public', 'Public gym'],
            ] as const
          ).map(([kind, label]) => (
            <button key={kind} aria-pressed={gym.kind === kind} onClick={() => update(() => ({ kind }))} className={cx('h-11 rounded-control border text-sm font-semibold', gym.kind === kind ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}>
              {label}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <Label>Equipment here</Label>
          <button className="h-9 px-1 text-xs font-semibold text-accent" onClick={() => update((g) => ({ equipment: g.equipment.length === EQUIPMENT.length ? [] : [...EQUIPMENT] }))}>
            {gym.equipment.length === EQUIPMENT.length ? 'Clear all' : 'Has everything'}
          </button>
        </div>
        {EQUIPMENT.map((e) => (
          <label key={e} className="flex min-h-[48px] items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="text-sm font-medium">{equipLabels[e]}</span>
              {equipmentHint[e] && <span className="text-xs text-muted">{equipmentHint[e]}</span>}
            </span>
            <input type="checkbox" role="switch" className="switch" checked={has(e)} onChange={(ev) => {
                // Read the switch now: by the time the change is applied the event is stale.
                const on = ev.target.checked
                update((g) => ({ equipment: on ? [...g.equipment.filter((x) => x !== e), e] : g.equipment.filter((x) => x !== e) }))
              }} />
          </label>
        ))}
        <span className="text-xs text-muted">Bodyweight exercises are always available.</span>
      </Card>

      {(has('barbell') || has('smith')) && (
        <Card className="flex flex-col gap-2">
          <Label>Bars</Label>
          {has('barbell') && <Row label="Barbell" value={`${gym.barbell} lb`} by="5 lb" onStep={(d) => update((g) => ({ barbell: clamp(g.barbell + d * 5, 15, 60) }))} />}
          {has('smith') && <Row label="Smith bar" value={`${gym.smith} lb`} by="1 lb" onStep={(d) => update((g) => ({ smith: clamp(g.smith + d, 0, 60) }))} />}
          {has('smith') && <span className="text-xs text-muted">Smith bars differ a lot between makers, often 15 to 45 lb. It is usually printed on the machine.</span>}
        </Card>
      )}

      {(has('barbell') || has('smith') || has('cable') || has('landmine')) && (
        <Card className="flex flex-col gap-3">
          <Label>Plates here (pairs)</Label>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            {PLATE_PAIRS.map((plate) => {
              const n = gym.plates[String(plate)] ?? 0
              const step = (d: number) => update((g) => ({ plates: { ...g.plates, [String(plate)]: clamp((g.plates[String(plate)] ?? 0) + d, 0, 6) } }))
              return (
                <div key={plate} className="flex items-center justify-between gap-2">
                  <span className="num text-sm font-medium whitespace-nowrap">{plate} lb</span>
                  <span className="flex items-center gap-1">
                    <button aria-label={`One fewer pair of ${plate} pound plates`} className={stepper} onClick={() => step(-1)}>
                      −
                    </button>
                    <span className="num w-5 text-center text-[15px] font-semibold">{n}</span>
                    <button aria-label={`One more pair of ${plate} pound plates`} className={stepper} onClick={() => step(1)}>
                      +
                    </button>
                  </span>
                </div>
              )
            })}
          </div>
          <span className="text-xs text-muted">Every suggested weight and plate breakdown here uses exactly these. Up to 6 pairs of each.</span>
        </Card>
      )}

      {has('dumbbell') && (
        <Card className="flex flex-col gap-2">
          <Label>Dumbbells</Label>
          <Row label="Lightest" value={`${gym.dumbbells.min} lb`} by="5 lb" onStep={(d) => update((g) => ({ dumbbells: { ...g.dumbbells, min: clamp(g.dumbbells.min + d * 5, 5, g.dumbbells.max) } }))} />
          <Row label="Heaviest" value={`${gym.dumbbells.max} lb`} by="5 lb" onStep={(d) => update((g) => ({ dumbbells: { ...g.dumbbells, max: clamp(g.dumbbells.max + d * 5, g.dumbbells.min, 200) } }))} />
          <Row label="Steps of" value={`${gym.dumbbells.step} lb`} by="2.5 lb" onStep={(d) => update((g) => ({ dumbbells: { ...g.dumbbells, step: clamp(g.dumbbells.step + d * 2.5, 2.5, 10) } }))} />
        </Card>
      )}

      {gyms.length > 1 && (
        <Button
          variant="danger"
          onClick={() => {
            if (!window.confirm(`Remove "${gym.name}"? Workouts already logged are not affected.`)) return
            const rest = gyms.filter((g) => g.id !== gym.id)
            void saveProgram(user!.id, { gyms: rest, gym: program.gym === gym.id ? rest[0].id : program.gym }).then(() => navigate('/settings', { replace: true }))
          }}
        >
          Remove this gym
        </Button>
      )}
    </div>
  )
}

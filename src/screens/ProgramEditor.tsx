import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { daysBetween, localDate, weekStart } from '../lib/dates'
import { blockPosition, orderSlots, phaseLabel, phaseOf, pickFromPool, planSession } from '../lib/engine'
import { exercise } from '../lib/exercises'
import type { DayKey, MainLift, Slot } from '../lib/program'
import { defOf, saveProgram, settingsOf, useProgram } from '../lib/programState'
import { Button, Card, Label, RoundButton, Sheet, cx, icons, Icon } from '../components/ui'

type Editing = { kind: 'main'; main: MainLift } | { kind: 'slot'; slot: Slot } | null

export function ProgramEditor() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const program = useProgram(user!.id)
  const settings = settingsOf(program)
  const whole = defOf(program)
  const [chosen, setDay] = useState<DayKey>(whole.order[0])
  const day = whole.days[chosen] ? chosen : whole.order[0]
  const [editing, setEditing] = useState<Editing>(null)
  const def = whole.days[day]
  const { blockIndex, week } = blockPosition(program.startedOn, localDate(), weekStart, daysBetween)
  // What the plan gives each lift now, so the sets and reps shown are the real ones.
  const planned = planSession({ day, def: whole, blockIndex, week, settings: { ...settings, equipment: undefined, maxMinutes: 999 } }).lifts
  const tweakId = editing ? `${day}:${editing.kind === 'main' ? editing.main.id : editing.slot.role}` : ''
  const tweak = program.tweaks?.[tweakId] ?? {}
  const base = editing ? planned.find((l) => (editing.kind === 'main' ? def.mains.indexOf(editing.main) === planned.filter((x) => x.kind === 'main').indexOf(l) && l.kind === 'main' : l.role === editing.slot.role)) : undefined
  const setTweak = (patch: { sets?: number; low?: number; high?: number } | null) => {
    const all = { ...(program.tweaks ?? {}) }
    if (patch === null) delete all[tweakId]
    else all[tweakId] = { ...all[tweakId], ...patch }
    void saveProgram(user!.id, { tweaks: all })
  }
  // Kept on screen first and saved after, so quick taps in a row each build on the last one.
  const [pending, setPending] = useState<Partial<Record<DayKey, number[]>>>({})
  const order = pending[day] ?? program.slotOrder?.[day] ?? def.slots.map((_, i) => i)
  const slots = orderSlots(def.slots, order)

  const mainKey = (m: MainLift) => program.mains[m.id] ?? (m.pull ? program.pullMain : m.key)
  const current = (slot: Slot, i: number) => pickFromPool(slot.pool, slot.home ?? i, blockIndex, settings, new Set())
  const locked = (slot: Slot) => slot.pool.find((k) => program.pins.includes(k))
  const move = (i: number, by: -1 | 1) => {
    const next = [...order]
    ;[next[i], next[i + by]] = [next[i + by], next[i]]
    const all = { ...program.slotOrder, ...pending, [day]: next }
    setPending((p) => ({ ...p, [day]: next }))
    void saveProgram(user!.id, { slotOrder: all })
  }
  const lock = (slot: Slot, key: string | null) => {
    const others = program.pins.filter((p) => !slot.pool.includes(p))
    void saveProgram(user!.id, { pins: key ? [...others, key] : others, bans: key ? program.bans.filter((b) => b !== key) : program.bans })
    setEditing(null)
  }
  const pickMain = (m: MainLift, key: string) => {
    const { [m.id]: _old, ...rest } = program.mains
    if (m.pull && (key === 'pull_up' || key === 'lat_pulldown')) void saveProgram(user!.id, { pullMain: key, mains: rest })
    else void saveProgram(user!.id, { mains: key === m.key ? rest : { ...rest, [m.id]: key } })
    setEditing(null)
  }
  const changed = Object.keys(program.tweaks ?? {}).some((k) => k.startsWith(`${day}:`)) || !!pending[day] || !!program.slotOrder?.[day] || def.mains.some((m) => program.mains[m.id]) || [...def.slots, ...def.finisher].some(locked)

  const row = 'flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2 text-left'
  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">My program</h1>
          <span className="text-xs text-muted">
            {phaseLabel[phaseOf(blockIndex)]} block · week {week} of 4 · your partner's is separate
          </span>
        </div>
      </header>

      <Link to="/settings/program/builder" className="flex min-h-[56px] items-center justify-between gap-3 rounded-card border border-line bg-surface px-3.5 py-2.5">
        <span className="flex flex-col gap-0.5">
          <span className="text-[15px] font-semibold">{whole.name}</span>
          <span className="text-xs text-muted">
            {whole.order.length} days in rotation · sessions up to {program.minutes ?? 70} min
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-coach">Change program</span>
      </Link>

      <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${whole.order.length}, minmax(0, 1fr))` }}>
        {whole.order.map((d) => (
          <button key={d} aria-pressed={day === d} onClick={() => setDay(d)} className={cx('h-11 rounded-xl border px-1 text-[13px] font-semibold', day === d ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-surface text-muted')}>
            {whole.days[d].short}
          </button>
        ))}
      </div>

      <Label tone="accent">Main lifts</Label>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {def.mains.map((m, i) => (
          <button key={m.id} onClick={() => setEditing({ kind: 'main', main: m })} className={cx(row, i > 0 && 'border-t border-line')}>
            <span className="flex-1 text-base font-semibold">{exercise(mainKey(m)).name}</span>
            <span className="text-sm font-semibold text-coach">Change</span>
          </button>
        ))}
      </div>

      <Label>Accessories, in priority order</Label>
      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {slots.map((slot, i) => {
          const key = current(slot, i)
          return (
            <div key={slot.role} className={cx('flex items-center gap-1 py-1 pr-1.5 pl-3.5', i > 0 && 'border-t border-line')}>
              <button onClick={() => setEditing({ kind: 'slot', slot })} className="flex min-h-[48px] min-w-0 flex-1 flex-col justify-center gap-0.5 text-left">
                <span className="truncate text-[15px] font-medium">{key ? exercise(key).name : 'Nothing available'}</span>
                <span className="text-xs text-muted">
                  {slot.role} · {locked(slot) ? 'locked' : 'rotates each block'}
                </span>
              </button>
              <button aria-label={`Move ${slot.role} up`} disabled={i === 0} onClick={() => move(i, -1)} className="mr-1.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-ink disabled:opacity-35">
                <Icon d="M6 15l6-6 6 6" size={18} />
              </button>
              <button aria-label={`Move ${slot.role} down`} disabled={i === slots.length - 1} onClick={() => move(i, 1)} className="mr-2.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-ink disabled:opacity-35">
                <Icon d="M6 9l6 6 6-6" size={18} />
              </button>
            </div>
          )
        })}
        {def.catchUp && <p className="border-t border-line px-3.5 py-3 text-xs text-muted">Slots 4 to 7 on this day are filled automatically from whichever muscles are furthest behind for the week.</p>}
        {def.topUps && <p className="border-t border-line px-3.5 py-3 text-xs text-muted">This day also gets three strength top-ups, chosen automatically from the muscles furthest behind.</p>}
      </div>
      <span className="text-xs text-muted">A short session uses the top three slots; a long one uses them all. Move the ones you care about most to the top.</span>

      {def.finisher.length > 0 && (
        <>
          <Label>Core finisher</Label>
          <div className="overflow-hidden rounded-card border border-line bg-surface">
            {def.finisher.map((slot, i) => {
              const key = current(slot, i)
              return (
                <button key={slot.role} onClick={() => setEditing({ kind: 'slot', slot })} className={cx(row, 'flex-col !items-start !gap-0.5', i > 0 && 'border-t border-line')}>
                  <span className="text-[15px] font-medium">{key ? exercise(key).name : 'Nothing available'}</span>
                  <span className="text-xs text-muted">
                    {slot.role} · {locked(slot) ? 'locked' : 'rotates each block'}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}

      {changed && (
        <Button
          variant="danger"
          onClick={() => {
            if (!window.confirm(`Put ${def.title} back to the standard version?`)) return
            const pools = [...def.slots, ...def.finisher].flatMap((s) => s.pool)
            const mains = Object.fromEntries(Object.entries(program.mains).filter(([id]) => !def.mains.some((m) => m.id === id)))
            const { [day]: _gone, ...slotOrder } = program.slotOrder ?? {}
            setPending((p) => ({ ...p, [day]: undefined }))
            const tweaks = Object.fromEntries(Object.entries(program.tweaks ?? {}).filter(([k]) => !k.startsWith(`${day}:`)))
            void saveProgram(user!.id, { mains, slotOrder, tweaks, pins: program.pins.filter((p) => !pools.includes(p)) })
          }}
        >
          Reset {def.title} to standard
        </Button>
      )}
      <p className="text-center text-xs text-muted">Changes apply from your next workout. Past workouts never change.</p>

      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        <div className="scroll-y flex max-h-[76vh] flex-col gap-2 pb-3 [&>*]:shrink-0">
          {editing && base && (
            <div className="mb-1 flex flex-col gap-2 rounded-control bg-bg p-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold tracking-[0.5px] text-muted">SETS AND REPS</span>
                {(tweak.sets || tweak.low || tweak.high) && (
                  <button className="h-8 text-xs font-semibold text-accent" onClick={() => setTweak(null)}>
                    Back to automatic
                  </button>
                )}
              </div>
              {(
                [
                  ['Sets', base.sets, 1, 6, (v: number) => setTweak({ sets: v })],
                  ...(base.unit === 'reps'
                    ? ([
                        ['Reps from', base.low, 1, base.high, (v: number) => setTweak({ low: v })],
                        ['Reps to', base.high, base.low, 40, (v: number) => setTweak({ high: v })],
                      ] as const)
                    : []),
                ] as [string, number, number, number, (v: number) => void][]
              ).map(([label, value, min, max, set]) => (
                <div key={label} className="flex min-h-[44px] items-center justify-between gap-3">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="flex items-center gap-1.5">
                    <button aria-label={`${label}: one fewer`} disabled={value <= min} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-raised text-lg disabled:opacity-35" onClick={() => set(value - 1)}>
                      −
                    </button>
                    <span className="num w-9 text-center text-[17px] font-semibold">{value}</span>
                    <button aria-label={`${label}: one more`} disabled={value >= max} className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-raised text-lg disabled:opacity-35" onClick={() => set(value + 1)}>
                      +
                    </button>
                  </span>
                </div>
              ))}
              <span className="text-xs text-muted">{tweak.sets || tweak.low || tweak.high ? 'Your own numbers. They stay fixed while the blocks change around them.' : 'Set by the current block. Change them to fix your own.'}</span>
            </div>
          )}
          {editing?.kind === 'main' && (
            <>
              <span className="text-[15px] font-semibold">Main lift</span>
              {[editing.main.key, editing.main.alone, ...editing.main.alternatives]
                .filter((k): k is string => !!k)
                .map((k) => (
                  <button key={k} onClick={() => pickMain(editing.main, k)} className={cx('min-h-[52px] rounded-control border px-3.5 text-left text-[15px] font-semibold', mainKey(editing.main) === k ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}>
                    {exercise(k).name}
                    {k === editing.main.key && <span className="ml-2 text-xs font-normal text-muted">standard</span>}
                  </button>
                ))}
            </>
          )}
          {editing?.kind === 'slot' && (
            <>
              <span className="text-[15px] font-semibold">{editing.slot.role}</span>
              <button onClick={() => lock(editing.slot, null)} className={cx('min-h-[52px] rounded-control border px-3.5 text-left text-[15px] font-semibold', !locked(editing.slot) ? 'border-accent bg-accent-dim' : 'border-line bg-raised')}>
                Rotate automatically
              </button>
              {editing.slot.pool.map((k) => (
                <button key={k} onClick={() => lock(editing.slot, k)} className={cx('flex min-h-[52px] items-center justify-between gap-3 rounded-control border px-3.5 text-left text-[15px]', locked(editing.slot) === k ? 'border-accent bg-accent-dim font-semibold' : 'border-line bg-raised')}>
                  <span>Always {exercise(k).name}</span>
                  {program.bans.includes(k) && <span className="shrink-0 text-xs text-danger">never used</span>}
                </button>
              ))}
            </>
          )}
        </div>
      </Sheet>
      <Card className="text-xs text-muted">To remove one exercise from the rotation without locking the slot, open it in the Library and tap "Never use".</Card>
    </div>
  )
}

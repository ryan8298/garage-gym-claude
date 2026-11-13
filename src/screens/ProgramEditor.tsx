import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { daysBetween, localDate, weekStart } from '../lib/dates'
import { blockPosition, orderSlots, phaseLabel, phaseOf, pickFromPool } from '../lib/engine'
import { exercise } from '../lib/exercises'
import { DAY_ORDER, PROGRAM, type DayKey, type MainLift, type Slot } from '../lib/program'
import { saveProgram, settingsOf, useProgram } from '../lib/programState'
import { Button, Card, Label, RoundButton, Sheet, cx, icons } from '../components/ui'

type Editing = { kind: 'main'; main: MainLift } | { kind: 'slot'; slot: Slot } | null

export function ProgramEditor() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const program = useProgram(user!.id)
  const settings = settingsOf(program)
  const [day, setDay] = useState<DayKey>('A')
  const [editing, setEditing] = useState<Editing>(null)
  const def = PROGRAM[day]
  const { blockIndex, week } = blockPosition(program.startedOn, localDate(), weekStart, daysBetween)
  // Kept on screen first and saved after, so quick taps in a row each build on the last one.
  const [pending, setPending] = useState<Partial<Record<DayKey, number[]>>>({})
  const order = pending[day] ?? program.slotOrder?.[day] ?? def.slots.map((_, i) => i)
  const slots = orderSlots(def.slots, order)

  const mainKey = (m: MainLift) => program.mains[m.id] ?? (m.id === 'B2' ? program.pullMain : m.key)
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
    if (m.id === 'B2' && (key === 'pull_up' || key === 'lat_pulldown')) void saveProgram(user!.id, { pullMain: key, mains: rest })
    else void saveProgram(user!.id, { mains: key === m.key ? rest : { ...rest, [m.id]: key } })
    setEditing(null)
  }
  const changed = !!pending[day] || !!program.slotOrder?.[day] || def.mains.some((m) => program.mains[m.id]) || [...def.slots, ...def.finisher].some(locked)

  const row = 'flex min-h-[56px] w-full items-center gap-3 px-3.5 py-2 text-left'
  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">My program</h1>
          <span className="text-xs text-muted">
            {phaseLabel[phaseOf(blockIndex)]} block · week {week} of 4 · your partner's copy is separate
          </span>
        </div>
      </header>

      <div className="grid grid-cols-4 gap-1.5">
        {DAY_ORDER.map((d) => (
          <button key={d} aria-pressed={day === d} onClick={() => setDay(d)} className={cx('h-11 rounded-xl border text-[13px] font-semibold', day === d ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-surface text-muted')}>
            {d} · {PROGRAM[d].short}
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
              <button aria-label={`Move ${slot.role} up`} disabled={i === 0} onClick={() => move(i, -1)} className="flex h-11 w-10 items-center justify-center text-ink disabled:text-faint">
                ▲
              </button>
              <button aria-label={`Move ${slot.role} down`} disabled={i === slots.length - 1} onClick={() => move(i, 1)} className="flex h-11 w-10 items-center justify-center text-ink disabled:text-faint">
                ▼
              </button>
            </div>
          )
        })}
        {day === 'D' && <p className="border-t border-line px-3.5 py-3 text-xs text-muted">Slots 4 to 7 on this day are filled automatically from whichever muscles are furthest behind for the week.</p>}
        {day === 'C' && <p className="border-t border-line px-3.5 py-3 text-xs text-muted">This day also gets three strength top-ups, chosen automatically from the muscles furthest behind.</p>}
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
            if (!window.confirm(`Put Day ${day} back to the standard program?`)) return
            const pools = [...def.slots, ...def.finisher].flatMap((s) => s.pool)
            const mains = Object.fromEntries(Object.entries(program.mains).filter(([id]) => !def.mains.some((m) => m.id === id)))
            const { [day]: _gone, ...slotOrder } = program.slotOrder ?? {}
            setPending((p) => ({ ...p, [day]: undefined }))
            void saveProgram(user!.id, { mains, slotOrder, pins: program.pins.filter((p) => !pools.includes(p)) })
          }}
        >
          Reset Day {day} to standard
        </Button>
      )}
      <p className="text-center text-xs text-muted">Changes apply from your next workout. Past workouts never change.</p>

      <Sheet open={!!editing} onClose={() => setEditing(null)}>
        <div className="scroll-y flex max-h-[70vh] flex-col gap-2 pb-3">
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

import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { lastBodyWeight, saveDailyLog, useDailyLog } from '../lib/data'
import { addDays, localDate, shortDate, weekStart } from '../lib/dates'
import { deleteCardio, saveCardio, saveMeasurement, useCardio, useMeasurements } from '../lib/progressData'
import { Button, Card, Label, NumberPad, Rating, RoundButton, Sheet, icons } from '../components/ui'
import { SyncBadge } from '../components/SyncBadge'

type TapeField = 'waist' | 'chest' | 'hips' | 'arm' | 'thigh'
const tapeFields: [TapeField, string][] = [
  ['waist', 'Waist'],
  ['chest', 'Chest'],
  ['hips', 'Hips'],
  ['arm', 'Arm'],
  ['thigh', 'Thigh'],
]
type PadField = 'body_weight' | 'steps' | 'sleep_hours'
const pads: Record<PadField, { title: string; unit: string; step: number; decimals: number }> = {
  body_weight: { title: 'Body weight', unit: 'lb', step: 0.2, decimals: 1 },
  steps: { title: 'Steps', unit: 'steps', step: 500, decimals: 0 },
  sleep_hours: { title: 'Sleep', unit: 'h', step: 0.5, decimals: 1 },
}

export function Log() {
  const { user } = useAuth()
  const today = localDate()
  const [date, setDate] = useState(today)
  const log = useDailyLog(user!.id, date)
  const [pad, setPad] = useState<PadField | null>(null)
  const [previousWeight, setPreviousWeight] = useState<number | null>(null)
  const [note, setNote] = useState('')
  const cardio = useCardio(user!.id)
  const measurements = useMeasurements(user!.id)
  const [addingCardio, setAddingCardio] = useState(false)
  const [cardioKind, setCardioKind] = useState('Walk')
  const [cardioMinutes, setCardioMinutes] = useState<number | null>(null)
  const [cardioMiles, setCardioMiles] = useState<number | null>(null)
  const [cardioPad, setCardioPad] = useState<'minutes' | 'distance' | null>(null)
  const [tapeField, setTapeField] = useState<TapeField | null>(null)
  const todaysCardio = cardio.filter((c) => c.log_date === date)
  const monday = weekStart(date)
  const weekMinutes = Math.round(cardio.filter((c) => c.log_date >= monday && c.log_date <= addDays(monday, 6)).reduce((n, c) => n + (c.minutes ?? 0), 0))
  const tape = measurements.find((m) => m.measured_on === date)

  useEffect(() => {
    void lastBodyWeight(user!.id, addDays(date, -1)).then(setPreviousWeight)
  }, [user, date])
  useEffect(() => setNote(log?.note ?? ''), [log?.id, log?.note])

  const set = (patch: Parameters<typeof saveDailyLog>[2]) => void saveDailyLog(user!.id, date, patch)
  const weight = log?.body_weight ?? null
  const nudgeWeight = (delta: number) => {
    const base = weight ?? previousWeight
    if (base !== null) set({ body_weight: Number((base + delta).toFixed(1)) })
    else setPad('body_weight')
  }
  const stepBtn = 'num h-12 w-14 rounded-control border border-line bg-raised text-base font-semibold'

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center justify-between">
        <RoundButton label="Previous day" d={icons.back} onClick={() => setDate(addDays(date, -1))} />
        <div className="flex flex-col items-center gap-0.5">
          <h1 className="font-display text-xl font-bold">{date === today ? 'Today' : shortDate(date)}</h1>
          <SyncBadge />
        </div>
        <RoundButton label="Next day" d={icons.next} disabled={date >= today} onClick={() => setDate(addDays(date, 1))} />
      </header>

      <Card className="flex flex-col gap-2.5">
        <Label>Body weight</Label>
        <div className="flex items-center justify-between">
          <button aria-label="Down 0.2 pounds" className={stepBtn} onClick={() => nudgeWeight(-0.2)}>
            −0.2
          </button>
          <button className="flex items-baseline gap-1.5" onClick={() => setPad('body_weight')} aria-label="Enter body weight">
            <span className={`num text-[44px] leading-none font-bold tracking-[-1px] ${weight === null ? 'text-faint' : ''}`}>
              {(weight ?? previousWeight)?.toFixed(1) ?? '0.0'}
            </span>
            <span className="text-[15px] text-muted">lb</span>
          </button>
          <button aria-label="Up 0.2 pounds" className={stepBtn} onClick={() => nudgeWeight(0.2)}>
            +0.2
          </button>
        </div>
        <span className="text-center text-[13px] text-muted">
          {weight !== null ? 'Logged for this day' : previousWeight !== null ? 'Showing your last entry. Tap the number or a button to log today.' : 'Tap the number to log your first weigh-in'}
        </span>
      </Card>

      <div className="grid grid-cols-2 gap-2.5">
        {(['steps', 'sleep_hours'] as const).map((f) => {
          const v = log?.[f] ?? null
          return (
            <button key={f} onClick={() => setPad(f)} className="flex flex-col gap-1 rounded-card border border-line bg-surface p-4 text-left">
              <Label>{f === 'steps' ? 'Steps' : 'Sleep'}</Label>
              <span className={`num text-[26px] font-bold ${v === null ? 'text-faint' : ''}`}>
                {v === null ? '—' : f === 'steps' ? v.toLocaleString() : `${v.toFixed(1)} h`}
              </span>
              <span className="text-xs text-muted">Tap to enter</span>
            </button>
          )
        })}
      </div>

      <Card className="flex flex-col gap-2.5">
        <Rating label="Energy" value={log?.energy ?? null} onChange={(energy) => set({ energy })} />
        <Rating label="Soreness" value={log?.soreness ?? null} onChange={(soreness) => set({ soreness })} />
      </Card>

      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Note
        <input
          type="text"
          value={note}
          placeholder="Anything worth remembering"
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => note !== (log?.note ?? '') && set({ note: note.trim() || null })}
          className="h-12 rounded-control border border-line bg-surface px-3.5 text-ink outline-none focus:border-accent"
        />
      </label>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <Label>Cardio</Label>
          <button className="h-9 px-1 text-sm font-semibold text-accent" onClick={() => setAddingCardio(true)}>
            + Add
          </button>
        </div>
        {todaysCardio.length === 0 && <span className="text-sm text-muted">Nothing logged for this day.</span>}
        {todaysCardio.map((c) => (
          <div key={c.id} className="flex items-center justify-between gap-3">
            <span className="text-[15px] font-medium">{c.kind}</span>
            <span className="flex items-center gap-2">
              <span className="num text-sm text-muted">
                {c.minutes !== null ? `${c.minutes} min` : ''}
                {c.minutes !== null && c.distance !== null ? ' · ' : ''}
                {c.distance !== null ? `${c.distance} mi` : ''}
              </span>
              <button aria-label={`Delete ${c.kind}`} className="h-9 px-1 text-xs text-danger" onClick={() => void deleteCardio(c)}>
                Remove
              </button>
            </span>
          </div>
        ))}
        <div className="flex flex-col gap-1.5">
          <span className="h-2 overflow-hidden rounded-full bg-raised">
            <span className={`block h-full rounded-full ${weekMinutes >= 150 ? 'bg-accent' : 'bg-coach'}`} style={{ width: `${Math.min(100, (weekMinutes / 150) * 100)}%` }} />
          </span>
          <span className="text-xs text-muted">
            <span className="num font-semibold text-ink">{weekMinutes}</span> of 150 minutes this week. Walking counts.
          </span>
        </div>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <Label>Measurements</Label>
          <span className="text-xs text-muted">{measurements[0] ? `last taken ${shortDate(measurements[0].measured_on)}` : 'about once a month'}</span>
        </div>
        <div className="grid grid-cols-5 gap-1.5">
          {tapeFields.map(([f, name]) => {
            const v = tape?.[f] ?? null
            return (
              <button key={f} onClick={() => setTapeField(f)} className="flex flex-col items-center gap-0.5 rounded-xl bg-raised py-2">
                <span className={`num text-[15px] font-bold ${v === null ? 'text-faint' : ''}`}>{v === null ? '—' : v}</span>
                <span className="text-[11px] text-muted">{name}</span>
              </button>
            )
          })}
        </div>
        <span className="text-xs text-muted">Inches, for this day. Only you can see these unless you turn on sharing in Settings.</span>
      </Card>

      <Sheet open={addingCardio} onClose={() => setAddingCardio(false)}>
        <div className="flex flex-col gap-3.5 pb-3">
          <span className="font-display text-[22px] font-bold">Add cardio</span>
          <div className="grid grid-cols-3 gap-2">
            {['Walk', 'Run', 'Bike', 'Hike', 'Swim', 'Other'].map((k) => (
              <button key={k} aria-pressed={cardioKind === k} onClick={() => setCardioKind(k)} className={`h-11 rounded-control border text-sm font-semibold ${cardioKind === k ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted'}`}>
                {k}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ['minutes', 'Minutes', cardioMinutes],
                ['distance', 'Miles', cardioMiles],
              ] as const
            ).map(([f, name, v]) => (
              <button key={f} onClick={() => setCardioPad(f)} className="flex flex-col gap-1 rounded-control border border-line bg-raised p-3 text-left">
                <span className="text-xs text-muted">{name}</span>
                <span className={`num text-2xl font-bold ${v === null ? 'text-faint' : ''}`}>{v === null ? '—' : v}</span>
              </button>
            ))}
          </div>
          <Button
            variant="primary"
            disabled={cardioMinutes === null && cardioMiles === null}
            onClick={() => {
              void saveCardio(user!.id, { date, kind: cardioKind, minutes: cardioMinutes, distance: cardioMiles })
              setAddingCardio(false)
              setCardioMinutes(null)
              setCardioMiles(null)
            }}
          >
            Save
          </Button>
        </div>
      </Sheet>
      <NumberPad
        open={cardioPad !== null}
        title={cardioPad === 'distance' ? 'Distance' : 'Time'}
        unit={cardioPad === 'distance' ? 'mi' : 'min'}
        initial={cardioPad === 'distance' ? cardioMiles : cardioMinutes}
        step={cardioPad === 'distance' ? 0.5 : 5}
        decimals={cardioPad === 'distance' ? 2 : 0}
        onClose={() => setCardioPad(null)}
        onDone={(v) => {
          if (cardioPad === 'distance') setCardioMiles(v)
          else setCardioMinutes(v)
          setCardioPad(null)
        }}
      />
      <NumberPad
        open={tapeField !== null}
        title={tapeFields.find(([f]) => f === tapeField)?.[1] ?? ''}
        unit="in"
        initial={tapeField ? (tape?.[tapeField] ?? measurements[0]?.[tapeField] ?? null) : null}
        step={0.25}
        decimals={2}
        onClose={() => setTapeField(null)}
        onDone={(v) => {
          if (tapeField) void saveMeasurement(user!.id, date, { [tapeField]: v })
          setTapeField(null)
        }}
      />

      <NumberPad
        open={pad !== null}
        {...pads[pad ?? 'body_weight']}
        initial={pad ? (log?.[pad] ?? (pad === 'body_weight' ? previousWeight : null)) : null}
        onClose={() => setPad(null)}
        onDone={(value) => {
          if (pad) set({ [pad]: value })
          setPad(null)
        }}
      />
    </div>
  )
}

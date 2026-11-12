import { useEffect, useState } from 'react'
import { useAuth } from '../lib/auth'
import { lastBodyWeight, saveDailyLog, useDailyLog } from '../lib/data'
import { addDays, localDate, shortDate } from '../lib/dates'
import { Card, Label, NumberPad, Rating, RoundButton, icons } from '../components/ui'
import { SyncBadge } from '../components/SyncBadge'

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

      <p className="text-center text-xs text-muted">Cardio entries and monthly measurements are added in phase 4.</p>

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

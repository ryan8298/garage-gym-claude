import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { saveDailyLog, saveProfile } from '../lib/data'
import { localDate } from '../lib/dates'
import { saveProgram } from '../lib/programState'
import { Button, Label, NumberPad, cx } from '../components/ui'

function Choice<T extends string | number | boolean>({ options, value, onChange }: { options: [T, string][]; value: T | null; onChange(v: T): void }) {
  return (
    <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}>
      {options.map(([v, text]) => (
        <button key={String(v)} aria-pressed={value === v} onClick={() => onChange(v)} className={cx('min-h-[48px] rounded-control border px-2 text-sm font-semibold', value === v ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-surface text-muted')}>
          {text}
        </button>
      ))}
    </div>
  )
}

/** Shown once, to someone with no workouts yet. Five quick answers and they are training. */
export function Onboarding({ suggestedName }: { suggestedName: string }) {
  const { user } = useAuth()
  const [name, setName] = useState(suggestedName)
  const [weight, setWeight] = useState<number | null>(null)
  const [target, setTarget] = useState<number>(4)
  const [pullUps, setPullUps] = useState<boolean | null>(null)
  const [strap, setStrap] = useState<boolean>(true)
  const [pad, setPad] = useState(false)
  const [saving, setSaving] = useState(false)

  async function finish() {
    setSaving(true)
    await saveProfile(user!.id, { display_name: name.trim(), weekly_target: target })
    if (weight !== null) await saveDailyLog(user!.id, localDate(), { body_weight: weight })
    await saveProgram(user!.id, { pullMain: pullUps ? 'pull_up' : 'lat_pulldown', ankleStrap: strap, onboarded: true })
  }

  return (
    <div className="scroll-y pt-safe pb-safe flex h-full flex-col gap-5 px-6">
      <div className="mt-6 flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[1px] text-accent">WELCOME</span>
        <h1 className="font-display text-[32px] leading-[1.05] font-bold tracking-[-0.6px]">A few quick questions, then you train</h1>
      </div>

      <label className="flex flex-col gap-1.5 text-xs text-muted">
        What should the app call you?
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" className="h-[52px] rounded-control border border-line bg-surface px-4 text-ink outline-none focus:border-accent" />
      </label>

      <div className="flex flex-col gap-1.5">
        <Label>Body weight today (optional)</Label>
        <button onClick={() => setPad(true)} className="flex h-[52px] items-center justify-between rounded-control border border-line bg-surface px-4">
          <span className={cx('num text-xl font-bold', weight === null && 'text-faint')}>{weight === null ? 'Tap to enter' : `${weight} lb`}</span>
        </button>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Workouts per week</Label>
        <Choice<number>
          options={[
            [3, '3'],
            [4, '4'],
          ]}
          value={target}
          onChange={setTarget}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Can you do 5 or more pull-ups in a row?</Label>
        <Choice<boolean>
          options={[
            [true, 'Yes'],
            [false, 'Not yet'],
          ]}
          value={pullUps}
          onChange={setPullUps}
        />
        <span className="text-xs text-muted">Sets your pulling main lift on upper-body day: pull-ups, or lat pulldowns with pull-up practice. You can change it later.</span>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label>Do you have an ankle strap for the cables?</Label>
        <Choice<boolean>
          options={[
            [true, 'Yes'],
            [false, 'No'],
          ]}
          value={strap}
          onChange={setStrap}
        />
      </div>

      <p className="rounded-control bg-surface p-3.5 text-[13px] leading-relaxed text-muted">
        Your first session of each workout has no suggested weights. Start light and pick a weight that leaves about 2 reps in the tank. From the second session on, the app suggests your numbers.
      </p>

      <Button variant="primary" className="mb-4 shrink-0" disabled={!name.trim() || pullUps === null || saving} onClick={() => void finish()}>
        {saving ? 'Saving…' : 'Start training'}
      </Button>

      <NumberPad open={pad} title="Body weight" unit="lb" initial={weight} step={0.2} decimals={1} onClose={() => setPad(false)} onDone={(v) => (setWeight(v), setPad(false))} />
    </div>
  )
}

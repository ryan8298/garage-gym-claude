import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { saveProfile, useProfile } from '../lib/data'
import { SESSION_LENGTHS, goalLabels, goalNote, recommend, type Goal } from '../lib/builder'
import { TEMPLATES, programDef } from '../lib/program'
import { defOf, saveProgram, useProgram } from '../lib/programState'
import { Button, Card, Label, RoundButton, cx, icons } from '../components/ui'

const chip = (on: boolean) => cx('h-12 rounded-control border px-2 text-sm font-semibold', on ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')

/** Three questions, a recommended program, and the choice of any other. */
export function ProgramBuilder() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const program = useProgram(user!.id)
  const profile = useProfile(user!.id)
  const [goal, setGoal] = useState<Goal>(program.goal ?? 'fat_loss')
  const [days, setDays] = useState<number | null>(null)
  const [minutes, setMinutes] = useState(program.minutes ?? 60)
  const [picked, setPicked] = useState<string | null>(null)
  const perWeek = days ?? profile?.weekly_target ?? 4
  const advice = recommend({ goal, days: perWeek })
  const template = picked ?? advice.template
  const current = defOf(program)
  const same = template === current.id && goal === (program.goal ?? 'fat_loss') && minutes === (program.minutes ?? 70) && perWeek === (profile?.weekly_target ?? 4)

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">Build my program</h1>
          <span className="text-xs text-muted">Now: {current.name}. Your partner chooses their own.</span>
        </div>
      </header>

      <Card className="flex flex-col gap-2.5">
        <Label>What are you training for?</Label>
        <div className="grid grid-cols-3 gap-2">
          {(Object.keys(goalLabels) as Goal[]).map((g) => (
            <button key={g} aria-pressed={goal === g} onClick={() => (setGoal(g), setPicked(null))} className={chip(goal === g)}>
              {goalLabels[g]}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">{goalNote[goal]}</span>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <Label>Days a week</Label>
        <div className="grid grid-cols-5 gap-2">
          {[2, 3, 4, 5, 6].map((d) => (
            <button key={d} aria-pressed={perWeek === d} onClick={() => (setDays(d), setPicked(null))} className={cx(chip(perWeek === d), 'num text-lg')}>
              {d}
            </button>
          ))}
        </div>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <Label>Longest session</Label>
        <div className="grid grid-cols-4 gap-2">
          {SESSION_LENGTHS.map((m) => (
            <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={cx(chip(minutes === m), 'num')}>
              {m} min
            </button>
          ))}
        </div>
        <span className="text-xs text-muted">The main lifts always stay. Shorter sessions drop the lowest-priority accessories first.</span>
      </Card>

      <Label tone="accent">Programs</Label>
      {TEMPLATES.map((t) => {
        const on = t.id === template
        return (
          <button key={t.id} aria-pressed={on} onClick={() => setPicked(t.id)} className={cx('flex flex-col gap-1 rounded-card border p-3.5 text-left', on ? 'border-accent bg-accent-dim' : 'border-line bg-surface')}>
            <span className="flex items-center justify-between gap-3">
              <span className="text-base font-semibold">{t.name}</span>
              {t.id === advice.template && <span className="shrink-0 rounded-full bg-accent px-2 py-0.5 text-[11px] font-bold text-accent-ink">Recommended</span>}
            </span>
            <span className="text-xs text-muted">
              {t.perWeek} days a week · {t.order.map((d) => t.days[d].short).join(', ')}
            </span>
            <span className="text-[13px] leading-snug text-muted">{t.id === advice.template ? advice.why : t.summary}</span>
          </button>
        )
      })}

      <Button
        variant="primary"
        disabled={same}
        onClick={() => {
          const switching = template !== current.id
          if (switching && !window.confirm(`Switch to "${programDef(template).name}"? Your history and records stay. The rotation starts again from its first day.`)) return
          void saveProfile(user!.id, { weekly_target: perWeek })
          void saveProgram(user!.id, { template, goal, minutes, ...(switching ? { queueIndex: 0 } : {}) }).then(() => navigate(-1))
        }}
      >
        {same ? 'This is your program now' : template === current.id ? 'Save these settings' : 'Use this program'}
      </Button>
      <span className="text-center text-xs text-muted">Every program uses the same exercises, blocks, progression and place settings. You can switch back at any time.</span>
    </div>
  )
}

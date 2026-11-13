import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { phaseLabel } from '../lib/engine'
import { DAY_ORDER, type DayKey } from '../lib/program'
import { usePlan } from '../lib/programState'
import { Button, Card, RoundButton, icons } from '../components/ui'
import { startSession, useActiveSession } from '../lib/session'
import { unlockSound } from '../lib/rest'
import { LiftList } from '../components/LiftList'

export function WorkoutPreview() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { day } = useParams()
  const key = (DAY_ORDER.includes(day as DayKey) ? day : 'A') as DayKey
  const [alone, setAlone] = useState(false)
  const { plan, program } = usePlan(user!.id, key, alone)
  const active = useActiveSession(user!.id)
  const [starting, setStarting] = useState(false)

  return (
    <div className="flex flex-col gap-4 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">{plan.title}</h1>
          <span className="text-xs text-muted">
            Day {plan.day} · {phaseLabel[plan.phase]} · week {plan.week} of 4{plan.recovery ? ' · lighter week' : ''}
          </span>
        </div>
      </header>

      <div className="grid grid-cols-3 gap-2">
        {[
          [String(plan.lifts.length), 'lifts'],
          [String(plan.lifts.reduce((n, l) => n + l.sets, 0)), 'sets'],
          [`~${plan.minutes}`, 'minutes'],
        ].map(([n, label]) => (
          <div key={label} className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-3">
            <span className="num text-2xl font-bold">{n}</span>
            <span className="text-xs text-muted">{label}</span>
          </div>
        ))}
      </div>

      <label className="flex min-h-[56px] items-center justify-between gap-3 rounded-control bg-surface px-3.5 py-2">
        <span className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Training alone today</span>
          <span className="text-xs text-muted">Swaps free-barbell main lifts for versions that are safe without a spotter</span>
        </span>
        <input type="checkbox" checked={alone} onChange={(e) => setAlone(e.target.checked)} role="switch" className="switch" />
      </label>

      <LiftList plan={plan} />

      {plan.day === 'C' && (
        <Card className="text-sm text-muted">Then cardio: log the type, time and distance. Your weekly target is 150 minutes of moderate activity.</Card>
      )}
      <Button
        variant="primary"
        disabled={!!active || starting}
        onClick={() => {
          unlockSound()
          setStarting(true)
          void startSession(user!.id, plan, program).then(() => navigate('/session', { replace: true }))
        }}
      >
        {active ? 'Another workout is in progress' : starting ? 'Starting…' : 'Start this workout'}
      </Button>
      <p className="text-center text-xs text-muted">Tap any lift for its how-to.</p>
    </div>
  )
}

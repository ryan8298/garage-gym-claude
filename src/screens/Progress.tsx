import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/data'
import { addDays, localDate, parseLocal, weekStart } from '../lib/dates'
import { groupLabels } from '../lib/exercises'
import { WEEKLY_SET_TARGET } from '../lib/program'
import { liftSeries, liftsWithHistory, records, thisWeek, useCardio, useGoals, useLogs, useSessions, weekStats } from '../lib/progressData'
import { movingAverage } from '../lib/stats'
import { usePartner } from '../lib/partner'
import { Card, Label, Sheet, cx } from '../components/ui'
import { LineChart } from '../components/LineChart'
import { GoalsCard } from '../components/Goals'

const CARDIO_TARGET = 150
const change = (now: number, before: number) => (before === 0 ? null : Math.round(((now - before) / before) * 100))
const signed = (n: number) => `${n > 0 ? '+' : ''}${n}`

function Tile({ value, label, sub, good }: { value: string; label: string; sub?: string; good?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-2xl border border-line bg-surface p-3">
      <span className="num text-[22px] font-bold">{value}</span>
      <span className="text-xs text-muted">{label}</span>
      {sub && <span className={cx('text-[11px] font-medium', good ? 'text-accent' : 'text-muted')}>{sub}</span>}
    </div>
  )
}

export function Progress() {
  const { user } = useAuth()
  const partner = usePartner(user!.id)
  const [who, setWho] = useState<'me' | 'partner'>('me')
  const viewing = who === 'partner' && partner ? partner.id : user!.id
  const mine = viewing === user!.id
  const profile = useProfile(viewing)
  const sessions = useSessions(viewing) ?? []
  const logs = useLogs(viewing)
  const cardio = useCardio(viewing)
  const goals = useGoals(viewing)
  const [liftKey, setLiftKey] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const week = thisWeek()
  const now = useMemo(() => weekStats(week, sessions, logs, cardio), [week, sessions, logs, cardio])
  const before = useMemo(() => weekStats(addDays(week, -7), sessions, logs, cardio), [week, sessions, logs, cardio])
  const weights = useMemo(() => logs.filter((l) => l.body_weight !== null).map((l) => ({ date: l.log_date, value: l.body_weight as number })), [logs])
  const trend = useMemo(() => movingAverage(weights), [weights])
  const lifts = useMemo(() => liftsWithHistory(sessions), [sessions])
  const key = liftKey ?? lifts[0]?.key ?? null
  const series = useMemo(() => (key ? liftSeries(sessions, key) : []), [sessions, key])
  const best = useMemo(() => records(sessions), [sessions])
  const trained = useMemo(() => new Set(sessions.map((s) => s.session.local_date)), [sessions])

  const latest = trend[trend.length - 1]
  const monthAgo = trend.filter((p) => p.date <= addDays(localDate(), -28)).pop()
  const volumeChange = change(now.volume, before.volume)
  const liftChange = series.length > 1 ? series[series.length - 1].value - series[0].value : null
  const groups = Object.keys(groupLabels).filter((g) => g !== 'forearms' && g !== 'hips' && g !== 'lower_back')

  // The last 26 weeks, one column per week, Monday at the top.
  const firstWeek = addDays(weekStart(localDate()), -25 * 7)
  const columns = Array.from({ length: 26 }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(firstWeek, w * 7 + d)))

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.5px]">Progress</h1>
        {partner && (
          <div className="flex rounded-xl bg-surface p-[3px]">
            {(['me', 'partner'] as const).map((w) => (
              <button key={w} aria-pressed={who === w} onClick={() => (setWho(w), setLiftKey(null))} className={cx('h-[38px] rounded-[10px] px-3.5 text-[13px] font-semibold', who === w ? 'bg-line text-ink' : 'text-muted')}>
                {w === 'me' ? 'Me' : partner.display_name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Tile value={`${now.workouts} of ${profile?.weekly_target ?? 4}`} label="workouts this week" sub={`${before.workouts} last week`} />
        <Tile value={now.volume.toLocaleString()} label="lb lifted this week" sub={volumeChange === null ? 'no last week to compare' : `${signed(volumeChange)}% vs last week`} good={(volumeChange ?? 0) > 0} />
        <Tile value={`${now.cardioMinutes} of ${CARDIO_TARGET}`} label="cardio minutes" sub={`${now.miles} mi · ${before.cardioMinutes} min last week`} good={now.cardioMinutes >= CARDIO_TARGET} />
        <Tile value={now.avgSteps === null ? '—' : now.avgSteps.toLocaleString()} label="average daily steps" sub={`target ${(profile?.step_target ?? 8000).toLocaleString()}`} good={now.avgSteps !== null && now.avgSteps >= (profile?.step_target ?? 8000)} />
      </div>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <Label>Body weight · 7-day average</Label>
          {latest && monthAgo && <span className={cx('text-[13px] font-semibold', latest.value <= monthAgo.value ? 'text-accent' : 'text-muted')}>{signed(Number((latest.value - monthAgo.value).toFixed(1)))} lb in 4 weeks</span>}
        </div>
        {latest ? <span className="num text-[32px] leading-none font-bold tracking-[-1px]">{latest.value.toFixed(1)} lb</span> : <span className="text-sm text-muted">{mine ? 'Log your weight on the Log tab to start the trend line.' : 'No weigh-ins yet.'}</span>}
        {weights.length > 0 && (
          <LineChart
            label={`Body weight trend, currently ${latest?.value.toFixed(1)} pounds`}
            series={[
              { points: weights, color: 'var(--color-muted)', dots: true },
              { points: trend, color: 'var(--color-accent)' },
            ]}
          />
        )}
      </Card>

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-semibold">Sets per muscle this week</span>
          <span className="text-xs text-muted">target {WEEKLY_SET_TARGET}</span>
        </div>
        {groups.map((g) => {
          const n = now.setsByGroup[g] ?? 0
          return (
            <div key={g} className="grid grid-cols-[84px_1fr_24px] items-center gap-2.5 text-[13px]">
              <span>{groupLabels[g]}</span>
              <span className="h-2.5 overflow-hidden rounded-full bg-raised">
                <span className={cx('block h-full rounded-full', n >= WEEKLY_SET_TARGET * 0.8 ? 'bg-accent' : 'bg-warn')} style={{ width: `${Math.min(100, (n / WEEKLY_SET_TARGET) * 100)}%` }} />
              </span>
              <span className="num text-right font-semibold">{n}</span>
            </div>
          )
        })}
        <span className="text-xs text-muted">Amber is under target so far this week. Warm-up sets are not counted.</span>
      </Card>

      <Card className="flex flex-col gap-2.5">
        <button className="flex h-8 items-center self-start text-[13px] font-medium text-muted" onClick={() => setPicking(true)} disabled={lifts.length === 0}>
          {key ? `${lifts.find((l) => l.key === key)?.name} · estimated max ▾` : 'Lift progress'}
        </button>
        {series.length ? (
          <>
            <div className="flex items-baseline gap-2">
              <span className="num text-[32px] leading-none font-bold tracking-[-1px]">{series[series.length - 1].value} lb</span>
              {liftChange !== null && <span className={cx('text-[13px] font-semibold', liftChange > 0 ? 'text-accent' : 'text-muted')}>{signed(liftChange)} since {parseLocal(series[0].date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>}
            </div>
            <LineChart label={`Estimated max over time, currently ${series[series.length - 1].value} pounds`} series={[{ points: series, color: 'var(--color-accent)' }]} />
            <span className="text-xs text-muted">
              Best set last time: {series[series.length - 1].weight} × {series[series.length - 1].reps}. The estimate turns weight and reps into one number so sets can be compared.
            </span>
          </>
        ) : (
          <span className="text-sm text-muted">Finish a workout and your lifts will be charted here.</span>
        )}
      </Card>

      {best.length > 0 && (
        <Card className="flex flex-col gap-2">
          <Label>Personal records</Label>
          {best.slice(0, 8).map((r) => (
            <div key={r.key} className="flex items-baseline justify-between gap-3 text-sm">
              <span>{r.name}</span>
              <span className="num shrink-0 font-semibold">
                {r.weight} × {r.reps}
              </span>
            </div>
          ))}
        </Card>
      )}

      <GoalsCard compact={!mine} userId={user!.id} goals={goals} weights={weights} sessions={sessions} />

      <Card className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <Label>Training days · last 26 weeks</Label>
          <span className="num text-[13px] text-muted">{[...trained].filter((d) => d >= firstWeek).length}</span>
        </div>
        <div role="img" aria-label={`${[...trained].filter((d) => d >= firstWeek).length} training days in the last 26 weeks`} className="grid grid-flow-col grid-rows-7 gap-[3px]">
          {columns.flat().map((d) => (
            <span key={d} className={cx('aspect-square rounded-[3px]', trained.has(d) ? 'bg-accent' : d > localDate() ? 'bg-transparent' : 'bg-raised')} />
          ))}
        </div>
      </Card>

      {mine && (
        <Link to="/history" className="flex h-12 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
          Workout history ({sessions.length})
        </Link>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)}>
        <div className="scroll-y flex max-h-[60vh] flex-col gap-2 pb-3">
          <span className="text-[15px] font-semibold">Which lift?</span>
          {lifts.map((l) => (
            <button
              key={l.key}
              onClick={() => {
                setLiftKey(l.key)
                setPicking(false)
              }}
              className={cx('min-h-[48px] rounded-control border px-3.5 text-left text-[15px]', l.key === key ? 'border-accent bg-accent-dim font-semibold' : 'border-line bg-raised')}
            >
              {l.name}
            </button>
          ))}
        </div>
      </Sheet>
    </div>
  )
}

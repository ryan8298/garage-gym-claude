import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '../lib/auth'
import { useProfile } from '../lib/data'
import type { Profile } from '../lib/db'
import { addDays, localDate, parseLocal } from '../lib/dates'
import { markFeedSeen, recordsIn, toggleReaction, usePartner, useReactions } from '../lib/partner'
import { thisWeek, useCardio, useLogs, useSessions, weekStats, type DoneSession } from '../lib/progressData'
import { setBadge } from '../lib/push'
import { movingAverage, weeklyStreak } from '../lib/stats'
import { Button, Card, Icon, Label, Sheet, cx } from '../components/ui'
import { LineChart } from '../components/LineChart'

const THUMB = 'M7 11v9H4v-9zM7 11l4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 012 2.3l-1.2 7A2 2 0 0117.8 20H7'
const when = (date: string) => {
  const today = localDate()
  if (date === today) return 'Today'
  if (date === addDays(today, -1)) return 'Yesterday'
  return parseLocal(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

function usePerson(id: string | undefined) {
  const sessions = useSessions(id ?? '') ?? []
  const logs = useLogs(id ?? '')
  const cardio = useCardio(id ?? '')
  return { sessions, logs, cardio }
}

function PersonCard({ profile, data, color, week }: { profile: Profile | null | undefined; data: ReturnType<typeof usePerson>; color: string; week: string }) {
  const stats = weekStats(week, data.sessions, data.logs, data.cardio)
  const target = profile?.weekly_target ?? 4
  const streak = weeklyStreak(data.sessions.map((s) => s.session.local_date), Math.min(3, target), thisWeek())
  const prs = data.sessions.filter((s) => s.session.local_date >= week && s.session.local_date <= addDays(week, 6)).reduce((n, s) => n + recordsIn(data.sessions, s), 0)
  const name = profile?.display_name || '—'
  return (
    <div className="flex flex-col gap-2.5 rounded-card border border-line bg-surface p-3.5">
      <div className="flex items-center gap-2">
        <span className="num flex h-[30px] w-[30px] items-center justify-center rounded-full text-sm font-bold text-accent-ink" style={{ background: color }}>
          {name[0]?.toUpperCase()}
        </span>
        <span className="truncate text-[15px] font-semibold">{name}</span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className="num text-[32px] leading-none font-bold">{stats.workouts}</span>
        <span className="text-[13px] text-muted">of {target} workouts</span>
      </div>
      <div className="flex gap-1">
        {Array.from({ length: target }, (_, i) => (
          <span key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i < stats.workouts ? color : 'var(--color-line)' }} />
        ))}
      </div>
      <div className="flex flex-col gap-1 text-[13px] text-muted">
        <span>
          <b className="font-semibold text-ink">{streak} week</b> streak
        </span>
        <span>
          <b className="font-semibold text-ink">{stats.cardioMinutes} min</b> cardio · {stats.miles} mi
        </span>
        <span>
          <b className="font-semibold text-ink">{prs}</b> PR{prs === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  )
}

export function Us() {
  const { user } = useAuth()
  const me = useProfile(user!.id)
  const partner = usePartner(user!.id)
  const mine = usePerson(user!.id)
  const theirs = usePerson(partner?.id)
  const reactions = useReactions()
  const [recap, setRecap] = useState(false)
  const week = thisWeek()

  // Opening this tab clears the badge on the app icon.
  useEffect(() => {
    markFeedSeen()
    setBadge(0)
  }, [theirs.sessions.length])

  const feed = useMemo(() => {
    const cutoff = addDays(localDate(), -21)
    const tag = (who: 'me' | 'partner', all: DoneSession[]) => all.filter((s) => s.session.local_date >= cutoff).map((s) => ({ who, s, prs: recordsIn(all, s) }))
    return [...tag('me', mine.sessions), ...tag('partner', theirs.sessions)].sort((a, b) => (a.s.session.finished_at! < b.s.session.finished_at! ? 1 : -1)).slice(0, 12)
  }, [mine.sessions, theirs.sessions])

  const trend = (logs: typeof mine.logs) => {
    const avg = movingAverage(logs.filter((l) => l.body_weight !== null).map((l) => ({ date: l.log_date, value: l.body_weight as number })))
    return avg.length ? avg.map((p) => ({ date: p.date, value: Number((p.value - avg[0].value).toFixed(1)) })) : []
  }
  const myTrend = trend(mine.logs)
  const theirTrend = trend(theirs.logs)
  const last = (t: { value: number }[]) => (t.length ? t[t.length - 1].value : null)
  const signed = (n: number | null) => (n === null ? 'no data' : `${n > 0 ? '+' : ''}${n} lb`)
  const lastWeek = addDays(week, -7)
  const recapOf = (d: ReturnType<typeof usePerson>) => ({ now: weekStats(lastWeek, d.sessions, d.logs, d.cardio), before: weekStats(addDays(lastWeek, -7), d.sessions, d.logs, d.cardio) })

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-baseline justify-between">
        <h1 className="font-display text-[28px] font-bold tracking-[-0.5px]">Us</h1>
        <span className="text-[13px] text-muted">Week of {parseLocal(week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
      </header>

      <div className="grid grid-cols-2 gap-2.5">
        <PersonCard profile={me} data={mine} color="var(--color-accent)" week={week} />
        {partner ? (
          <PersonCard profile={partner} data={theirs} color="var(--color-coach)" week={week} />
        ) : (
          <div className="flex items-center rounded-card border border-dashed border-line-strong p-3.5 text-[13px] text-muted">No partner yet. Invite one from Settings, under Training partners.</div>
        )}
      </div>

      <Card className="flex flex-col gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold">Body weight change</span>
          <span className="text-xs text-muted">7-day average, measured from each person's first weigh-in</span>
        </div>
        <LineChart
          label={`Body weight change. ${me?.display_name ?? 'Me'} ${signed(last(myTrend))}, ${partner?.display_name ?? 'partner'} ${signed(last(theirTrend))}`}
          height={80}
          unit=" lb"
          series={[
            { points: myTrend, color: 'var(--color-accent)' },
            { points: theirTrend, color: 'var(--color-coach)' },
          ]}
        />
        <div className="flex gap-4 text-[13px]">
          <span>
            <b className="font-semibold text-accent">{me?.display_name ?? 'Me'}</b> {signed(last(myTrend))}
          </span>
          {partner && (
            <span>
              <b className="font-semibold text-coach">{partner.display_name}</b> {signed(last(theirTrend))}
            </span>
          )}
        </div>
      </Card>

      <div className="flex flex-col gap-2">
        <Label>Activity</Label>
        {feed.length === 0 && <Card className="text-sm text-muted">Finished workouts from both of you show up here.</Card>}
        {feed.map(({ who, s, prs }) => {
          const owner = who === 'me' ? (me?.display_name ?? 'You') : (partner?.display_name ?? 'Partner')
          const iReacted = reactions.some((r) => r.user_id === user!.id && r.session_id === s.session.id)
          const theyReacted = reactions.some((r) => r.user_id !== user!.id && r.session_id === s.session.id)
          return (
            <div key={s.session.id} className="flex items-center gap-3 rounded-2xl border border-line bg-surface py-2.5 pr-3 pl-3.5">
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-medium">
                  {owner} finished {s.session.title}
                </span>
                <span className="text-xs text-muted">
                  {when(s.session.local_date)}
                  {s.minutes ? ` · ${s.minutes} min` : ''}
                  {prs ? ` · ${prs} PR${prs === 1 ? '' : 's'}` : ''}
                  {who === 'me' && theyReacted ? ` · ${partner?.display_name ?? 'Partner'} cheered` : ''}
                </span>
              </div>
              {who === 'partner' ? (
                <button
                  aria-label={iReacted ? 'Remove your cheer' : `Cheer ${owner}'s workout`}
                  aria-pressed={iReacted}
                  onClick={() => void toggleReaction(user!.id, s.session.id, !iReacted)}
                  className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-full border', iReacted ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-raised text-accent')}
                >
                  <Icon d={THUMB} size={20} fill={iReacted} />
                </button>
              ) : (
                theyReacted && (
                  <span role="img" aria-label="Cheered" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-coach-dim text-coach">
                    <Icon d={THUMB} size={20} fill />
                  </span>
                )
              )}
            </div>
          )
        })}
      </div>

      <Button onClick={() => setRecap(true)}>See last week's recap</Button>

      <Sheet open={recap} onClose={() => setRecap(false)}>
        <div className="flex flex-col gap-3.5 pb-3">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[22px] font-bold">Last week</span>
            <span className="text-[13px] text-muted">
              {parseLocal(lastWeek).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} to {parseLocal(addDays(lastWeek, 6)).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
          </div>
          {[
            { name: me?.display_name ?? 'Me', r: recapOf(mine), t: myTrend, show: true },
            { name: partner?.display_name ?? 'Partner', r: recapOf(theirs), t: theirTrend, show: !!partner },
          ]
            .filter((p) => p.show)
            .map(({ name, r }) => (
              <div key={name} className="flex flex-col gap-2 rounded-control bg-raised p-3.5">
                <span className="text-[15px] font-semibold">{name}</span>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[13px] text-muted">
                  {[
                    ['Workouts', r.now.workouts, r.before.workouts, ''],
                    ['Pounds lifted', r.now.volume, r.before.volume, ''],
                    ['Sets', r.now.sets, r.before.sets, ''],
                    ['Cardio', r.now.cardioMinutes, r.before.cardioMinutes, ' min'],
                    ['Miles', r.now.miles, r.before.miles, ''],
                  ].map(([label, now, before, unit]) => (
                    <span key={label as string}>
                      {label}: <b className="num font-semibold text-ink">{(now as number).toLocaleString()}{unit}</b>
                      <span className="num"> (was {(before as number).toLocaleString()})</span>
                    </span>
                  ))}
                </div>
              </div>
            ))}
          <Button onClick={() => setRecap(false)}>Close</Button>
        </div>
      </Sheet>
    </div>
  )
}

import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { addDays, localDate, shortDate, weekStart } from '../lib/dates'
import { deleteCardio, saveCardio, useCardio } from '../lib/progressData'
import { clock, unlockSound, useWakeLock } from '../lib/rest'
import { accept, pace, routeMiles, thin, type Point } from '../lib/track'
import { RouteMap } from '../components/RouteMap'
import { Button, Card, Label, RoundButton, cx, icons } from '../components/ui'

const KINDS = ['Run', 'Walk', 'Hike', 'Bike']
const SAVED = 'gg.track'
const stat = 'flex flex-col gap-0.5'
const big = 'num text-[26px] leading-none font-bold'

/** Cardio: this week against the target, tracked routes and everything logged by hand. */
export function Cardio() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const entries = useCardio(user!.id)
  const start = weekStart(localDate())
  const week = entries.filter((c) => c.log_date >= start && c.log_date <= addDays(start, 6))
  const minutes = Math.round(week.reduce((n, c) => n + (c.minutes ?? 0), 0))
  const miles = week.reduce((n, c) => n + (c.distance ?? 0), 0)
  const recent = [...entries].sort((a, b) => (a.log_date < b.log_date ? 1 : a.log_date > b.log_date ? -1 : a.updated_at < b.updated_at ? 1 : -1)).slice(0, 30)

  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <h1 className="font-display text-[24px] font-bold tracking-[-0.5px]">Cardio</h1>
      </header>

      <Card className="flex flex-col gap-3">
        <div className="flex items-end justify-between gap-3">
          <div className={stat}>
            <span className={big}>
              {minutes}
              <span className="font-sans text-sm font-medium text-muted"> of 150 min</span>
            </span>
            <span className="text-xs text-muted">this week · {miles.toFixed(1)} mi</span>
          </div>
        </div>
        <span className="h-2.5 overflow-hidden rounded-full bg-raised">
          <span className={cx('block h-full rounded-full', minutes >= 150 ? 'bg-accent' : 'bg-coach')} style={{ width: `${Math.min(100, (minutes / 150) * 100)}%` }} />
        </span>
      </Card>

      <Link to="/cardio/track" onClick={unlockSound} className="flex h-[58px] items-center justify-center rounded-2xl bg-accent font-display text-[19px] font-bold text-accent-ink">
        Track a run or walk
      </Link>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/log" className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
          Log one by hand
        </Link>
        <Link to="/timer" className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold">
          Interval timer
        </Link>
      </div>

      <Label>Recent</Label>
      {recent.length === 0 && <Card className="text-sm text-muted">Nothing yet. Track a run or walk with the map, or log one by hand. Walking counts toward the 150 minutes.</Card>}
      {recent.length > 0 && (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          {recent.map((c, i) => (
            <Link key={c.id} to={`/cardio/${c.id}`} className={cx('flex min-h-[58px] items-center justify-between gap-3 px-4 py-2', i > 0 && 'border-t border-line')}>
              <span className="flex flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  {c.kind}
                  {c.route?.length ? <span className="ml-2 text-xs font-medium text-accent">map</span> : null}
                </span>
                <span className="text-xs text-muted">{c.log_date === localDate() ? 'Today' : shortDate(c.log_date)}</span>
              </span>
              <span className="num text-right text-sm text-muted">
                {c.distance ? `${c.distance} mi · ` : ''}
                {c.minutes ?? 0} min
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

/** One cardio entry, with its route on the map if it was tracked. */
export function CardioDetail() {
  const { id = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const entry = useCardio(user!.id).find((c) => c.id === id)
  if (!entry) return <div className="px-5 pt-6 text-sm text-muted">Loading…</div>
  const seconds = (entry.minutes ?? 0) * 60
  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">{entry.kind}</h1>
          <span className="text-xs text-muted">{entry.log_date === localDate() ? 'Today' : shortDate(entry.log_date)}</span>
        </div>
      </header>
      {entry.route?.length ? <RouteMap route={entry.route} height={320} /> : <Card className="text-sm text-muted">Logged by hand, so there is no route.</Card>}
      <Card className="grid grid-cols-3 gap-2">
        <div className={stat}>
          <span className={big}>{entry.distance ?? '—'}</span>
          <span className="text-xs text-muted">miles</span>
        </div>
        <div className={stat}>
          <span className={big}>{entry.minutes ?? '—'}</span>
          <span className="text-xs text-muted">minutes</span>
        </div>
        <div className={stat}>
          <span className={big}>{pace(seconds, entry.distance ?? 0) || '—'}</span>
          <span className="text-xs text-muted">per mile</span>
        </div>
      </Card>
      <Button
        variant="danger"
        onClick={() => {
          if (!window.confirm('Delete this entry? It will no longer count toward your week.')) return
          void deleteCardio(entry).then(() => navigate(-1))
        }}
      >
        Delete
      </Button>
    </div>
  )
}

interface Saved {
  kind: string
  route: Point[]
  /** Seconds of moving time banked before the current stretch. */
  banked: number
  /** When the current stretch began, or null while paused. */
  since: number | null
  at: number
}

/** Live tracking: distance, time, pace and the route on a map, from the phone's location. */
export function CardioTrack() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [kind, setKind] = useState('Run')
  const [route, setRoute] = useState<Point[]>([])
  const [banked, setBanked] = useState(0)
  const [since, setSince] = useState<number | null>(null)
  const [started, setStarted] = useState(false)
  const [problem, setProblem] = useState<string | null>(null)
  const [waiting, setWaiting] = useState(false)
  const [, tick] = useState(0)
  const last = useRef<{ point: Point; at: number } | null>(null)
  const running = since !== null
  useWakeLock(running)

  // Pick up a session that was cut short by a reload, paused.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SAVED) ?? 'null') as Saved | null
      if (!saved || Date.now() - saved.at > 6 * 3600_000) return
      setKind(saved.kind)
      setRoute(saved.route)
      setBanked(saved.banked + (saved.since ? Math.max(0, (saved.at - saved.since) / 1000) : 0))
      setStarted(true)
      const end = saved.route[saved.route.length - 1]
      if (end) last.current = { point: end, at: saved.at }
    } catch {
      /* nothing saved */
    }
  }, [])

  useEffect(() => {
    if (!started) return
    localStorage.setItem(SAVED, JSON.stringify({ kind, route, banked, since, at: Date.now() } satisfies Saved))
  }, [started, kind, route, banked, since])

  useEffect(() => {
    if (!running) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])

  // Follow the phone's location while running.
  useEffect(() => {
    if (!running) return
    if (!('geolocation' in navigator)) return setProblem('This phone does not share its location with web apps.')
    setWaiting(true)
    const watch = navigator.geolocation.watchPosition(
      (pos) => {
        setWaiting(false)
        setProblem(null)
        const next = { point: [pos.coords.latitude, pos.coords.longitude] as Point, at: pos.timestamp, accuracy: pos.coords.accuracy }
        if (!accept(last.current, next)) return
        last.current = { point: next.point, at: next.at }
        setRoute((r) => [...r, next.point])
      },
      (err) => {
        setWaiting(false)
        setProblem(err.code === err.PERMISSION_DENIED ? 'Location is switched off for this app. Allow it in iPhone Settings, Privacy, Location Services, then try again.' : 'Waiting for a location signal. It works best outdoors.')
      },
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 },
    )
    return () => navigator.geolocation.clearWatch(watch)
  }, [running])

  const seconds = Math.floor(banked + (since ? (Date.now() - since) / 1000 : 0))
  const miles = routeMiles(route)
  const pause = () => {
    if (since) setBanked((b) => b + (Date.now() - since) / 1000)
    setSince(null)
    // A gap while paused is not distance covered.
    last.current = null
  }

  if (!started) {
    return (
      <div className="flex flex-col gap-4 px-5 pt-3 pb-6">
        <header className="flex items-center gap-2.5">
          <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
          <h1 className="font-display text-xl font-bold">Track with the map</h1>
        </header>
        <div className="grid grid-cols-4 gap-2" role="group" aria-label="Kind of cardio">
          {KINDS.map((k) => (
            <button key={k} aria-pressed={kind === k} onClick={() => setKind(k)} className={cx('h-12 rounded-control border text-sm font-semibold', kind === k ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}>
              {k}
            </button>
          ))}
        </div>
        <Card className="flex flex-col gap-2 text-[13px] leading-relaxed text-muted">
          <span className="text-sm font-semibold text-ink">Keep this screen open while you move</span>
          <span>The app keeps the screen on and follows your location. If the phone locks or you switch to another app, tracking stops until you come back, and the gap is joined with a straight line.</span>
          <span>iPhone will ask for permission to use your location the first time.</span>
        </Card>
        <Button
          variant="primary"
          onClick={() => {
            unlockSound()
            setStarted(true)
            setSince(Date.now())
          }}
        >
          Start
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3.5 px-5 pt-3 pb-6">
      <header className="flex items-center justify-between gap-2.5">
        <h1 className="font-display text-xl font-bold">
          {kind}
          {!running && <span className="ml-2 text-sm font-medium text-warn">paused</span>}
        </h1>
        <button
          className="h-11 px-2 text-sm font-semibold text-danger"
          onClick={() => {
            if (!window.confirm('Throw this one away? Nothing will be saved.')) return
            localStorage.removeItem(SAVED)
            navigate(-1)
          }}
        >
          Discard
        </button>
      </header>

      <RouteMap route={route} follow height={300} />
      {(problem || waiting) && <span role="status" className="text-[13px] text-warn">{problem ?? 'Finding your location…'}</span>}

      <Card className="grid grid-cols-3 gap-2">
        <div className={stat}>
          <span className={cx(big, '!text-[34px]')}>{miles.toFixed(2)}</span>
          <span className="text-xs text-muted">miles</span>
        </div>
        <div className={stat} role="timer" aria-live="off">
          <span className={cx(big, '!text-[34px]')}>{clock(seconds)}</span>
          <span className="text-xs text-muted">time</span>
        </div>
        <div className={stat}>
          <span className={cx(big, '!text-[34px]')}>{pace(seconds, miles) || '—'}</span>
          <span className="text-xs text-muted">per mile</span>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-2">
        {running ? (
          <Button className="!h-[58px] !rounded-2xl !text-base" onClick={pause}>
            Pause
          </Button>
        ) : (
          <Button className="!h-[58px] !rounded-2xl !text-base" onClick={() => setSince(Date.now())}>
            Resume
          </Button>
        )}
        <Button
          variant="primary"
          onClick={() => {
            const total = Math.floor(banked + (since ? (Date.now() - since) / 1000 : 0))
            localStorage.removeItem(SAVED)
            void saveCardio(user!.id, { date: localDate(), kind, minutes: Math.max(1, Math.round(total / 60)), distance: Number(miles.toFixed(2)), route: thin(route) }).then((id) => navigate(`/cardio/${id}`, { replace: true }))
          }}
        >
          Finish
        </Button>
      </div>
      <span className="text-center text-xs text-muted">Keep this screen open. Tracking stops while the phone is locked.</span>
    </div>
  )
}

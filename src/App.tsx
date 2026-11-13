import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation, useNavigate, useNavigationType } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { useLiveQuery } from 'dexie-react-hooks'
import { useAuth } from './lib/auth'
import { db } from './lib/db'
import { isIOS, isStandalone } from './lib/platform'
import { requestSync, setSignedIn, startSync } from './lib/syncRunner'
import { Button, Icon, icons, cx } from './components/ui'
import { Login } from './screens/Login'
import { Today } from './screens/Today'
import { Log } from './screens/Log'
import { Settings } from './screens/Settings'
import { Library } from './screens/Library'
import { ExerciseDetail } from './screens/ExerciseDetail'
import { WorkoutPreview } from './screens/WorkoutPreview'
import { Session, useElapsed } from './screens/Session'
import { SessionDone } from './screens/SessionDone'
import { Progress } from './screens/Progress'
import { History, HistoryDetail } from './screens/History'
import { Us } from './screens/Us'
import { Photos } from './screens/Photos'
import { ProgramEditor } from './screens/ProgramEditor'
import { Onboarding } from './screens/Onboarding'
import { Coach } from './screens/Coach'
import { Intervals } from './screens/Intervals'
import { GymEditor } from './screens/GymEditor'
import { useProgram } from './lib/programState'
import { setGear } from './lib/plates'
import { activeGym, gearOf } from './lib/gym'
import { registerCustom, type CustomExercise } from './lib/exercises'
import { useSyncStatus } from './lib/syncRunner'
import { renewPush, setBadge } from './lib/push'
import { lastSeenFeed, usePartner } from './lib/partner'
import { useActiveSession } from './lib/session'
import { clock, useRest } from './lib/rest'

const tabs = [
  { to: '/', label: 'Today', d: icons.today },
  { to: '/library', label: 'Library', d: icons.library },
  { to: '/log', label: 'Log', d: icons.log },
  { to: '/progress', label: 'Progress', d: icons.progress },
  { to: '/us', label: 'Us', d: icons.us },
]

function TabBar() {
  return (
    <nav aria-label="Tabs" className="pb-safe flex shrink-0 border-t border-line bg-bar px-2 pt-2">
      {tabs.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          end={t.to === '/'}
          aria-label={t.label}
          className={({ isActive }) =>
            cx('flex h-12 flex-1 flex-col items-center justify-center gap-1 text-[11px]', isActive ? 'font-semibold text-accent' : 'font-medium text-muted')
          }
        >
          <Icon d={t.d} />
          {t.label}
        </NavLink>
      ))}
    </nav>
  )
}

/** Shown when a new version has been downloaded. Never reloads by itself. */
function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Look for a new version whenever the app comes back to the front.
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration?.update().catch(() => undefined)
      })
    },
  })
  const { user } = useAuth()
  // Only my own open workout holds an update back; my partner's rows are in this database too.
  const workoutOpen = useLiveQuery(() => db.workout_sessions.filter((s) => s.user_id === user?.id && !s.finished_at && !s.deleted).count(), [user?.id], 0)
  if (!needRefresh || workoutOpen > 0) return null
  return (
    <div className="mx-4 mb-2 flex shrink-0 items-center gap-3 rounded-card border border-coach-line bg-coach-dim py-2 pr-2 pl-4">
      <span className="flex-1 text-sm font-medium">Update available</span>
      <button className="h-11 px-2 text-sm text-muted" onClick={() => setNeedRefresh(false)}>
        Later
      </button>
      <button className="h-11 rounded-control bg-coach px-4 text-sm font-semibold text-accent-ink" onClick={() => void updateServiceWorker(true)}>
        Update
      </button>
    </div>
  )
}

/** In Safari (not installed), show how to add the app to the Home Screen. */
function InstallGuide({ children }: { children: ReactNode }) {
  const [skipped, setSkipped] = useState(() => sessionStorage.getItem('gg.skipInstall') === '1')
  if (isStandalone() || !isIOS() || skipped) return <>{children}</>
  return (
    <div className="pt-safe pb-safe flex min-h-dvh flex-col gap-6 px-6">
      <div className="mt-10 flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[1px] text-accent">ONE-TIME SETUP</span>
        <h1 className="font-display text-[32px] leading-[1.05] font-bold tracking-[-0.6px]">Add Garage Gym to your Home Screen</h1>
        <p className="text-[15px] leading-relaxed text-muted">It then opens full screen like any other app, and works in the garage without signal.</p>
      </div>
      <ol className="flex flex-col gap-4">
        {[
          <>
            Tap the <b className="text-ink">Share</b> button in Safari's toolbar <span className="inline-block align-middle text-coach"><Icon d={icons.share} size={18} /></span>
          </>,
          <>
            Scroll down and tap <b className="text-ink">Add to Home Screen</b>
          </>,
          <>
            Tap <b className="text-ink">Add</b>, then open Garage Gym from its new icon
          </>,
        ].map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-sm font-bold">{i + 1}</span>
            <span className="text-[15px] leading-snug text-muted">{step}</span>
          </li>
        ))}
      </ol>
      <p className="text-[13px] text-muted">This must be done in Safari. Chrome and in-app browsers cannot install it.</p>
      <Button
        className="mt-auto mb-4"
        onClick={() => {
          sessionStorage.setItem('gg.skipInstall', '1')
          setSkipped(true)
        }}
      >
        Continue in the browser for now
      </Button>
    </div>
  )
}

/** While a workout is open, every other screen shows a bar that leads back to it. */
function ResumeBar() {
  const { user } = useAuth()
  const session = useActiveSession(user?.id)
  const elapsed = useElapsed(session?.started_at)
  const rest = useRest()
  if (!session) return null
  return (
    <NavLink to="/session" className="mx-3 mb-2 flex h-14 shrink-0 items-center gap-3 rounded-2xl border border-accent bg-accent-dim px-4">
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[11px] font-semibold tracking-[1px] text-accent">WORKOUT IN PROGRESS</span>
        <span className="truncate text-sm font-semibold">{session.title}</span>
      </span>
      <span className="num text-sm font-semibold">{rest && !rest.over ? `Rest ${clock(rest.remaining)}` : elapsed}</span>
    </NavLink>
  )
}

/** Keeps the number on the app icon equal to the partner workouts not yet seen on the Us tab. */
function useFeedBadge() {
  const { user } = useAuth()
  const partner = usePartner(user?.id ?? '')
  const unseen = useLiveQuery(
    async () => {
      if (!partner) return 0
      const seen = lastSeenFeed()
      return db.workout_sessions.where('user_id').equals(partner.id).filter((s) => !!s.finished_at && !s.deleted && s.finished_at > seen).count()
    },
    [partner?.id],
    0,
  )
  useEffect(() => setBadge(unseen), [unseen])
}

const isTabRoot = (path: string) => tabs.some((t) => t.to === path)

/**
 * Swipe from the left edge to go back, as in a native app. The screen follows
 * the finger; past a third of the way it goes back, otherwise it springs home.
 */
function useSwipeBack(enabled: boolean) {
  const navigate = useNavigate()
  useEffect(() => {
    if (!enabled) return
    let startX = 0
    let startY = 0
    let dx = 0
    let tracking = false
    let moving = false
    const target = () => document.querySelector<HTMLElement>('[data-swipe]')
    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      tracking = e.touches.length === 1 && t.clientX <= 28 && !document.querySelector('[role="dialog"]')
      moving = false
      dx = 0
      startX = t.clientX
      startY = t.clientY
    }
    const move = (e: TouchEvent) => {
      if (!tracking) return
      const t = e.touches[0]
      dx = Math.max(0, t.clientX - startX)
      if (!moving) {
        if (Math.abs(t.clientY - startY) > 14 && dx < 14) tracking = false
        if (dx < 10) return
        moving = true
      }
      e.preventDefault()
      const el = target()
      if (el) {
        el.style.transition = 'none'
        el.style.transform = `translateX(${dx}px)`
      }
    }
    const end = () => {
      if (!tracking || !moving) return
      tracking = false
      const el = target()
      const go = dx > Math.min(130, window.innerWidth / 3)
      if (el) {
        el.style.transition = go ? 'none' : 'transform .2s'
        el.style.transform = ''
      }
      if (go) {
        if ((window.history.state?.idx ?? 0) > 0) navigate(-1)
        else navigate('/', { replace: true })
      }
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: false })
    document.addEventListener('touchend', end)
    document.addEventListener('touchcancel', end)
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', end)
      document.removeEventListener('touchcancel', end)
    }
  }, [enabled, navigate])
}

function Shell() {
  const location = useLocation()
  const navType = useNavigationType()
  const path = location.pathname
  useSwipeBack(!isTabRoot(path) && path !== '/session' && !path.startsWith('/done/'))
  // Going deeper slides in from the right, going back from the left, and switching tabs fades.
  const motion = location.key === 'default' ? '' : navType === 'POP' ? 'pop' : isTabRoot(path) ? 'fade' : 'push'
  useFeedBadge()
  const { user } = useAuth()
  const program = useProgram(user!.id)
  // Exercises either of us has added become part of the library on this phone.
  const customs = useLiveQuery(async () => JSON.stringify((await db.program_state.toArray()).flatMap((r) => r.data?.custom ?? [])), [], '[]')
  const [, setLibrary] = useState('')
  useEffect(() => {
    registerCustom(JSON.parse(customs) as CustomExercise[])
    setLibrary(customs)
  }, [customs])
  // Plate math follows the inventory in Settings.
  const gear = JSON.stringify(gearOf(activeGym(program)))
  useEffect(() => setGear(JSON.parse(gear)), [gear])

  // Every screen opens at its top. The page scrolls as a whole, so nothing resets it for us.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [path])
  // The tabs are fixed over the page; the page ends with room for them, however tall they are.
  const bar = useRef<HTMLDivElement>(null)
  const [barHeight, setBarHeight] = useState(76)
  useEffect(() => {
    const el = bar.current
    if (!el || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => el.offsetHeight > 0 && setBarHeight(el.offsetHeight + 8))
    watch.observe(el)
    return () => watch.disconnect()
  })

  // While the keyboard is up the tabs are hidden, as in a native app. iOS otherwise
  // floats a fixed bar above the keyboard on some scrolls and drops it on others.
  const [typing, setTyping] = useState(false)
  useEffect(() => {
    const isText = (t: EventTarget | null) => t instanceof HTMLTextAreaElement || (t instanceof HTMLInputElement && !['checkbox', 'radio', 'button', 'file'].includes(t.type))
    const focus = (e: FocusEvent) => isText(e.target) && setTyping(true)
    const blur = () => setTimeout(() => setTyping(isText(document.activeElement)), 50)
    document.addEventListener('focusin', focus)
    document.addEventListener('focusout', blur)
    return () => {
      document.removeEventListener('focusin', focus)
      document.removeEventListener('focusout', blur)
    }
  }, [])

  // First-run setup: only for someone with no workouts, and only once the first
  // sync has finished, so a returning user on a new phone is not asked again.
  const sync = useSyncStatus()
  const hasHistory = useLiveQuery(() => db.workout_sessions.where('user_id').equals(user!.id).count().then((n) => n > 0), [user!.id])
  const profile = useLiveQuery(() => db.profiles.get(user!.id), [user!.id])
  if (!program.onboarded && hasHistory === false && (sync.lastSynced !== null || !navigator.onLine)) {
    return <Onboarding suggestedName={profile?.display_name ?? ''} />
  }
  if (location.pathname === '/session') return <Session />
  if (location.pathname === '/coach') return <Coach />
  if (location.pathname.startsWith('/done/'))
    return (
      <Routes>
        <Route path="/done/:id" element={<SessionDone />} />
      </Routes>
    )
  return (
    <div>
      <main key={location.pathname} data-swipe className={cx(motion, 'pt-safe')} style={{ paddingBottom: barHeight }}>
        <Routes location={location}>
          <Route path="/" element={<Today />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:key" element={<ExerciseDetail />} />
          <Route path="/workout/:day" element={<WorkoutPreview />} />
          <Route path="/log" element={<Log />} />
          <Route path="/progress" element={<Progress />} />
          <Route path="/history" element={<History />} />
          <Route path="/history/:id" element={<HistoryDetail />} />
          <Route path="/us" element={<Us />} />
          <Route path="/photos" element={<Photos />} />
          <Route path="/timer" element={<Intervals />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/program" element={<ProgramEditor />} />
          <Route path="/settings/gym/:id" element={<GymEditor />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <div ref={bar} className={cx('fixed inset-x-0 bottom-0 z-20 bg-bg', typing && 'hidden')}>
        <UpdatePrompt />
        <ResumeBar />
        <TabBar />
      </div>
    </div>
  )
}

export default function App() {
  const { user } = useAuth()

  useEffect(() => {
    setSignedIn(!!user)
    if (user) {
      startSync()
      requestSync(0)
      void renewPush(user.id)
    }
  }, [user])

  // Ask the browser not to evict our local data under storage pressure.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined)
  }, [])

  return <InstallGuide>{user ? <Shell /> : <Login />}</InstallGuide>
}

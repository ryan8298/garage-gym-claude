import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { ComingSoon } from './screens/ComingSoon'
import { Library } from './screens/Library'
import { ExerciseDetail } from './screens/ExerciseDetail'
import { WorkoutPreview } from './screens/WorkoutPreview'

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
  const workoutOpen = useLiveQuery(() => db.workout_sessions.filter((s) => !s.finished_at && !s.deleted).count(), [], 0)
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
    <div className="pt-safe pb-safe flex h-full flex-col gap-6 px-6">
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

function Shell() {
  const location = useLocation()
  return (
    <div className="flex h-full flex-col">
      <main key={location.pathname} className="push scroll-y pt-safe min-h-0 flex-1">
        <Routes location={location}>
          <Route path="/" element={<Today />} />
          <Route path="/library" element={<Library />} />
          <Route path="/library/:key" element={<ExerciseDetail />} />
          <Route path="/workout/:day" element={<WorkoutPreview />} />
          <Route path="/log" element={<Log />} />
          <Route path="/progress" element={<ComingSoon title="Progress" phase={4} what="Strength charts, the weekly muscle map, goals and your workout history." />} />
          <Route path="/us" element={<ComingSoon title="Us" phase={5} what="Both of your weeks side by side, the activity feed and reactions." />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <UpdatePrompt />
      <TabBar />
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
    }
  }, [user])

  // Ask the browser not to evict our local data under storage pressure.
  useEffect(() => {
    void navigator.storage?.persist?.().catch(() => undefined)
  }, [])

  return <InstallGuide>{user ? <Shell /> : <Login />}</InstallGuide>
}

import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { exercise, groupLabels, hasExercise, equipLabels, stepsFor } from '../lib/exercises'
import { saveProgram, useProgram } from '../lib/programState'
import { Button, Card, Label, RoundButton, cx, icons } from '../components/ui'

/** Pull the video id out of any normal YouTube link. Returns null if it is not one. */
export function youtubeId(url: string): string | null {
  const m = url.trim().match(/(?:youtu\.be\/|youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/))([\w-]{11})/)
  return m ? m[1] : null
}

export function ExerciseDetail() {
  const { key = '' } = useParams()
  const { user } = useAuth()
  const navigate = useNavigate()
  const program = useProgram(user!.id)
  const [adding, setAdding] = useState(false)
  const [link, setLink] = useState('')
  const [bad, setBad] = useState(false)
  const [steps, setSteps] = useState<string[]>([])
  useEffect(() => {
    setSteps([])
    if (hasExercise(key)) void stepsFor(exercise(key)).then(setSteps)
  }, [key])
  if (!hasExercise(key)) return <Navigate to="/library" replace />
  const e = exercise(key)
  const videoId = program.videos[key] ? youtubeId(program.videos[key]) : null
  const pinned = program.pins.includes(key)
  const banned = program.bans.includes(key)
  const toggle = (list: 'pins' | 'bans') => {
    const has = program[list].includes(key)
    const other = list === 'pins' ? 'bans' : 'pins'
    void saveProgram(user!.id, { [list]: has ? program[list].filter((k) => k !== key) : [...program[list], key], [other]: program[other].filter((k) => k !== key) })
  }
  const muscles = e.primary.length ? e.primary.join(', ') : groupLabels[e.group].toLowerCase()

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-[22px] leading-tight font-bold">{e.name}</h1>
          <span className="text-xs text-muted">
            {muscles} · {equipLabels[e.equip]}
            {e.side ? ' · one side at a time' : ''}
          </span>
        </div>
      </header>

      {videoId ? (
        <div className="aspect-video overflow-hidden rounded-card border border-line bg-surface">
          {navigator.onLine ? (
            <iframe
              title={`${e.name} video`}
              src={`https://www.youtube-nocookie.com/embed/${videoId}?playsinline=1&rel=0`}
              allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
              className="h-full w-full"
            />
          ) : (
            <p className="flex h-full items-center justify-center px-6 text-center text-sm text-muted">Video needs a connection. The steps below work offline.</p>
          )}
        </div>
      ) : e.images.length ? (
        <div className="grid grid-cols-2 gap-2">
          {e.images.map((src, i) => (
            <figure key={src} className="overflow-hidden rounded-2xl border border-line bg-surface">
              <img src={src} alt={`${e.name}, ${i === 0 ? 'start' : 'end'} position`} className="aspect-[3/2] w-full object-cover" />
              <figcaption className="px-2 py-1 text-center text-[11px] text-muted">{i === 0 ? 'Start' : 'End'}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <div className="flex h-24 items-center justify-center rounded-card border border-dashed border-line-strong text-sm text-muted">No picture for this exercise yet</div>
      )}

      {adding ? (
        <Card className="flex flex-col gap-2.5">
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Paste a YouTube link
            <input
              type="url"
              inputMode="url"
              value={link}
              onChange={(ev) => {
                setLink(ev.target.value)
                setBad(false)
              }}
              className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none focus:border-accent"
            />
          </label>
          {bad && <span className="text-[13px] text-danger">That does not look like a YouTube link.</span>}
          <div className="grid grid-cols-2 gap-2">
            <Button onClick={() => setAdding(false)}>Cancel</Button>
            <Button
              variant="primary"
              className="!h-11 !text-sm"
              onClick={() => {
                if (!youtubeId(link)) return setBad(true)
                void saveProgram(user!.id, { videos: { ...program.videos, [key]: link.trim() } })
                setAdding(false)
                setLink('')
              }}
            >
              Save
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => setAdding(true)}>{videoId ? 'Change video' : 'Add video'}</Button>
          {videoId ? (
            <Button
              onClick={() => {
                const { [key]: _removed, ...rest } = program.videos
                void saveProgram(user!.id, { videos: rest })
              }}
            >
              Remove video
            </Button>
          ) : (
            <a
              href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${e.name} proper form`)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-11 items-center justify-center rounded-control border border-line bg-raised text-sm font-semibold text-coach"
            >
              Search YouTube
            </a>
          )}
        </div>
      )}

      {e.setup && (
        <div className="flex flex-col gap-1.5 rounded-2xl bg-accent-dim p-3.5">
          <Label tone="accent">Setup on the M1 Pro</Label>
          <p className="text-sm leading-relaxed">{e.setup}</p>
        </div>
      )}

      <ol className="flex flex-col gap-2.5">
        {steps.map((step, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-sm font-bold">{i + 1}</span>
            <span className="text-sm leading-relaxed">{step}</span>
          </li>
        ))}
      </ol>

      {e.cues && (
        <Card className="flex flex-col gap-2">
          <Label>Watch for</Label>
          <ul className="flex flex-col gap-1.5">
            {e.cues.map((c) => (
              <li key={c} className="flex gap-2 text-sm leading-relaxed">
                <span className="text-warn">•</span>
                {c}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {e.secondary.length > 0 && <p className="text-xs text-muted">Also works: {e.secondary.join(', ')}</p>}

      <Card className="flex flex-col gap-2.5">
        <Label>In my program</Label>
        <div className="grid grid-cols-2 gap-2">
          <button aria-pressed={pinned} onClick={() => toggle('pins')} className={cx('h-11 rounded-control border text-sm font-semibold', pinned ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-ink')}>
            {pinned ? 'Always used' : 'Always use'}
          </button>
          <button aria-pressed={banned} onClick={() => toggle('bans')} className={cx('h-11 rounded-control border text-sm font-semibold', banned ? 'border-danger bg-raised text-danger' : 'border-line bg-raised text-ink')}>
            {banned ? 'Never used' : 'Never use'}
          </button>
        </div>
        <span className="text-xs text-muted">"Always use" keeps it in its slot instead of rotating out. "Never use" removes it from the rotation.</span>
      </Card>
    </div>
  )
}

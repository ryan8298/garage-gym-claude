import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { localDate, parseLocal } from '../lib/dates'
import { addPhoto, removePhoto, usePhotos, useSignedUrls } from '../lib/photos'
import { Button, Card, RoundButton, cx, icons } from '../components/ui'

const nice = (d: string) => parseLocal(d).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })

export function Photos() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const photos = usePhotos(user!.id)
  const urls = useSignedUrls(photos)
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [picked, setPicked] = useState<string[]>([])
  const pair = picked.map((id) => photos.find((p) => p.id === id)).filter((p): p is NonNullable<typeof p> => !!p).sort((a, b) => (a.taken_on < b.taken_on ? -1 : 1))

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <header className="flex items-center gap-2.5">
        <RoundButton label="Back" d={icons.back} onClick={() => navigate(-1)} />
        <div className="flex flex-col">
          <h1 className="font-display text-xl font-bold">Progress photos</h1>
          <span className="text-xs text-muted">Private. Only you can ever see these.</span>
        </div>
      </header>

      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ''
          if (!file) return
          setBusy(true)
          setError(null)
          void addPhoto(user!.id, localDate(), file).then((err) => {
            setError(err)
            setBusy(false)
          })
        }}
      />
      <Button variant="primary" disabled={busy} onClick={() => input.current?.click()}>
        {busy ? 'Uploading…' : 'Add a photo'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!navigator.onLine && <Card className="text-sm text-muted">Photos need a connection to load and upload.</Card>}

      {pair.length === 2 && (
        <Card className="flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            {pair.map((p) => (
              <figure key={p.id} className="flex flex-col gap-1">
                {urls[p.path] ? <img src={urls[p.path]} alt={`Photo from ${nice(p.taken_on)}`} className="aspect-[3/4] w-full rounded-xl object-cover" /> : <div className="aspect-[3/4] rounded-xl bg-raised" />}
                <figcaption className="text-center text-xs text-muted">{nice(p.taken_on)}</figcaption>
              </figure>
            ))}
          </div>
          <Button onClick={() => setPicked([])}>Clear comparison</Button>
        </Card>
      )}

      {photos.length === 0 ? (
        <Card className="text-sm text-muted">Take one about once a month, in the same spot and light, so changes are easy to see.</Card>
      ) : (
        <>
          <span className="text-xs text-muted">{pair.length === 2 ? 'Tap a photo to change the comparison.' : 'Tap two photos to compare them side by side.'}</span>
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => {
              const on = picked.includes(p.id)
              return (
                <div key={p.id} className="flex flex-col gap-1">
                  <button
                    aria-pressed={on}
                    aria-label={`Photo from ${nice(p.taken_on)}`}
                    onClick={() => setPicked((cur) => (on ? cur.filter((x) => x !== p.id) : [...cur.slice(-1), p.id]))}
                    className={cx('aspect-[3/4] overflow-hidden rounded-xl border-2 bg-raised', on ? 'border-accent' : 'border-transparent')}
                  >
                    {urls[p.path] && <img src={urls[p.path]} alt="" className="h-full w-full object-cover" />}
                  </button>
                  <span className="text-center text-[11px] text-muted">{nice(p.taken_on)}</span>
                  <button className="h-8 text-[11px] text-danger" onClick={() => window.confirm('Delete this photo for good?') && void removePhoto(p)}>
                    Delete
                  </button>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

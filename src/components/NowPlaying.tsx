import { useSpotify } from '../lib/spotify'
import { Icon } from './ui'

/** A slim bar showing the song playing in Spotify, with previous, play or pause, and next. */
export function NowPlaying() {
  const { connected, track, toggle, next, previous } = useSpotify(true)
  if (!connected || !track) return null
  const button = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink'
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-1 pr-1 pl-2">
      {track.art ? <img src={track.art} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="h-9 w-9 shrink-0 rounded-lg bg-raised" />}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px] font-semibold">{track.title}</span>
        <span className="truncate text-[11px] text-muted">{track.artist}</span>
      </span>
      <button aria-label="Previous song" className={button} onClick={previous}>
        <Icon d="M19 5v14l-9-7zM6 5v14" size={20} />
      </button>
      <button aria-label={track.playing ? 'Pause music' : 'Play music'} className={`${button} bg-raised`} onClick={toggle}>
        <Icon d={track.playing ? 'M8 5v14M16 5v14' : 'M7 4l13 8-13 8z'} size={20} />
      </button>
      <button aria-label="Next song" className={button} onClick={next}>
        <Icon d="M5 5v14l9-7zM18 5v14" size={20} />
      </button>
    </div>
  )
}

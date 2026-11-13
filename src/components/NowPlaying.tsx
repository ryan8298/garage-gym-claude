import { useSpotify } from '../lib/spotify'
import { Icon } from './ui'

/**
 * The song playing in Spotify, with previous, play or pause, and next. Once
 * Spotify is connected this bar is always here: it says so when nothing is
 * playing or when Spotify cannot be reached, so it is never a mystery.
 */
export function NowPlaying() {
  const { connected, state, toggle, next, previous } = useSpotify(true)
  if (!connected) return null
  const button = 'flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-ink'
  const song = state?.kind === 'song' ? state.song : null
  return (
    <div className="flex items-center gap-2.5 rounded-2xl border border-line bg-surface py-1 pr-1 pl-2">
      {song?.art ? <img src={song.art} alt="" className="h-9 w-9 shrink-0 rounded-lg object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-raised text-muted"><Icon d="M9 18V6l10-2v12M9 18a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0zM19 16a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" size={18} /></span>}
      <span className="flex min-w-0 flex-1 flex-col" role="status">
        {song ? (
          <>
            <span className="truncate text-[13px] font-semibold">{song.title}</span>
            <span className="truncate text-[11px] text-muted">{song.artist}</span>
          </>
        ) : state?.kind === 'problem' ? (
          <span className="py-1 text-[11px] leading-snug text-warn">{state.text}</span>
        ) : (
          <>
            <span className="text-[13px] font-semibold">{state ? 'Nothing playing' : 'Checking Spotify…'}</span>
            <span className="text-[11px] text-muted">Tap play to pick up where Spotify left off</span>
          </>
        )}
      </span>
      {song && (
        <button aria-label="Previous song" className={button} onClick={previous}>
          <Icon d="M19 5v14l-9-7zM6 5v14" size={20} />
        </button>
      )}
      <button aria-label={song?.playing ? 'Pause music' : 'Play music'} className={`${button} bg-raised`} onClick={toggle}>
        <Icon d={song?.playing ? 'M8 5v14M16 5v14' : 'M7 4l13 8-13 8z'} size={20} />
      </button>
      {song && (
        <button aria-label="Next song" className={button} onClick={next}>
          <Icon d="M5 5v14l9-7zM18 5v14" size={20} />
        </button>
      )}
    </div>
  )
}

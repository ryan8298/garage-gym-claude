import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { finishSpotify } from '../lib/spotify'

/** Where Spotify sends the person back after they approve the connection. */
export function SpotifyReturn() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [problem, setProblem] = useState<string | null>(null)
  useEffect(() => {
    void finishSpotify(params).then((error) => (error ? setProblem(error) : navigate('/settings', { replace: true })))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="flex flex-col gap-3 px-5 pt-10">
      <h1 className="font-display text-xl font-bold">{problem ? 'Spotify was not connected' : 'Connecting Spotify…'}</h1>
      {problem && <p className="text-sm text-muted">{problem}</p>}
      {problem && (
        <Link to="/settings" className="flex h-11 items-center text-sm font-semibold text-accent">
          Back to Settings
        </Link>
      )}
    </div>
  )
}

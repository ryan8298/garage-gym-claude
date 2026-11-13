import { useEffect, useState } from 'react'

/**
 * Spotify on the workout screen: what is playing, and play, pause and skip.
 * It controls the Spotify app already playing on this phone (or wherever the
 * account is active); it does not play music itself. Needs Spotify Premium.
 *
 * Sign-in uses Spotify's browser flow (PKCE), so there is no secret anywhere.
 * The tokens stay on this phone and are never synced.
 */

const TOKENS = 'gg.spotify'
const PENDING = 'gg.spotify.pending'
const SCOPES = 'user-read-playback-state user-read-currently-playing user-modify-playback-state'
export const spotifyRedirect = () => `${window.location.origin}/spotify`

interface Tokens {
  clientId: string
  access: string
  refresh: string
  expires: number
}
const read = (): Tokens | null => {
  try {
    return JSON.parse(localStorage.getItem(TOKENS) ?? 'null')
  } catch {
    return null
  }
}
const listeners = new Set<() => void>()
const changed = () => listeners.forEach((l) => l())
export const spotifyConnected = () => read() !== null
export function disconnectSpotify() {
  localStorage.removeItem(TOKENS)
  changed()
}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')

/** Send the person to Spotify to approve the connection. They come back to /spotify. */
export async function connectSpotify(clientId: string) {
  const verifier = base64url(crypto.getRandomValues(new Uint8Array(48)))
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  localStorage.setItem(PENDING, JSON.stringify({ clientId, verifier }))
  const q = new URLSearchParams({ client_id: clientId, response_type: 'code', redirect_uri: spotifyRedirect(), code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES })
  window.location.href = `https://accounts.spotify.com/authorize?${q}`
}

async function token(body: Record<string, string>, clientId: string, keepRefresh?: string): Promise<string | null> {
  const res = await fetch('https://accounts.spotify.com/api/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...body, client_id: clientId }) })
  if (!res.ok) return `Spotify refused the sign-in (${res.status}).`
  const t = (await res.json()) as { access_token: string; refresh_token?: string; expires_in: number }
  localStorage.setItem(TOKENS, JSON.stringify({ clientId, access: t.access_token, refresh: t.refresh_token ?? keepRefresh ?? '', expires: Date.now() + (t.expires_in - 60) * 1000 } satisfies Tokens))
  changed()
  return null
}

/** Finish the connection with the code Spotify sent back. Returns a message if it failed. */
export async function finishSpotify(params: URLSearchParams): Promise<string | null> {
  if (params.get('error')) return 'Spotify was not connected: the request was declined.'
  const code = params.get('code')
  let pending: { clientId: string; verifier: string } | null = null
  try {
    pending = JSON.parse(localStorage.getItem(PENDING) ?? 'null')
  } catch {
    /* none */
  }
  if (!code || !pending) return 'Spotify sent you back without the details needed. Start the connection again from Settings, in this app.'
  localStorage.removeItem(PENDING)
  try {
    return await token({ grant_type: 'authorization_code', code, redirect_uri: spotifyRedirect(), code_verifier: pending.verifier }, pending.clientId)
  } catch {
    return 'No connection to Spotify. Try again when you have signal.'
  }
}

async function access(): Promise<string | null> {
  const t = read()
  if (!t) return null
  if (Date.now() < t.expires) return t.access
  if (!t.refresh) return null
  const failed = await token({ grant_type: 'refresh_token', refresh_token: t.refresh }, t.clientId, t.refresh).catch(() => 'offline')
  return failed ? null : (read()?.access ?? null)
}

async function call(path: string, method = 'GET'): Promise<Response | null> {
  const bearer = await access()
  if (!bearer) return null
  try {
    return await fetch(`https://api.spotify.com/v1${path}`, { method, headers: { Authorization: `Bearer ${bearer}` } })
  } catch {
    return null
  }
}

export interface Playing {
  title: string
  artist: string
  art: string | null
  playing: boolean
}

async function nowPlaying(): Promise<Playing | null> {
  const res = await call('/me/player')
  if (!res || res.status !== 200) return null
  const data = (await res.json()) as { is_playing: boolean; item?: { name: string; artists?: { name: string }[]; album?: { images?: { url: string }[] }; show?: { name: string } } | null }
  if (!data.item) return null
  const images = data.item.album?.images ?? []
  return { title: data.item.name, artist: data.item.artists?.map((a) => a.name).join(', ') ?? data.item.show?.name ?? '', art: images[images.length - 1]?.url ?? null, playing: data.is_playing }
}

/** What is playing, checked every few seconds while `active` and the app is in front. */
export function useSpotify(active: boolean) {
  const [connected, setConnected] = useState(spotifyConnected)
  const [track, setTrack] = useState<Playing | null>(null)
  const [nudge, setNudge] = useState(0)
  useEffect(() => {
    const l = () => setConnected(spotifyConnected())
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  useEffect(() => {
    if (!active || !connected) return setTrack(null)
    let stop = false
    const check = () => {
      if (document.visibilityState === 'visible' && navigator.onLine) void nowPlaying().then((t) => !stop && setTrack(t))
    }
    check()
    const id = setInterval(check, 5000)
    document.addEventListener('visibilitychange', check)
    return () => {
      stop = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [active, connected, nudge])
  const act = (path: string, method: string) => {
    // Show the change at once; the next check confirms it.
    if (path.endsWith('/pause')) setTrack((t) => t && { ...t, playing: false })
    if (path.endsWith('/play')) setTrack((t) => t && { ...t, playing: true })
    void call(path, method).then(() => setTimeout(() => setNudge((n) => n + 1), 600))
  }
  return {
    connected,
    track,
    toggle: () => act(track?.playing ? '/me/player/pause' : '/me/player/play', 'PUT'),
    next: () => act('/me/player/next', 'POST'),
    previous: () => act('/me/player/previous', 'POST'),
  }
}

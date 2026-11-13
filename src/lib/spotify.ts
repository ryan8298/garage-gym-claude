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
/** What Spotify told us: a song, nothing playing, or why it could not answer. */
export type SpotifyState = { kind: 'song'; song: Playing } | { kind: 'idle' } | { kind: 'problem'; text: string }

const reason = async (res: Response | null): Promise<string> => {
  if (!res) return navigator.onLine ? 'Spotify needs connecting again in Settings.' : 'No connection.'
  let detail = ''
  try {
    detail = ((await res.json()) as { error?: { message?: string } }).error?.message ?? ''
  } catch {
    /* no body */
  }
  if (res.status === 401) return 'Spotify needs connecting again in Settings.'
  if (res.status === 403) return `Spotify refused: ${detail || 'this account is not allowed'}. Check the account is added under User Management in your Spotify app and has Premium.`
  if (res.status === 429) return 'Spotify is asking us to slow down. It will retry.'
  return `Spotify answered ${res.status}${detail ? `: ${detail}` : ''}.`
}

export async function spotifyState(): Promise<SpotifyState> {
  const res = await call('/me/player?additional_types=track,episode')
  if (res?.status === 204) return { kind: 'idle' }
  if (!res || res.status !== 200) return { kind: 'problem', text: await reason(res) }
  const data = (await res.json()) as { is_playing: boolean; item?: { name: string; artists?: { name: string }[]; album?: { images?: { url: string }[] }; images?: { url: string }[]; show?: { name: string } } | null }
  if (!data.item) return { kind: 'idle' }
  const images = data.item.album?.images ?? data.item.images ?? []
  return { kind: 'song', song: { title: data.item.name, artist: data.item.artists?.map((x) => x.name).join(', ') ?? data.item.show?.name ?? '', art: images[images.length - 1]?.url ?? null, playing: data.is_playing } }
}

/** Who is connected, for the Settings card. Also the simplest check that the connection works at all. */
export async function spotifyAccount(): Promise<string> {
  const res = await call('/me')
  if (!res || res.status !== 200) return await reason(res)
  const me = (await res.json()) as { display_name?: string; product?: string }
  return `Connected as ${me.display_name ?? 'your account'}${me.product && me.product !== 'premium' ? ' (not Premium: the controls will not work)' : ''}.`
}

/** Start the music. If Spotify has no active device, hand playback to the first one it knows about. */
async function resume(): Promise<string | null> {
  const res = await call('/me/player/play', 'PUT')
  if (res && (res.status === 200 || res.status === 202 || res.status === 204)) return null
  const list = await call('/me/player/devices')
  const devices = list?.status === 200 ? ((await list.json()) as { devices: { id: string | null; is_restricted: boolean }[] }).devices.filter((d) => d.id && !d.is_restricted) : []
  if (devices.length === 0) return 'Open the Spotify app once so it can be found, then tap play again.'
  const bearer = await access()
  if (!bearer) return 'Spotify needs connecting again in Settings.'
  const moved = await fetch('https://api.spotify.com/v1/me/player', { method: 'PUT', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ device_ids: [devices[0].id], play: true }) }).catch(() => null)
  return moved && moved.status < 300 ? null : await reason(moved)
}

/**
 * Spotify's state, checked every few seconds while `active` and the app is in
 * front. It does not matter whether the music or the workout started first.
 */
export function useSpotify(active: boolean) {
  const [connected, setConnected] = useState(spotifyConnected)
  const [state, setState] = useState<SpotifyState | null>(null)
  const [nudge, setNudge] = useState(0)
  useEffect(() => {
    const l = () => setConnected(spotifyConnected())
    listeners.add(l)
    return () => void listeners.delete(l)
  }, [])
  useEffect(() => {
    if (!active || !connected) return setState(null)
    let stop = false
    const check = () => {
      if (document.visibilityState === 'visible') void spotifyState().then((next) => !stop && setState(next))
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
  const recheck = () => setTimeout(() => setNudge((n) => n + 1), 700)
  const act = (path: string, method: string) => {
    // Show the change at once; the next check confirms it.
    if (path.endsWith('/pause')) setState((x) => (x?.kind === 'song' ? { kind: 'song', song: { ...x.song, playing: false } } : x))
    void call(path, method).then(async (res) => {
      if (res && res.status >= 400) setState({ kind: 'problem', text: await reason(res) })
      recheck()
    })
  }
  const play = () => {
    setState((x) => (x?.kind === 'song' ? { kind: 'song', song: { ...x.song, playing: true } } : x))
    void resume().then((problem) => {
      if (problem) setState({ kind: 'problem', text: problem })
      recheck()
    })
  }
  return {
    connected,
    state,
    toggle: () => (state?.kind === 'song' && state.song.playing ? act('/me/player/pause', 'PUT') : play()),
    next: () => act('/me/player/next', 'POST'),
    previous: () => act('/me/player/previous', 'POST'),
  }
}

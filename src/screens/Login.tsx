import { useState, type FormEvent } from 'react'
import { useAuth } from '../lib/auth'
import { configured } from '../lib/supabase'
import { joinWithInvite } from '../lib/group'
import { Button } from '../components/ui'

export function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [joining, setJoining] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    // A new person first turns their invitation into an account, then signs in like anyone else.
    const refused = joining ? await joinWithInvite({ code, name, email, password }) : null
    setError(refused ?? (await signIn(email, password)))
    setBusy(false)
  }

  const field = 'h-[52px] rounded-control border border-line bg-surface px-4 text-ink outline-none focus:border-accent'
  return (
    <form onSubmit={submit} className="pt-safe pb-safe flex min-h-dvh flex-col gap-4 px-6">
      <div className="mt-16 mb-4 flex flex-col gap-2">
        <span className="text-xs font-semibold tracking-[1px] text-accent">GARAGE GYM</span>
        <h1 className="font-display text-[34px] leading-[1.05] font-bold tracking-[-0.6px]">{joining ? 'Join with an invitation' : 'Sign in to start training'}</h1>
      </div>
      {joining && (
        <>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Invitation code
            <input className={`${field} num tracking-[3px]`} type="text" autoCapitalize="characters" autoCorrect="off" maxLength={8} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Your name
            <input className={field} type="text" autoComplete="given-name" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} required />
          </label>
        </>
      )}
      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Email
        <input className={field} type="email" autoComplete="username" autoCapitalize="none" autoCorrect="off" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className="flex flex-col gap-1.5 text-xs text-muted">
        Password
        <input className={field} type="password" autoComplete={joining ? 'new-password' : 'current-password'} minLength={joining ? 8 : undefined} value={password} onChange={(e) => setPassword(e.target.value)} required />
      </label>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {!configured && <p className="text-sm text-warn">This build has no database connection configured.</p>}
      <Button variant="primary" type="submit" disabled={busy} className="mt-2">
        {busy ? (joining ? 'Creating your account…' : 'Signing in…') : joining ? 'Create my account' : 'Sign in'}
      </Button>
      <button
        type="button"
        className="h-11 text-sm font-semibold text-accent"
        onClick={() => {
          setJoining(!joining)
          setError(null)
        }}
      >
        {joining ? 'I already have an account' : 'I have an invitation'}
      </button>
      <p className="text-center text-[13px] text-muted">{joining ? 'Accounts are by invitation from someone already using the app.' : 'You stay signed in on this phone, including offline.'}</p>
    </form>
  )
}

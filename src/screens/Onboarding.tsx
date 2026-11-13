import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { SESSION_LENGTHS, goalLabels, recommend, type Goal } from '../lib/builder'
import { saveDailyLog, saveProfile } from '../lib/data'
import { localDate } from '../lib/dates'
import { equipLabels, type Equip } from '../lib/exercises'
import { EQUIPMENT, homeGym, publicGym } from '../lib/gym'
import { acceptInvite, createInvite, usePartners } from '../lib/group'
import { programDef } from '../lib/program'
import { saveProgram } from '../lib/programState'
import { Button, Icon, Label, NumberPad, RoundButton, cx, icons } from '../components/ui'

const chip = (on: boolean) => cx('min-h-[48px] rounded-control border px-2 text-sm font-semibold', on ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-surface text-muted')
const choice = (on: boolean) => cx('flex min-h-[68px] items-center gap-3 rounded-[20px] border px-4 py-3 text-left', on ? 'border-2 border-accent bg-accent-dim' : 'border-line bg-surface')
const titles = ['First, about you', 'What are you training for?', 'Where do you train?', 'Who do you train with?']

/** Shown once, to someone with no workouts yet: four short steps, then the first workout. */
export function Onboarding({ suggestedName }: { suggestedName: string }) {
  const { user } = useAuth()
  const partners = usePartners(user!.id)
  const [step, setStep] = useState(0)
  const [name, setName] = useState(suggestedName)
  const [weight, setWeight] = useState<number | null>(null)
  const [pad, setPad] = useState(false)
  const [goal, setGoal] = useState<Goal>('fat_loss')
  const [days, setDays] = useState(4)
  const [minutes, setMinutes] = useState(60)
  const [place, setPlace] = useState<'home' | 'public'>('home')
  const [equipment, setEquipment] = useState<string[]>(homeGym().equipment)
  const [pullUps, setPullUps] = useState<boolean | null>(null)
  const [strap, setStrap] = useState(true)
  const [company, setCompany] = useState<'invite' | 'code' | 'solo'>('invite')
  const [invite, setInvite] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [note, setNote] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const advice = recommend({ goal, days })
  const hasPartner = partners.length > 0

  async function finish() {
    setBusy(true)
    await saveProfile(user!.id, { display_name: name.trim(), weekly_target: days })
    if (weight !== null) await saveDailyLog(user!.id, localDate(), { body_weight: weight })
    await saveProgram(user!.id, {
      template: advice.template,
      goal,
      minutes,
      pullMain: pullUps ? 'pull_up' : 'lat_pulldown',
      ankleStrap: strap,
      partner: hasPartner || company !== 'solo',
      gyms: [{ ...homeGym(), equipment: place === 'home' ? equipment : homeGym().equipment }, publicGym()],
      gym: place,
      onboarded: true,
    })
  }

  const ready = [name.trim().length > 0, true, place === 'public' || pullUps !== null, true][step]
  const toggle = (e: string) => setEquipment((list) => (list.includes(e) ? list.filter((x) => x !== e) : [...list, e]))

  return (
    <div className="scroll-y pt-safe pb-safe flex h-dvh flex-col gap-5 px-6">
      <div className="mt-2 flex items-center gap-3">
        {step > 0 ? <RoundButton label="Back" d={icons.back} onClick={() => setStep(step - 1)} /> : <span className="h-11 w-11" />}
        <div role="img" aria-label={`Step ${step + 1} of 4`} className="grid flex-1 grid-cols-4 gap-1.5">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={cx('h-[5px] rounded-full', i <= step ? 'bg-accent' : 'bg-line')} />
          ))}
        </div>
        <span className="num w-11 text-right text-[13px] text-muted">{step + 1} of 4</span>
      </div>

      <h1 className="font-display text-[32px] leading-[1.05] font-bold tracking-[-0.6px]">{titles[step]}</h1>

      {step === 0 && (
        <>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            What should the app call you?
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} autoCapitalize="words" className="h-[52px] rounded-control border border-line bg-surface px-4 text-ink outline-none focus:border-accent" />
          </label>
          <div className="flex flex-col gap-1.5">
            <Label>Body weight today (optional)</Label>
            <button onClick={() => setPad(true)} className="flex h-[52px] items-center rounded-control border border-line bg-surface px-4">
              <span className={cx('num text-xl font-bold', weight === null && 'text-muted')}>{weight === null ? 'Tap to enter' : `${weight} lb`}</span>
            </button>
            <span className="text-xs text-muted">Only you and your training partner see it.</span>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="grid grid-cols-3 gap-2">
            {(Object.keys(goalLabels) as Goal[]).map((g) => (
              <button key={g} aria-pressed={goal === g} onClick={() => setGoal(g)} className={chip(goal === g)}>
                {goalLabels[g]}
              </button>
            ))}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Days a week</Label>
            <div className="grid grid-cols-5 gap-2">
              {[2, 3, 4, 5, 6].map((d) => (
                <button key={d} aria-pressed={days === d} onClick={() => setDays(d)} className={cx(chip(days === d), 'num text-lg')}>
                  {d}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Longest session</Label>
            <div className="grid grid-cols-4 gap-2">
              {SESSION_LENGTHS.map((m) => (
                <button key={m} aria-pressed={minutes === m} onClick={() => setMinutes(m)} className={cx(chip(minutes === m), 'num')}>
                  {m} min
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-1 rounded-[20px] border border-accent bg-accent-dim p-4">
            <Label tone="accent">Your program</Label>
            <span className="font-display text-xl font-bold">{programDef(advice.template).name}</span>
            <span className="text-[13px] leading-snug text-muted">{advice.why} You can change it any time on the Plan tab.</span>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="flex flex-col gap-2.5">
            <button aria-pressed={place === 'home'} onClick={() => setPlace('home')} className={choice(place === 'home')}>
              <span className="flex flex-col gap-0.5">
                <span className="text-[17px] font-semibold">At home</span>
                <span className="text-[13px] text-muted">Tell us what you have and the plan uses only that</span>
              </span>
            </button>
            <button aria-pressed={place === 'public'} onClick={() => setPlace('public')} className={choice(place === 'public')}>
              <span className="flex flex-col gap-0.5">
                <span className="text-[17px] font-semibold">At a gym</span>
                <span className="text-[13px] text-muted">We assume it has everything</span>
              </span>
            </button>
          </div>
          {place === 'home' && (
            <div className="flex flex-col gap-1.5">
              <Label>What is in your home gym?</Label>
              <div className="flex flex-wrap gap-2">
                {EQUIPMENT.filter((e) => e !== 'other').map((e) => (
                  <button key={e} aria-pressed={equipment.includes(e)} onClick={() => toggle(e)} className={cx(chip(equipment.includes(e)), '!min-h-[44px] rounded-full px-3.5')}>
                    {equipLabels[e as Equip]}
                  </button>
                ))}
              </div>
              <span className="text-xs text-muted">Bodyweight exercises are always included. Bar weights and plates can be set later on the Plan tab.</span>
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <Label>Can you do 5 or more pull-ups in a row?</Label>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  [true, 'Yes'],
                  [false, 'Not yet'],
                ] as const
              ).map(([v, text]) => (
                <button key={text} aria-pressed={pullUps === v} onClick={() => setPullUps(v)} className={chip(pullUps === v)}>
                  {text}
                </button>
              ))}
            </div>
          </div>
          {(place === 'public' || equipment.includes('cable')) && (
            <label className="flex min-h-[44px] items-center justify-between gap-3">
              <span className="text-sm font-medium">I have an ankle strap for the cables</span>
              <input type="checkbox" role="switch" className="switch" checked={strap} onChange={(e) => setStrap(e.target.checked)} />
            </label>
          )}
        </>
      )}

      {step === 3 && (
        <>
          <p className="-mt-2 text-[15px] leading-relaxed text-muted">One phone can log for both of you, taking turns. Each person keeps their own weights, history and records.</p>
          {hasPartner ? (
            <div className="flex flex-col gap-1 rounded-[20px] border-2 border-accent bg-accent-dim p-4">
              <span className="text-[17px] font-semibold">You are training with {partners.map((p) => p.display_name || 'your partner').join(' and ')}</span>
              <span className="text-[13px] text-muted">You joined with their invitation, so you are already connected.</span>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              <button aria-pressed={company === 'invite'} onClick={() => setCompany('invite')} className={cx(choice(company === 'invite'), '!items-start flex-col')}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-semibold">A partner</span>
                  <span className="text-[13px] text-muted">Send them a code to join you</span>
                </span>
              </button>
              {company === 'invite' &&
                (invite ? (
                  <div className="flex items-center justify-between gap-3 rounded-control bg-surface p-3.5">
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[11px] text-muted">Their code, good for 7 days</span>
                      <span className="num text-2xl font-bold tracking-[3px] select-text">{invite}</span>
                    </span>
                    <Button
                      variant="primary"
                      className="!h-11 px-4 !text-sm"
                      onClick={() => {
                        const text = `Join me on Garage Gym. Open ${window.location.origin}, tap "I have an invitation" and enter the code ${invite}.`
                        if (navigator.share) void navigator.share({ text }).catch(() => undefined)
                        else void navigator.clipboard?.writeText(text).then(() => setNote('Copied.'))
                      }}
                    >
                      Send
                    </Button>
                  </div>
                ) : (
                  <Button disabled={busy} onClick={() => void createInvite().then((r) => (r.code ? setInvite(r.code) : setNote(r.error ?? 'Could not make an invitation.')))}>
                    Get an invitation code
                  </Button>
                ))}
              <button aria-pressed={company === 'code'} onClick={() => setCompany('code')} className={choice(company === 'code')}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-semibold">I have a code</span>
                  <span className="text-[13px] text-muted">Join someone who invited you</span>
                </span>
              </button>
              {company === 'code' && (
                <span className="flex gap-2">
                  <input
                    type="text"
                    aria-label="Invitation code"
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    autoCapitalize="characters"
                    autoCorrect="off"
                    placeholder="8-character code"
                    className="num h-12 min-w-0 flex-1 rounded-control border border-line bg-surface px-3.5 tracking-[2px] text-ink outline-none focus:border-accent"
                  />
                  <Button
                    disabled={busy || code.trim().length !== 8}
                    onClick={() => {
                      setBusy(true)
                      void acceptInvite(user!.id, code).then((error) => {
                        setBusy(false)
                        setNote(error ?? 'Joined.')
                      })
                    }}
                  >
                    Join
                  </Button>
                </span>
              )}
              <button aria-pressed={company === 'solo'} onClick={() => setCompany('solo')} className={choice(company === 'solo')}>
                <span className="flex flex-col gap-0.5">
                  <span className="text-[17px] font-semibold">On my own for now</span>
                  <span className="text-[13px] text-muted">Invite someone later from Settings</span>
                </span>
              </button>
            </div>
          )}
          {note && (
            <span role="status" className="text-[13px] text-muted">
              {note}
            </span>
          )}
          <p className="rounded-control bg-surface p-3.5 text-[13px] leading-relaxed text-muted">
            Your first session has no suggested weights. Start light and pick a weight that leaves about 2 reps in the tank. From the second session on, the app suggests your numbers.
          </p>
        </>
      )}

      <div className="mt-auto flex shrink-0 flex-col gap-1 pb-4">
        {step < 3 ? (
          <Button variant="primary" disabled={!ready} onClick={() => setStep(step + 1)}>
            Next
            <span className="ml-1.5">
              <Icon d={icons.next} size={20} />
            </span>
          </Button>
        ) : (
          <Button variant="primary" disabled={busy} onClick={() => void finish()}>
            {busy ? 'Saving…' : 'Start training'}
          </Button>
        )}
      </div>

      <NumberPad open={pad} title="Body weight" unit="lb" initial={weight} step={0.2} decimals={1} onClose={() => setPad(false)} onDone={(v) => (setWeight(v), setPad(false))} />
    </div>
  )
}

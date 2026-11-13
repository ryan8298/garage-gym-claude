import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import { equipLabels, exercises, groupLabels, matchesQuery, type CustomExercise, type Equip, type Measure } from '../lib/exercises'
import { activeGym, availableAt } from '../lib/gym'
import { saveProgram, useProgram } from '../lib/programState'
import { Button, Sheet, cx } from '../components/ui'

function Chips<T extends string>({ label, options, value, onChange }: { label: string; options: [T, string][]; value: T | null; onChange(v: T | null): void }) {
  return (
    <div className="scroll-x -mx-5 flex gap-2 overflow-x-auto px-5" role="group" aria-label={label} style={{ scrollbarWidth: 'none' }}>
      {options.map(([key, text]) => (
        <button
          key={key}
          aria-pressed={value === key}
          onClick={() => onChange(value === key ? null : key)}
          className={cx('h-11 shrink-0 rounded-full border px-4 text-[13px] font-semibold', value === key ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-surface text-muted')}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

export function Library() {
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState<string | null>(null)
  const [equip, setEquip] = useState<Equip | null>(null)
  const [here, setHere] = useState(true)
  const { user } = useAuth()
  const program = useProgram(user!.id)
  const gym = activeGym(program)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState<{ name: string; group: string; equip: Equip; measure: Measure; side: boolean }>({ name: '', group: 'chest', equip: 'dumbbell', measure: 'wr', side: false })
  const gymKey = `${gym.id}:${gym.equipment.join()}`
  const list = useMemo(() => {
    return exercises
      .filter((e) => (!group || e.group === group) && (!equip || e.equip === equip) && matchesQuery(e, query) && (!here || availableAt(gym, e)))
      .sort((a, b) => Number(b.curated) - Number(a.curated) || a.name.localeCompare(b.name))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, group, equip, here, gymKey, exercises.length])
  const [shown, setShown] = useState(60)
  const visible = list.slice(0, shown)

  return (
    <div className="flex flex-col gap-3 px-5 pt-3 pb-6">
      <h1 className="font-display text-[28px] font-bold tracking-[-0.5px]">Library</h1>
      <label className="flex flex-col">
        <span className="sr-only">Search exercises</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${exercises.length} exercises`}
          className="h-12 rounded-control border border-line bg-surface px-4 text-ink outline-none focus:border-accent"
        />
      </label>
      <Chips<string> label="Muscle group" options={Object.entries(groupLabels)} value={group} onChange={setGroup} />
      <Chips<Equip> label="Equipment" options={Object.entries(equipLabels) as [Equip, string][]} value={equip} onChange={setEquip} />
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-muted">
          {list.length} {here ? `you can do at ${gym.name}` : 'in the whole library'}
        </span>
        <button aria-pressed={!here} onClick={() => setHere(!here)} className="h-9 text-[13px] font-semibold text-accent">
          {here ? 'Show everything' : `Only ${gym.name}`}
        </button>
      </div>

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {list.length === 0 && (
          <p className="p-4 text-sm text-muted">
            {here ? `Nothing matches at ${gym.name}. ` : 'No exercises match. Clear a filter or change the search.'}
            {here && (
              <button className="font-semibold text-accent" onClick={() => setHere(false)}>
                Show the whole library
              </button>
            )}
          </p>
        )}
        {visible.map((e, i) => (
          <Link key={e.key} to={`/library/${e.key}`} className={cx('flex min-h-[64px] items-center gap-3 px-3 py-2', i > 0 && 'border-t border-line')}>
            {e.images[0] ? (
              <img src={e.images[0]} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="num flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-raised text-lg font-bold text-faint">{e.name[0]}</span>
            )}
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-medium">{e.name}</span>
              <span className="text-xs text-muted">
                {groupLabels[e.group]} · {equipLabels[e.equip]}
                {e.custom && ' · yours'}
                {!availableAt(gym, e) && ` · not at ${gym.name}`}
              </span>
            </span>
          </Link>
        ))}
      </div>
      {list.length > shown && <Button onClick={() => setShown(shown + 100)}>Show more ({list.length - shown} left)</Button>}
      <Button
        onClick={() => {
          setDraft((d) => ({ ...d, name: query.trim() }))
          setAdding(true)
        }}
      >
        + Add your own exercise
      </Button>

      <Sheet open={adding} onClose={() => setAdding(false)}>
        <div className="scroll-y flex max-h-[80vh] flex-col gap-3 pb-3 [&>*]:shrink-0">
          <span className="font-display text-[22px] font-bold">Your own exercise</span>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Name
            <input type="text" value={draft.name} maxLength={50} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="For example: Belt squat" className="h-12 rounded-control border border-line bg-raised px-3.5 text-ink outline-none focus:border-accent" />
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Main muscle group (counts toward its weekly sets)
            <select value={draft.group} onChange={(e) => setDraft({ ...draft, group: e.target.value })} className="h-12 rounded-control border border-line bg-raised px-3 text-[16px] text-ink">
              {Object.entries(groupLabels).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-xs text-muted">
            Equipment
            <select value={draft.equip} onChange={(e) => setDraft({ ...draft, equip: e.target.value as Equip })} className="h-12 rounded-control border border-line bg-raised px-3 text-[16px] text-ink">
              {(Object.entries(equipLabels) as [Equip, string][]).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="How it is logged">
            {(
              [
                ['wr', 'Weight × reps'],
                ['bw', 'Bodyweight reps'],
                ['time', 'Time held'],
              ] as [Measure, string][]
            ).map(([m, label]) => (
              <button key={m} aria-pressed={draft.measure === m} onClick={() => setDraft({ ...draft, measure: m })} className={cx('h-12 rounded-control border px-1 text-[13px] font-semibold', draft.measure === m ? 'border-accent bg-accent-dim text-accent' : 'border-line bg-raised text-muted')}>
                {label}
              </button>
            ))}
          </div>
          <label className="flex min-h-[44px] items-center justify-between gap-3">
            <span className="text-sm font-medium">Done one side at a time</span>
            <input type="checkbox" role="switch" className="switch" checked={draft.side} onChange={(e) => setDraft({ ...draft, side: e.target.checked })} />
          </label>
          <Button
            variant="primary"
            disabled={draft.name.trim().length < 2}
            onClick={() => {
              const mine: CustomExercise = { ...draft, name: draft.name.trim(), key: `c_${crypto.randomUUID().slice(0, 8)}` }
              void saveProgram(user!.id, { custom: [...(program.custom ?? []), mine] })
              setAdding(false)
              setQuery(mine.name)
              setHere(false)
            }}
          >
            Add to the library
          </Button>
          <span className="text-xs text-muted">Both of you can use it. It can be added to any workout and swapped in for any lift.</span>
        </div>
      </Sheet>
    </div>
  )
}

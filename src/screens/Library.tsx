import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { exercises, groupLabels, stationLabels, type Station } from '../lib/exercises'
import { cx } from '../components/ui'

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
  const [station, setStation] = useState<Station | null>(null)
  const list = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises
      .filter((e) => (!group || e.group === group) && (!station || e.station === station) && (!q || e.name.toLowerCase().includes(q)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [query, group, station])

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
      <Chips<Station> label="Equipment" options={Object.entries(stationLabels) as [Station, string][]} value={station} onChange={setStation} />

      <div className="overflow-hidden rounded-card border border-line bg-surface">
        {list.length === 0 && <p className="p-4 text-sm text-muted">No exercises match. Clear a filter or change the search.</p>}
        {list.map((e, i) => (
          <Link key={e.key} to={`/library/${e.key}`} className={cx('flex min-h-[64px] items-center gap-3 px-3 py-2', i > 0 && 'border-t border-line')}>
            {e.images[0] ? (
              <img src={e.images[0]} alt="" loading="lazy" className="h-12 w-16 shrink-0 rounded-lg object-cover" />
            ) : (
              <span className="num flex h-12 w-16 shrink-0 items-center justify-center rounded-lg bg-raised text-lg font-bold text-faint">{e.name[0]}</span>
            )}
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] font-medium">{e.name}</span>
              <span className="text-xs text-muted">
                {groupLabels[e.group]} · {stationLabels[e.station]}
              </span>
            </span>
          </Link>
        ))}
      </div>
    </div>
  )
}

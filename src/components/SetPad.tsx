import { useEffect, useState } from 'react'
import type { SetRow } from '../lib/db'
import { breakdown, loadModeFor, nearestLoad, stepDown, stepUp, type LoadMode } from '../lib/plates'
import { updateSet, type LiftView } from '../lib/session'
import { Button, Icon, Sheet, cx, icons } from './ui'

type Field = 'weight' | 'reps' | 'seconds'
const fieldsFor = (measure: string): Field[] => (measure === 'time' ? ['seconds'] : measure === 'carry' ? ['weight', 'seconds'] : ['weight', 'reps'])
const types: [SetRow['set_type'], string][] = [
  ['warmup', 'Warm-up'],
  ['normal', 'Normal'],
  ['drop', 'Drop'],
  ['failure', 'Failure'],
]

/** A picture of the plates on one side of the bar, biggest nearest the middle. */
function PlateStack({ plates }: { plates: number[] }) {
  const height = (p: number) => 18 + Math.sqrt(p) * 4.4
  return (
    <div role="img" aria-label={plates.length ? `Plates: ${plates.join(', ')}` : 'No plates'} className="flex shrink-0 items-center gap-[3px]">
      <span className="h-1.5 w-6 rounded-full bg-faint" />
      {plates.map((p, i) => (
        <span key={i} className="rounded-[4px] bg-accent" style={{ width: p >= 25 ? 11 : p >= 10 ? 8 : 6, height: height(p), opacity: 0.55 + 0.45 * (p / 45) }} />
      ))}
      <span className="h-1.5 w-3 rounded-full bg-faint" />
    </div>
  )
}

/**
 * The number pad for a set. It replaces the iOS keyboard: weight moves in
 * steps we can actually load, and the plate breakdown updates as you type.
 */
export function SetPad({ view, set, startOn, onClose, onDeleted }: { view: LiftView; set: SetRow | null; startOn: Field; onClose(): void; onDeleted?(set: SetRow): void }) {
  const measure = view.lift.measure
  const fields = fieldsFor(measure)
  const mode: LoadMode = view.exercise ? loadModeFor(view.exercise) : 'none'
  const [field, setField] = useState<Field>(startOn)
  const [text, setText] = useState<Record<Field, string>>({ weight: '', reps: '', seconds: '' })
  const [fresh, setFresh] = useState(true)
  const [type, setType] = useState<SetRow['set_type']>('normal')

  useEffect(() => {
    if (!set) return
    setText({ weight: set.weight === null ? '' : String(set.weight), reps: set.reps === null ? '' : String(set.reps), seconds: set.duration_seconds === null ? '' : String(set.duration_seconds) })
    setField(fields.includes(startOn) ? startOn : fields[0])
    setType(set.set_type)
    setFresh(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [set?.id, startOn])

  if (!set) return <Sheet open={false} onClose={onClose}>{null}</Sheet>

  const value = text[field]
  const typed = value === '' || value === '.' ? null : Number(value)
  const snapped = field === 'weight' && typed !== null && mode !== 'none' ? nearestLoad(mode, typed) : typed
  const plan = field === 'weight' && snapped !== null ? breakdown(mode, snapped) : null
  const decimals = field === 'weight' && mode !== 'dumbbell' && mode !== 'added' ? 2 : 0
  const unit = field === 'weight' ? (mode === 'added' ? 'lb added' : 'lb') : field === 'reps' ? (view.target.eachSide ? 'reps each' : 'reps') : 'sec'

  const put = (next: string, isFresh = false) => {
    setText((t) => ({ ...t, [field]: next }))
    setFresh(isFresh)
  }
  const press = (k: string) => {
    const base = fresh ? '' : value
    if (k === '.') return decimals === 0 || base.includes('.') ? undefined : put((base || '0') + '.')
    const next = base + k
    const [, frac = ''] = next.split('.')
    if (frac.length > decimals || next.replace('.', '').length > 5) return
    put(next)
  }
  const nudge = (dir: 1 | -1) => {
    const now = typed ?? 0
    if (field === 'weight') put(String(mode === 'none' ? Math.max(0, now + dir * 5) : dir > 0 ? stepUp(mode, snapped ?? 0) : stepDown(mode, snapped ?? 0)), true)
    else put(String(Math.max(0, now + dir * (field === 'seconds' ? 5 : 1))), true)
  }
  const stepLabel = field === 'weight' ? (mode === 'dumbbell' || mode === 'added' ? '5' : mode === 'cable' || mode === 'landmine' ? '1.25' : '2.5') : field === 'seconds' ? '5' : '1'

  const num = (f: Field) => (text[f] === '' || text[f] === '.' ? null : Number(text[f]))
  const save = async () => {
    const weight = num('weight')
    const finalWeight = weight === null ? null : mode === 'none' ? weight : nearestLoad(mode, weight)
    // Carry a new weight down to the later sets that still had the old one (or none).
    if (finalWeight !== set.weight && set.set_type !== 'warmup') {
      for (const later of view.sets) {
        if (later.position > set.position && !later.done && later.set_type !== 'warmup' && (later.weight === null || later.weight === set.weight)) {
          await updateSet(later, { weight: finalWeight })
        }
      }
    }
    await updateSet(set, {
      weight: finalWeight,
      reps: fields.includes('reps') ? num('reps') : null,
      duration_seconds: fields.includes('seconds') ? num('seconds') : null,
      set_type: type,
    })
    onClose()
  }
  const next = fields[fields.indexOf(field) + 1]
  const key = 'num h-[52px] rounded-control bg-raised text-2xl font-semibold'

  return (
    <Sheet open onClose={onClose}>
      <div className="flex flex-col gap-3.5 pb-2">
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-semibold">{view.lift.name}</span>
          {fields.length > 1 && (
            <div className="flex rounded-xl bg-bg p-[3px]">
              {fields.map((f) => (
                <button
                  key={f}
                  aria-pressed={field === f}
                  onClick={() => {
                    setField(f)
                    setFresh(true)
                  }}
                  className={cx('h-[38px] rounded-[10px] px-4 text-sm font-semibold capitalize', field === f ? 'bg-line text-ink' : 'text-muted')}
                >
                  {f === 'seconds' ? 'Time' : f}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3">
          <button aria-label={`Decrease by ${stepLabel}`} className="num h-14 w-[72px] rounded-2xl border border-line bg-raised text-[17px] font-semibold" onClick={() => nudge(-1)}>
            −{stepLabel}
          </button>
          <div className="flex items-baseline gap-1.5">
            <span className={cx('num text-[58px] leading-none font-bold tracking-[-2px]', value === '' && 'text-faint')}>{value === '' ? '0' : value}</span>
            <span className="text-sm font-medium text-muted">{unit}</span>
          </div>
          <button aria-label={`Increase by ${stepLabel}`} className="num h-14 w-[72px] rounded-2xl border border-line bg-raised text-[17px] font-semibold" onClick={() => nudge(1)}>
            +{stepLabel}
          </button>
        </div>

        {field === 'weight' && mode !== 'none' && (
          <div className="flex min-h-[58px] items-center gap-3.5 rounded-2xl bg-bg px-3.5 py-2">
            {(mode === 'barbell' || mode === 'smith' || mode === 'cable' || mode === 'landmine') && <PlateStack plates={plan?.plates ?? []} />}
            <div className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold">{plan ? plan.text : 'Enter a weight'}</span>
              {typed !== null && snapped !== typed && <span className="text-xs text-warn">{typed} lb can't be loaded. Nearest is {snapped} lb.</span>}
              {plan?.overLimit && <span className="text-xs text-danger">Over the Smith bar's 275 lb plate limit.</span>}
            </div>
          </div>
        )}

        <div className="grid grid-cols-3 gap-2">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((k) => (
            <button key={k} className={key} onClick={() => press(k)}>
              {k}
            </button>
          ))}
          <button className={cx(key, 'bg-transparent', decimals === 0 && 'invisible')} onClick={() => press('.')}>
            .
          </button>
          <button className={key} onClick={() => press('0')}>
            0
          </button>
          <button aria-label="Delete digit" className="flex h-[52px] items-center justify-center rounded-control" onClick={() => put(fresh ? '' : value.slice(0, -1))}>
            <Icon d={icons.backspace} size={26} />
          </button>
        </div>

        <div className="grid grid-cols-4 gap-1.5" role="group" aria-label="Set type">
          {types.map(([t, label]) => (
            <button key={t} aria-pressed={type === t} onClick={() => setType(t)} className={cx('h-11 rounded-xl border text-[13px] font-semibold', type === t ? 'border-accent bg-accent-dim text-accent' : 'border-line text-muted')}>
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="danger" className="px-4" onClick={() =>
              void updateSet(set, { deleted: true }).then(() => {
                onDeleted?.(set)
                onClose()
              })
            }>
            Delete set
          </Button>
          {next ? (
            <Button
              variant="primary"
              className="!h-12 !text-base"
              onClick={() => {
                if (field === 'weight' && snapped !== null) setText((t) => ({ ...t, weight: String(snapped) }))
                setField(next)
                setFresh(true)
              }}
            >
              Next: {next === 'seconds' ? 'time' : next}
            </Button>
          ) : (
            <Button variant="primary" className="!h-12 !text-base" onClick={() => void save()}>
              Done
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}

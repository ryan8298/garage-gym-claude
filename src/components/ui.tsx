import { useEffect, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ')

export function Card({ children, className, tone }: { children: ReactNode; className?: string; tone?: 'coach' | 'accent' }) {
  return (
    <div
      className={cx(
        'rounded-card border p-4',
        tone === 'coach'
          ? 'border-coach-line bg-coach-dim'
          : tone === 'accent'
            ? 'border-accent bg-accent-dim'
            : 'border-line bg-surface',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Label({ children, tone }: { children: ReactNode; tone?: 'accent' | 'coach' }) {
  return (
    <span
      className={cx(
        'text-[11px] font-semibold tracking-[1px] uppercase',
        tone === 'accent' ? 'text-accent' : tone === 'coach' ? 'text-coach' : 'text-muted',
      )}
    >
      {children}
    </span>
  )
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' }

export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      className={cx(
        'flex items-center justify-center rounded-control font-semibold disabled:opacity-40',
        variant === 'primary' && 'h-14 bg-accent font-display text-lg font-bold text-accent-ink',
        variant === 'secondary' && 'h-11 border border-line bg-raised text-sm text-ink',
        variant === 'ghost' && 'h-11 text-sm text-accent',
        variant === 'danger' && 'h-11 border border-line bg-raised text-sm text-danger',
        className,
      )}
    />
  )
}

export function Icon({ d, size = 22, fill }: { d: string; size?: number; fill?: boolean }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={fill ? 'currentColor' : 'none'}
      stroke={fill ? 'none' : 'currentColor'}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

export const icons = {
  today: 'M3 11l9-7 9 7v9H3z',
  library: 'M5 4h14v16H5zM9 4v16',
  log: 'M6 3h12v18H6zM9 8h6M9 12h6M9 16h3',
  progress: 'M5 20V11M12 20V4M19 20v-6',
  us: 'M8 11a3 3 0 100-6 3 3 0 000 6zM17 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM2 20c0-3 2.5-5 6-5s6 2 6 5M16 15c3 0 6 1.5 6 5',
  back: 'M15 6l-6 6 6 6',
  next: 'M9 6l6 6-6 6',
  gear: 'M12 15a3 3 0 100-6 3 3 0 000 6zM19 12a7 7 0 00-.1-1.3l2-1.5-2-3.4-2.3.9a7 7 0 00-2.2-1.3L14 3h-4l-.4 2.4a7 7 0 00-2.2 1.3l-2.3-.9-2 3.4 2 1.5a7 7 0 000 2.6l-2 1.5 2 3.4 2.3-.9a7 7 0 002.2 1.3L10 21h4l.4-2.4a7 7 0 002.2-1.3l2.3.9 2-3.4-2-1.5c.1-.4.1-.9.1-1.3z',
  check: 'M5 12l5 5 9-10',
  backspace: 'M9 5h11v14H9l-6-7zM12 10l4 4M16 10l-4 4',
  share: 'M12 15V3M8 7l4-4 4 4M5 12v8h14v-8',
}

let openSheets = 0

/** Bottom sheet. Tap the backdrop or drag the handle area down to close. */
export function Sheet({ open, onClose, children }: { open: boolean; onClose(): void; children: ReactNode }) {
  const [dragY, setDragY] = useState(0)
  const [startY, setStartY] = useState<number | null>(null)
  useEffect(() => {
    if (!open) setDragY(0)
  }, [open])
  // The page behind must not scroll while a sheet is up.
  useEffect(() => {
    if (!open) return
    openSheets++
    document.documentElement.classList.add('locked')
    return () => {
      if (--openSheets === 0) document.documentElement.classList.remove('locked')
    }
  }, [open])
  if (!open) return null
  return createPortal(
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button aria-label="Close" className="backdrop absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        className="sheet pb-safe relative rounded-t-[28px] border-t border-line bg-surface px-5"
        style={{ transform: dragY ? `translateY(${dragY}px)` : undefined, transition: startY === null ? 'transform .2s' : undefined }}
      >
        <div
          className="flex h-7 items-center justify-center"
          onTouchStart={(e) => setStartY(e.touches[0].clientY)}
          onTouchMove={(e) => startY !== null && setDragY(Math.max(0, e.touches[0].clientY - startY))}
          onTouchEnd={() => {
            if (dragY > 90) onClose()
            setDragY(0)
            setStartY(null)
          }}
        >
          <span className="h-[5px] w-10 rounded-full bg-line-strong" />
        </div>
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * In-app number pad, so entering numbers never opens the iOS keyboard.
 * `step` sets the plus and minus buttons.
 */
export function NumberPad({
  open,
  title,
  unit,
  initial,
  step,
  decimals = 1,
  onDone,
  onClose,
}: {
  open: boolean
  title: string
  unit: string
  initial: number | null
  step: number
  decimals?: number
  onDone(value: number | null): void
  onClose(): void
}) {
  const [text, setText] = useState('')
  const [fresh, setFresh] = useState(true)
  useEffect(() => {
    if (open) {
      setText(initial === null ? '' : String(initial))
      setFresh(true)
    }
  }, [open, initial])

  const press = (k: string) => {
    setText((prev) => {
      const base = fresh ? '' : prev
      if (k === '.') return decimals === 0 || base.includes('.') ? base : (base || '0') + '.'
      const next = base + k
      const [, frac = ''] = next.split('.')
      return frac.length > decimals || next.replace('.', '').length > 6 ? base : next
    })
    setFresh(false)
  }
  const nudge = (dir: 1 | -1) => {
    const v = Math.max(0, (parseFloat(text) || 0) + dir * step)
    setText(String(Number(v.toFixed(decimals))))
    setFresh(true)
  }
  const value = text === '' || text === '.' ? null : Number(text)
  const key = 'num h-[54px] rounded-control bg-raised text-2xl font-semibold'

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-2">
        <span className="text-[15px] font-semibold">{title}</span>
        <div className="flex items-center justify-between gap-3">
          <button aria-label={`Decrease by ${step}`} className="num h-14 w-[72px] rounded-2xl border border-line bg-raised text-[17px] font-semibold" onClick={() => nudge(-1)}>
            −{step}
          </button>
          <div className="flex items-baseline gap-1.5">
            <span className={cx('num text-[60px] leading-none font-bold tracking-[-2px]', text === '' && 'text-faint')}>{text === '' ? '0' : text}</span>
            <span className="text-base font-medium text-muted">{unit}</span>
          </div>
          <button aria-label={`Increase by ${step}`} className="num h-14 w-[72px] rounded-2xl border border-line bg-raised text-[17px] font-semibold" onClick={() => nudge(1)}>
            +{step}
          </button>
        </div>
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
          <button
            aria-label="Delete"
            className="flex h-[54px] items-center justify-center rounded-control"
            onClick={() => {
              setText((p) => (fresh ? '' : p.slice(0, -1)))
              setFresh(false)
            }}
          >
            <Icon d={icons.backspace} size={26} />
          </button>
        </div>
        <Button variant="primary" onClick={() => onDone(value)}>
          Done
        </Button>
      </div>
    </Sheet>
  )
}

/** 1 to 5 rating chips. Tapping the selected value clears it. */
export function Rating({ label, value, onChange }: { label: string; value: number | null; onChange(v: number | null): void }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[72px] text-sm font-medium">{label}</span>
      <div className="grid flex-1 grid-cols-5 gap-[5px]">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            aria-label={`${label} ${n}`}
            aria-pressed={value === n}
            onClick={() => onChange(value === n ? null : n)}
            className={cx(
              'num h-11 rounded-[10px] border text-[15px] font-semibold',
              value === n ? 'border-accent bg-accent-dim font-bold text-accent' : 'border-line bg-raised text-muted',
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  )
}

export function RoundButton({ label, d, onClick, disabled }: { label: string; d: string; onClick?(): void; disabled?: boolean }) {
  return (
    <button
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink disabled:text-faint"
    >
      <Icon d={d} size={20} />
    </button>
  )
}

export { cx }

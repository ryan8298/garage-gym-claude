import { useEffect, useRef, useState, type PointerEvent } from 'react'
import type { LiftView } from '../lib/session'
import { cx } from './ui'

const SWIPE = 84

/**
 * Today's exercises as a queue. Drag the handle to reorder, swipe a row left
 * to remove it or right to swap it, tap to jump to it.
 */
export function LiftQueue({
  lifts,
  currentId,
  isDone,
  onPick,
  onReorder,
  onRemove,
  onSwap,
}: {
  lifts: LiftView[]
  currentId: string | undefined
  isDone(v: LiftView): boolean
  onPick(id: string): void
  onReorder(ids: string[]): void
  onRemove(v: LiftView): void
  onSwap(v: LiftView): void
}) {
  const ids = lifts.map((v) => v.lift.id)
  const [order, setOrder] = useState<string[] | null>(null)
  const [dragging, setDragging] = useState<{ id: string; offset: number } | null>(null)
  const [swipe, setSwipe] = useState<{ id: string; dx: number } | null>(null)
  const drag = useRef<{ id: string; y: number; rowH: number } | null>(null)
  const touch = useRef<{ id: string; x: number; y: number; active: boolean } | null>(null)
  const swallowClick = useRef(false)

  // Once the saved order catches up with what was dragged, stop overriding it.
  const key = ids.join()
  useEffect(() => setOrder(null), [key])

  const shown = (order ?? ids).map((id) => lifts.find((v) => v.lift.id === id)).filter((v): v is LiftView => !!v)

  const dragStart = (e: PointerEvent<HTMLButtonElement>, id: string) => {
    const row = e.currentTarget.closest<HTMLElement>('[data-row]')
    if (!row) return
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { id, y: e.clientY, rowH: row.getBoundingClientRect().height }
    setOrder(order ?? ids)
    setDragging({ id, offset: 0 })
  }
  const dragMove = (e: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current
    if (!d) return
    let offset = e.clientY - d.y
    const next = [...(order ?? ids)]
    let i = next.indexOf(d.id)
    while (offset > d.rowH / 2 && i < next.length - 1) {
      ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
      i++
      d.y += d.rowH
      offset -= d.rowH
    }
    while (offset < -d.rowH / 2 && i > 0) {
      ;[next[i], next[i - 1]] = [next[i - 1], next[i]]
      i--
      d.y -= d.rowH
      offset += d.rowH
    }
    setOrder(next)
    setDragging({ id: d.id, offset })
  }
  const dragEnd = () => {
    if (!drag.current) return
    drag.current = null
    setDragging(null)
    const next = order ?? ids
    if (next.join() === key) setOrder(null)
    else onReorder(next)
  }

  const swipeStart = (e: PointerEvent<HTMLDivElement>, id: string) => {
    touch.current = { id, x: e.clientX, y: e.clientY, active: false }
    swallowClick.current = false
  }
  const swipeMove = (e: PointerEvent<HTMLDivElement>) => {
    const t = touch.current
    if (!t) return
    const dx = e.clientX - t.x
    if (!t.active) {
      if (Math.abs(dx) < 10 || Math.abs(e.clientY - t.y) > Math.abs(dx)) return
      t.active = true
      swallowClick.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    setSwipe({ id: t.id, dx: Math.max(-140, Math.min(140, dx)) })
  }
  const swipeEnd = (v: LiftView | null) => {
    const t = touch.current
    touch.current = null
    const dx = swipe?.dx ?? 0
    setSwipe(null)
    if (!t?.active || !v) return
    if (dx <= -SWIPE) onRemove(v)
    else if (dx >= SWIPE) onSwap(v)
  }

  return (
    <div className="overflow-hidden rounded-card border border-line bg-surface">
      {shown.map((v, i) => {
        const dx = swipe?.id === v.lift.id ? swipe.dx : 0
        const lifted = dragging?.id === v.lift.id
        return (
          <div
            key={v.lift.id}
            data-row
            className={cx('relative overflow-hidden', i > 0 && 'border-t border-line', lifted && 'z-10')}
            style={lifted ? { transform: `translateY(${dragging.offset}px)`, boxShadow: '0 8px 24px rgb(0 0 0 / 0.5)' } : undefined}
          >
            {dx !== 0 && (
              <div className={cx('absolute inset-0 flex items-center px-4 text-sm font-semibold', dx > 0 ? 'justify-start bg-coach-dim text-coach' : 'justify-end bg-[#3a1d19] text-danger')}>
                {dx > 0 ? (dx >= SWIPE ? 'Release to swap' : 'Swap') : dx <= -SWIPE ? 'Release to remove' : 'Remove'}
              </div>
            )}
            <div
              className={cx('relative flex min-h-[52px] items-stretch', v.lift.id === currentId ? 'bg-raised' : 'bg-surface')}
              style={{ transform: dx ? `translateX(${dx}px)` : undefined, transition: dx ? 'none' : 'transform .18s', touchAction: 'pan-y' }}
              onPointerDown={(e) => swipeStart(e, v.lift.id)}
              onPointerMove={swipeMove}
              onPointerUp={() => swipeEnd(v)}
              onPointerCancel={() => swipeEnd(null)}
            >
              <button
                onClick={() => {
                  if (swallowClick.current) return void (swallowClick.current = false)
                  onPick(v.lift.id)
                }}
                className="flex min-w-0 flex-1 items-center justify-between gap-3 py-2 pr-1 pl-3.5 text-left"
              >
                <span className={cx('truncate text-[15px]', v.target.kind === 'main' ? 'font-semibold' : 'font-medium', isDone(v) && 'text-muted')}>{v.lift.name}</span>
                <span className="num shrink-0 text-[13px] text-muted">{v.lift.skipped ? 'skipped' : `${v.sets.filter((s) => s.done).length} / ${v.sets.length}`}</span>
              </button>
              <button
                aria-label={`Drag to reorder ${v.lift.name}`}
                className="flex w-11 shrink-0 cursor-grab items-center justify-center text-faint"
                style={{ touchAction: 'none' }}
                onPointerDown={(e) => {
                  e.stopPropagation()
                  dragStart(e, v.lift.id)
                }}
                onPointerMove={dragMove}
                onPointerUp={dragEnd}
                onPointerCancel={dragEnd}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
                  <path d="M5 9h14M5 15h14" />
                </svg>
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

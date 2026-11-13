export interface Series {
  points: { date: string; value: number }[]
  color: string
  /** Draw each point as a dot instead of joining them with a line. */
  dots?: boolean
}

const at = (date: string) => Date.parse(`${date}T12:00:00Z`)
const short = (date: string) => new Date(at(date)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })

/** A small line chart drawn directly as SVG. Scales to its container. */
export function LineChart({ series, label, height = 110, unit = '' }: { series: Series[]; label: string; height?: number; unit?: string }) {
  const all = series.flatMap((s) => s.points)
  if (all.length === 0) return <div className="flex items-center justify-center rounded-xl bg-bg text-[13px] text-muted" style={{ height }}>No data yet</div>
  const W = 320
  const xs = all.map((p) => at(p.date))
  const ys = all.map((p) => p.value)
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)]
  let [y0, y1] = [Math.min(...ys), Math.max(...ys)]
  const pad = (y1 - y0) * 0.12 || Math.max(1, y1 * 0.02)
  y0 -= pad
  y1 += pad
  const px = (d: string) => (x1 === x0 ? W / 2 : 6 + ((at(d) - x0) / (x1 - x0)) * (W - 12))
  const py = (v: number) => 6 + (1 - (v - y0) / (y1 - y0)) * (height - 12)
  const fmt = (v: number) => `${Number(v.toFixed(1))}${unit}`
  const dates = [...new Set(all.map((p) => p.date))].sort()

  return (
    <div className="flex flex-col gap-1">
      <div className="relative">
        <svg role="img" aria-label={label} viewBox={`0 0 ${W} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }}>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={height * f} y2={height * f} stroke="var(--color-line)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          ))}
          {series.map((s, i) => {
            const pts = [...s.points].sort((a, b) => (a.date < b.date ? -1 : 1))
            if (s.dots || pts.length === 1)
              return pts.map((p) => <ellipse key={`${i}-${p.date}`} cx={px(p.date)} cy={py(p.value)} rx={s.dots ? 2.5 : 4} ry={s.dots ? 2.5 : 4} fill={s.color} opacity={s.dots ? 0.45 : 1} />)
            return <polyline key={i} points={pts.map((p) => `${px(p.date)},${py(p.value)}`).join(' ')} fill="none" stroke={s.color} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          })}
        </svg>
        <span className="num pointer-events-none absolute top-0 left-0 text-[10px] text-muted">{fmt(y1 - pad)}</span>
        <span className="num pointer-events-none absolute bottom-0 left-0 text-[10px] text-muted">{fmt(y0 + pad)}</span>
      </div>
      <div className="flex justify-between text-[11px] text-muted">
        <span>{short(dates[0])}</span>
        {dates.length > 1 && <span>{short(dates[dates.length - 1])}</span>}
      </div>
    </div>
  )
}

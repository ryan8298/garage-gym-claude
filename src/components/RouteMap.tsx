import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import type { Point } from '../lib/track'

/**
 * A route drawn on a street map. The map pictures come from OpenStreetMap
 * and need a connection; without one the line still shows on a plain ground.
 */
export function RouteMap({ route, follow = false, height = 260 }: { route: Point[]; follow?: boolean; height?: number }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<L.Map | null>(null)
  const line = useRef<L.Polyline | null>(null)
  const dot = useRef<L.CircleMarker | null>(null)

  useEffect(() => {
    if (!box.current) return
    const m = L.map(box.current, { zoomControl: false, attributionControl: true, dragging: !follow, scrollWheelZoom: false })
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(m)
    m.attributionControl.setPrefix(false)
    line.current = L.polyline([], { color: '#c8f250', weight: 5, opacity: 0.95, lineJoin: 'round' }).addTo(m)
    dot.current = L.circleMarker([0, 0], { radius: 7, color: '#0d0f11', weight: 2, fillColor: '#c8f250', fillOpacity: 1 })
    m.setView([39.5, -98.35], 3)
    map.current = m
    return () => {
      m.remove()
      map.current = null
    }
  }, [follow])

  useEffect(() => {
    const m = map.current
    if (!m || !line.current || !dot.current) return
    line.current.setLatLngs(route)
    if (route.length === 0) return
    const last = route[route.length - 1]
    dot.current.setLatLng(last).addTo(m)
    if (follow) m.setView(last, Math.max(m.getZoom(), 16), { animate: true })
    else if (route.length > 1) m.fitBounds(L.latLngBounds(route), { padding: [24, 24], animate: false })
    else m.setView(last, 16)
  }, [route, follow])

  return <div ref={box} role="img" aria-label="Map of the route" className="route-map overflow-hidden rounded-card border border-line" style={{ height }} />
}

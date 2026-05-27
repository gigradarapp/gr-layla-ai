import L from 'leaflet'
import { Maximize2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import 'leaflet/dist/leaflet.css'
import { tripExperienceCount } from '../../shared/experienceCount'
import { resolveMapPlace, type MapPlace } from '../../shared/mapPlaces'
import type { TripDetail } from '../lib/types'

type TripOpenMapProps = {
  trip: TripDetail
  fullscreen?: boolean
  onExpand?: () => void
}

function pinIcon(color: string, label: string) {
  return L.divIcon({
    className: 'trip-map-marker',
    html: `<span class="trip-map-marker-dot" style="background:${color}" aria-hidden="true"></span><span class="trip-map-marker-label">${label}</span>`,
    iconSize: [1, 1],
    iconAnchor: [7, 7],
  })
}

function fitRoute(map: L.Map, origin: MapPlace, destination: MapPlace) {
  const bounds = L.latLngBounds([
    [origin.lat, origin.lng],
    [destination.lat, destination.lng],
  ])

  if (!bounds.isValid()) {
    map.setView([destination.lat, destination.lng], 11)
    return
  }

  map.fitBounds(bounds, { padding: [48, 48], maxZoom: 13 })
}

export function TripOpenMap({ trip, fullscreen = false, onExpand }: TripOpenMapProps) {
  const shellRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const origin = resolveMapPlace(trip.origin)
    const destination = resolveMapPlace(trip.destination)
    const activityStops = tripExperienceCount(trip.focusActivities ?? [], trip.days)

    const map = L.map(container, {
      zoomControl: fullscreen,
      attributionControl: false,
      scrollWheelZoom: false,
      dragging: false,
      doubleClickZoom: false,
      touchZoom: false,
    })

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    L.marker([origin.lat, origin.lng], {
      icon: pinIcon('#6b7280', origin.label),
      title: origin.label,
    }).addTo(map)

    L.marker([destination.lat, destination.lng], {
      icon: pinIcon('#3fa35f', destination.label),
      title: destination.label,
    }).addTo(map)

    if (activityStops > 0) {
      const midLat = (origin.lat + destination.lat) / 2 + 0.012
      const midLng = (origin.lng + destination.lng) / 2 - 0.01
      L.marker([midLat, midLng], {
        icon: pinIcon('#e84e73', String(activityStops)),
        title: `${activityStops} experiences`,
      }).addTo(map)
    }

    L.polyline(
      [
        [origin.lat, origin.lng],
        [destination.lat, destination.lng],
      ],
      { color: '#2b1730', weight: 4, opacity: 0.75, dashArray: '8 10' },
    ).addTo(map)

    const syncView = () => {
      map.invalidateSize({ animate: false })
      fitRoute(map, origin, destination)
    }

    const resizeObserver = new ResizeObserver(() => syncView())
    resizeObserver.observe(container)
    if (shellRef.current) resizeObserver.observe(shellRef.current)

    requestAnimationFrame(() => {
      requestAnimationFrame(syncView)
    })

    mapRef.current = map

    return () => {
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
    }
  }, [trip.destination, trip.origin, trip.days, trip.focusActivities])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    if (fullscreen) {
      map.scrollWheelZoom.enable()
      map.dragging.enable()
      map.doubleClickZoom.enable()
      map.touchZoom.enable()
    } else {
      map.scrollWheelZoom.disable()
      map.dragging.disable()
      map.doubleClickZoom.disable()
      map.touchZoom.disable()
    }

    const timer = window.setTimeout(() => {
      map.invalidateSize({ animate: false })
      fitRoute(map, resolveMapPlace(trip.origin), resolveMapPlace(trip.destination))
    }, fullscreen ? 150 : 80)

    return () => window.clearTimeout(timer)
  }, [fullscreen, trip.destination, trip.origin])

  return (
    <div
      ref={shellRef}
      className={`layla-map${fullscreen ? ' fullscreen is-interactive' : ''}`}
    >
      <div ref={containerRef} className="trip-map-canvas" aria-label={`Map from ${trip.origin} to ${trip.destination}`} />
      {onExpand ? (
        <button
          type="button"
          className="map-expand"
          aria-label="Open full screen map"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            onExpand()
          }}
        >
          <Maximize2 size={18} />
        </button>
      ) : null}
    </div>
  )
}

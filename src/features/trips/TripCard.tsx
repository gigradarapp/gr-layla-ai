import { Link } from '@tanstack/react-router'
import { CalendarDays, Gauge, MapPin } from 'lucide-react'
import { daysBetween, money, shortDate, titleCase } from '../../lib/format'
import type { Trip } from '../../lib/types'
import { StatusBadge } from '../../components/StatusBadge'

export function TripCard({ trip }: { trip: Trip }) {
  return (
    <article className="trip-card">
      <img src={trip.heroImageUrl} alt="" />
      <div className="trip-card-body">
        <div className="trip-card-top">
          <StatusBadge value={trip.status} tone={trip.status === 'ready' ? 'good' : 'neutral'} />
          <span className="confidence">{trip.confidence}% confidence</span>
        </div>
        <h3>{trip.title}</h3>
        <p>{trip.summary}</p>
        <div className="trip-meta">
          <span>
            <MapPin size={14} />
            {trip.origin} to {trip.destination}
          </span>
          <span>
            <CalendarDays size={14} />
            {shortDate(trip.startDate)} · {daysBetween(trip.startDate, trip.endDate)} days
          </span>
          <span>
            <Gauge size={14} />
            {titleCase(trip.pace)} pace
          </span>
        </div>
        <div className="trip-card-footer">
          <strong>{money(trip.estimatedCost)}</strong>
          <Link to="/trips/$tripId" params={{ tripId: trip.id }} className="secondary-action">
            View itinerary
          </Link>
        </div>
      </div>
    </article>
  )
}

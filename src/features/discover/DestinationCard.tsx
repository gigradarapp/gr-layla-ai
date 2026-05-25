import { Heart, Plane, SunMedium } from 'lucide-react'
import { money, titleCase } from '../../lib/format'
import type { Destination } from '../../lib/types'

export function DestinationCard({ destination }: { destination: Destination }) {
  return (
    <article className="destination-card">
      <div className="destination-image">
        <img src={destination.imageUrl} alt={`${destination.name}, ${destination.country}`} />
        <button type="button" aria-label={`Save ${destination.name}`}>
          <Heart size={18} />
        </button>
      </div>
      <div className="destination-body">
        <div className="destination-title">
          <strong>{destination.name}</strong>
          <span>
            <SunMedium size={14} />
            {destination.weather}
          </span>
        </div>
        <p>{destination.summary}</p>
        <div className="card-meta">
          <span>
            <Plane size={14} />
            from {money(destination.flightPriceFrom)}
          </span>
          <span>{titleCase(destination.budgetLevel)}</span>
          <span>{destination.idealDuration}</span>
        </div>
      </div>
    </article>
  )
}

import { ExternalLink, Star } from 'lucide-react'
import { resolveHotelBookingUrl } from '../../../shared/hotelBookingUrl'
import { money, titleCase } from '../../lib/format'
import type { Offer } from '../../lib/types'

export function OfferCard({ offer, destination }: { offer: Offer; destination?: string }) {
  const handoffUrl =
    offer.type === 'hotel' && destination
      ? resolveHotelBookingUrl(offer.url, offer.title, destination)
      : offer.url.startsWith('http')
        ? offer.url
        : undefined
  return (
    <article className="offer-card">
      <img src={offer.imageUrl} alt="" />
      <div className="offer-body">
        <div className="offer-type">{titleCase(offer.type)}</div>
        <h3>{offer.title}</h3>
        <p>{offer.provider}</p>
        <div className="offer-rating">
          <Star size={15} fill="currentColor" />
          {offer.rating.toFixed(1)}
        </div>
        <div className="offer-perks">
          {offer.perks.map((perk) => (
            <span key={perk}>{perk}</span>
          ))}
        </div>
        <div className="offer-footer">
          <strong>{money(offer.price)}</strong>
          {handoffUrl ? (
            <a
              href={handoffUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="secondary-action"
              aria-label={`View ${offer.title} on Booking.com`}
            >
              {offer.type === 'hotel' ? 'View on Booking.com' : 'View offer'}
              <ExternalLink size={14} />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  )
}

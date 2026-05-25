import { ExternalLink, Star } from 'lucide-react'
import { money, titleCase } from '../../lib/format'
import type { Offer } from '../../lib/types'

export function OfferCard({ offer }: { offer: Offer }) {
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
          <a href={offer.url} className="secondary-action" aria-label={`Open simulated handoff for ${offer.title}`}>
            Demo handoff
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </article>
  )
}

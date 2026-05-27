import { useQuery } from '@tanstack/react-query'
import { useSearch } from '@tanstack/react-router'
import { useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { OfferCard } from '../features/booking/OfferCard'
import { api } from '../lib/api'

const types = ['all', 'flight', 'hotel', 'activity']

export function BookingPage() {
  const search = useSearch({ from: '/book' }) as { tripId?: string }
  const [type, setType] = useState('all')
  const tripQuery = useQuery({
    queryKey: ['trip', search.tripId],
    queryFn: () => api.trip(search.tripId!),
    enabled: Boolean(search.tripId),
  })
  const query = useQuery({
    queryKey: ['offers', search.tripId, type],
    queryFn: () => api.offers({ tripId: search.tripId, type: type === 'all' ? undefined : type }),
  })
  const tripDestination = tripQuery.data?.destination

  return (
    <div className="page">
      <section className="page-title split-title">
        <div>
          <h1>
            Find flights, hotels <span>& activities</span>
          </h1>
          <p>Simulated booking inventory shows where affiliate, partner, or concierge monetization can attach.</p>
        </div>
        <div className="segmented-control">
          {types.map((item) => (
            <button key={item} type="button" className={type === item ? 'active' : ''} onClick={() => setType(item)}>
              {item}
            </button>
          ))}
        </div>
      </section>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <div className="offer-grid">
          {query.data?.map((offer) => (
            <OfferCard key={offer.id} offer={offer} destination={tripDestination} />
          ))}
        </div>
      )}
    </div>
  )
}

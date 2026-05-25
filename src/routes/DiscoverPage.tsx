import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { DestinationCard } from '../features/discover/DestinationCard'
import { api } from '../lib/api'

const vibes = ['all', 'food', 'wellness', 'nature', 'culture', 'road', 'beach']
const budgets = ['all', 'budget', 'mid', 'premium']
const travelers = ['all', 'solo', 'couples', 'families', 'friends', 'road trippers']

export function DiscoverPage() {
  const [vibe, setVibe] = useState('all')
  const [budget, setBudget] = useState('all')
  const [travelerType, setTravelerType] = useState('all')
  const params = useMemo(
    () => ({
      vibe: vibe === 'all' ? undefined : vibe,
      budget: budget === 'all' ? undefined : budget,
      travelerType: travelerType === 'all' ? undefined : travelerType,
    }),
    [budget, travelerType, vibe],
  )
  const query = useQuery({ queryKey: ['destinations', params], queryFn: () => api.destinations(params) })

  return (
    <div className="page">
      <section className="page-title">
        <h1>
          Discover new places <span>with intent</span>
        </h1>
        <p>Filter ideas by the things travelers actually lead with: vibe, budget, weather, and traveler type.</p>
      </section>

      <div className="filter-bar">
        <label>
          Vibe
          <select value={vibe} onChange={(event) => setVibe(event.target.value)}>
            {vibes.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Budget
          <select value={budget} onChange={(event) => setBudget(event.target.value)}>
            {budgets.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label>
          Traveler
          <select value={travelerType} onChange={(event) => setTravelerType(event.target.value)}>
            {travelers.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : (
        <div className="destination-grid">
          {query.data?.map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      )}
    </div>
  )
}

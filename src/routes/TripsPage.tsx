import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { EmptyState } from '../components/EmptyState'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { PlannerPanel } from '../features/chat/PlannerPanel'
import { TripCard } from '../features/trips/TripCard'
import { api } from '../lib/api'

export function TripsPage() {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('all')
  const query = useQuery({
    queryKey: ['trips', q, status],
    queryFn: () => api.trips({ q: q || undefined, status: status === 'all' ? undefined : status }),
  })

  return (
    <div className="page">
      <section className="page-title split-title">
        <div>
          <h1>
            Saved <span>itineraries</span>
          </h1>
          <p>Generated trips are stored in SQLite and can be refined from their detail pages.</p>
        </div>
        <div className="list-controls">
          <input value={q} onChange={(event) => setQ(event.target.value)} placeholder="Search trips" />
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All status</option>
            <option value="ready">Ready</option>
            <option value="draft">Draft</option>
          </select>
        </div>
      </section>

      {query.isLoading ? (
        <LoadingState />
      ) : query.isError ? (
        <ErrorState error={query.error} />
      ) : query.data && query.data.length > 0 ? (
        <div className="trip-grid">
          {query.data.map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      ) : (
        <EmptyState title="No trips found" body="Create a trip from the planner and it will appear here." />
      )}

      <section className="inline-planner">
        <PlannerPanel compact />
      </section>
    </div>
  )
}

import { useQuery } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { ArrowRight, CheckCircle2, Clock, Sparkles } from 'lucide-react'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MetricCard } from '../components/MetricCard'
import { PlannerPanel } from '../features/chat/PlannerPanel'
import { DestinationCard } from '../features/discover/DestinationCard'
import { TripCard } from '../features/trips/TripCard'
import { api } from '../lib/api'

export function HomePage() {
  const destinations = useQuery({ queryKey: ['destinations', 'home'], queryFn: () => api.destinations() })
  const trips = useQuery({ queryKey: ['trips', 'home'], queryFn: () => api.trips() })
  const summary = useQuery({ queryKey: ['dashboard', 'summary'], queryFn: () => api.dashboardSummary() })

  return (
    <div className="page home-page">
      <section className="hero-grid">
        <div className="hero-copy">
          <h1>
            Your trip. <span>Planned in minutes.</span>
          </h1>
          <p>
            A chat-first AI travel planner demo that turns constraints into itineraries, destination ideas,
            simulated booking options, and saved trip state.
          </p>
          <div className="hero-actions">
            <Link to="/chat" className="primary-action">
              Start planning
              <ArrowRight size={17} />
            </Link>
            <Link to="/discover" className="secondary-action">
              Browse ideas
            </Link>
          </div>
          <div className="hero-proof">
            <span>
              <CheckCircle2 size={16} />
              SQLite-backed trips
            </span>
            <span>
              <Sparkles size={16} />
              Simulated AI flow
            </span>
            <span>
              <Clock size={16} />
              Built for fast demos
            </span>
          </div>
        </div>
        <PlannerPanel compact />
      </section>

      <section className="metrics-row" aria-label="Demo metrics">
        {summary.isLoading ? (
          <LoadingState />
        ) : summary.isError ? (
          <ErrorState error={summary.error} />
        ) : summary.data ? (
          <>
            <MetricCard label="Trips planned" value={summary.data.trips} detail="seeded and generated" />
            <MetricCard label="Messages" value={summary.data.messages} detail="planner conversation logs" />
            <MetricCard label="Ready trips" value={summary.data.readyTrips} detail="usable itinerary state" />
            <MetricCard label="Avg trip value" value={`$${summary.data.averageTripValue}`} detail="simulated SGD" />
          </>
        ) : null}
      </section>

      <section className="section-heading">
        <div>
          <h2>Where to go next</h2>
          <p>Destination cards mimic Layla's video-led inspiration layer with budget, weather, and vibe signals.</p>
        </div>
        <Link to="/discover" className="secondary-action">
          See all
        </Link>
      </section>
      {destinations.isLoading ? (
        <LoadingState />
      ) : destinations.isError ? (
        <ErrorState error={destinations.error} />
      ) : (
        <div className="destination-strip">
          {destinations.data?.slice(0, 4).map((destination) => (
            <DestinationCard key={destination.id} destination={destination} />
          ))}
        </div>
      )}

      <section className="section-heading">
        <div>
          <h2>Saved itineraries</h2>
          <p>Trips are persisted locally and can be opened, refined, and used by the operator dashboard.</p>
        </div>
        <Link to="/trips" className="secondary-action">
          Manage trips
        </Link>
      </section>
      {trips.isLoading ? (
        <LoadingState />
      ) : trips.isError ? (
        <ErrorState error={trips.error} />
      ) : (
        <div className="trip-grid">
          {trips.data?.slice(0, 3).map((trip) => (
            <TripCard key={trip.id} trip={trip} />
          ))}
        </div>
      )}
    </div>
  )
}

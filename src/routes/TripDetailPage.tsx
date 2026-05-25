import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useParams } from '@tanstack/react-router'
import { ArrowLeft, CheckCircle2, Clock, MapPinned, Route, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { MetricCard } from '../components/MetricCard'
import { OfferCard } from '../features/booking/OfferCard'
import { api } from '../lib/api'
import { daysBetween, money, shortDate, titleCase } from '../lib/format'

const refinements = ['Make it cheaper', 'Add more nature', 'More food stops', 'Make it family-friendly', 'Slow the pace']

export function TripDetailPage() {
  const { tripId } = useParams({ from: '/trips/$tripId' })
  const queryClient = useQueryClient()
  const [customRefinement, setCustomRefinement] = useState('')
  const query = useQuery({ queryKey: ['trip', tripId], queryFn: () => api.trip(tripId) })
  const refine = useMutation({
    mutationFn: (value: string) => api.refineTrip(tripId, value),
    onSuccess: async () => {
      setCustomRefinement('')
      await queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
      await queryClient.invalidateQueries({ queryKey: ['trips'] })
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} />
  if (!query.data) return <ErrorState error={new Error('Trip not found')} />

  const trip = query.data
  const totalActivities = trip.days.reduce((count, day) => count + day.activities.length, 0)
  const activityCost = trip.days.reduce(
    (sum, day) => sum + day.activities.reduce((daySum, activity) => daySum + activity.cost, 0),
    0,
  )

  return (
    <div className="page">
      <Link to="/trips" className="back-link">
        <ArrowLeft size={16} />
        Back to trips
      </Link>

      <section className="trip-hero">
        <img src={trip.heroImageUrl} alt="" />
        <div className="trip-hero-copy">
          <span className="live-dot">{trip.confidence}% confidence</span>
          <h1>{trip.title}</h1>
          <p>{trip.summary}</p>
          <div className="hero-proof">
            <span>
              <MapPinned size={16} />
              {trip.origin} to {trip.destination}
            </span>
            <span>
              <Clock size={16} />
              {shortDate(trip.startDate)} · {daysBetween(trip.startDate, trip.endDate)} days
            </span>
            <span>
              <Route size={16} />
              {titleCase(trip.pace)} pace
            </span>
          </div>
        </div>
      </section>

      <section className="metrics-row">
        <MetricCard label="Trip value" value={money(trip.estimatedCost)} detail="simulated total" />
        <MetricCard label="Activities" value={totalActivities} detail="scheduled blocks" />
        <MetricCard label="On-ground spend" value={money(activityCost)} detail="activity estimate" />
        <MetricCard label="Traveler type" value={titleCase(trip.travelerType)} detail={titleCase(trip.budgetLevel)} />
      </section>

      <section className="detail-layout">
        <div className="itinerary-column">
          <div className="section-heading tight">
            <div>
              <h2>Day-by-day plan</h2>
              <p>Structured output turns chat into an editable schedule.</p>
            </div>
          </div>
          {trip.days.map((day) => (
            <article key={day.id} className="day-card">
              <div className="day-header">
                <span>Day {day.dayNumber}</span>
                <div>
                  <h3>{day.title}</h3>
                  <p>{day.summary}</p>
                </div>
              </div>
              <div className="activity-list">
                {day.activities.map((activity) => (
                  <div key={activity.id} className="activity-row">
                    <time>{activity.time}</time>
                    <div>
                      <strong>{activity.title}</strong>
                      <span>
                        {activity.location} · {titleCase(activity.category)} · {money(activity.cost)}
                      </span>
                      <small>
                        <CheckCircle2 size={13} />
                        {activity.confidence}% confidence · {activity.notes}
                      </small>
                    </div>
                  </div>
                ))}
              </div>
            </article>
          ))}
        </div>

        <aside className="side-panel">
          <h2>Refine with chat</h2>
          <p>Quick actions simulate the operator loop: ask, update, preserve state.</p>
          <div className="refine-actions">
            {refinements.map((item) => (
              <button key={item} type="button" onClick={() => refine.mutate(item)} disabled={refine.isPending}>
                <Sparkles size={14} />
                {item}
              </button>
            ))}
          </div>
          <div className="custom-refine">
            <input
              value={customRefinement}
              onChange={(event) => setCustomRefinement(event.target.value)}
              placeholder="Ask for another change"
            />
            <button
              type="button"
              className="primary-action small"
              disabled={refine.isPending || customRefinement.length < 3}
              onClick={() => refine.mutate(customRefinement)}
            >
              Apply
            </button>
          </div>
          {refine.data ? <div className="success-note">{refine.data.resultSummary}</div> : null}

          <h2>Chat log</h2>
          <div className="compact-messages">
            {trip.messages.map((message) => (
              <div key={message.id} className={`compact-message ${message.role}`}>
                <strong>{message.role}</strong>
                <span>{message.content}</span>
              </div>
            ))}
          </div>
        </aside>
      </section>

      <section className="section-heading">
        <div>
          <h2>Bookable-style options</h2>
          <p>These cards are simulated handoffs, designed to show how booking monetization would fit.</p>
        </div>
        <Link to="/book" search={{ tripId: trip.id }} className="secondary-action">
          See booking board
        </Link>
      </section>
      <div className="offer-grid">
        {trip.offers.map((offer) => (
          <OfferCard key={offer.id} offer={offer} />
        ))}
      </div>
    </div>
  )
}

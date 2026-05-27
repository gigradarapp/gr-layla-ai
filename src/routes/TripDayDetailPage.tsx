import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  ListChecks,
  MapPin,
  ShoppingCart,
  UserRound,
} from 'lucide-react'
import { pickDayImageUrl, resolveTripImageUrl } from '../../shared/destinationImages'
import { dayExperienceCount, experienceCountLabel } from '../../shared/experienceCount'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { TripImage } from '../components/TripImage'
import { api } from '../lib/api'
import { money, shortDate, titleCase } from '../lib/format'
import type { Activity, TripDay } from '../lib/types'

function displayDayTitle(day: TripDay) {
  const withoutPrefix = day.title.replace(new RegExp(`^Day\\s*${day.dayNumber}\\s*[:\\-–—]?\\s*`, 'i'), '').trim()
  return withoutPrefix || day.title
}

function BottomNav({ tripId }: { tripId: string }) {
  return (
    <nav className="trip-bottom-nav" aria-label="Trip tabs">
      <Link to="/chat">
        <UserRound size={20} />
        <span>Chat</span>
      </Link>
      <Link to="/trips/$tripId" params={{ tripId }} className="active">
        <ListChecks size={24} />
        <span>Trip</span>
      </Link>
      <Link to="/book" search={{ tripId }}>
        <ShoppingCart size={23} />
        <span>Book</span>
      </Link>
    </nav>
  )
}

function ActivityRow({ activity }: { activity: Activity }) {
  const duration =
    activity.durationMinutes >= 60
      ? `${Math.round(activity.durationMinutes / 60)}h${activity.durationMinutes % 60 ? ` ${activity.durationMinutes % 60}m` : ''}`
      : `${activity.durationMinutes}m`

  return (
    <article className="itinerary-activity-row">
      <div className="itinerary-activity-time">
        <Clock3 size={16} />
        <span>{activity.time}</span>
      </div>
      <div className="itinerary-activity-body">
        <div className="itinerary-activity-head">
          <h3>{activity.title}</h3>
          <span className={`activity-category activity-category-${activity.category}`}>{titleCase(activity.category)}</span>
        </div>
        {activity.location ? (
          <p className="itinerary-activity-location">
            <MapPin size={14} />
            {activity.location}
          </p>
        ) : null}
        <div className="itinerary-activity-meta">
          <span>{duration}</span>
          {activity.cost > 0 ? <strong>{money(activity.cost)}</strong> : <span>Included</span>}
        </div>
        {activity.notes?.trim() ? <p className="itinerary-activity-notes">{activity.notes}</p> : null}
      </div>
    </article>
  )
}

export function TripDayDetailPage() {
  const { tripId, dayId } = useParams({ from: '/trips/$tripId/days/$dayId' })
  const query = useQuery({ queryKey: ['trip', tripId], queryFn: () => api.trip(tripId) })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} />
  if (!query.data) return <ErrorState error={new Error('Trip not found')} />

  const trip = query.data
  const dayIndex = trip.days.findIndex((item) => item.id === dayId)
  const day = dayIndex >= 0 ? trip.days[dayIndex] : undefined
  if (!day) return <ErrorState error={new Error('Day not found')} />

  const heroImage = resolveTripImageUrl(
    day.imageUrl,
    pickDayImageUrl(trip.destination, day, dayIndex),
    trip.heroImageUrl,
  )
  const focusActivities = trip.focusActivities ?? []
  const experiences = dayExperienceCount(day.dayNumber, focusActivities, day.activities)
  const dayTitle = displayDayTitle(day)

  return (
    <section className="layla-trip-route">
      <div className="layla-trip-frame">
        <header className="trip-detail-topbar">
          <Link to="/trips/$tripId" params={{ tripId }}>
            <ArrowLeft size={22} />
            <span>Trip</span>
          </Link>
        </header>

        <main className="trip-detail-scroll itinerary-day-detail-scroll">
          <div className="itinerary-day-hero">
            <TripImage src={heroImage} alt="" className="itinerary-day-hero-image" />
            <div className="itinerary-day-hero-overlay">
              <span className="itinerary-day-hero-badge">
                Day {day.dayNumber} · {experienceCountLabel(experiences)}
              </span>
              <p className="itinerary-day-hero-meta">
                <CalendarDays size={16} aria-hidden />
                {shortDate(day.date)} · {trip.destination}
              </p>
            </div>
          </div>

          <div className="itinerary-day-content">
            <h1 className="itinerary-day-title">{dayTitle}</h1>
            {day.summary ? <p className="itinerary-day-summary">{day.summary}</p> : null}

            <section className="itinerary-day-activities" aria-label="Day schedule">
              <h2>Schedule</h2>
              {day.activities.length > 0 ? (
                <div className="itinerary-activity-list">
                  {day.activities.map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} />
                  ))}
                </div>
              ) : (
                <p className="itinerary-day-empty">Timed activities for this day are still being generated.</p>
              )}
            </section>
          </div>
        </main>

        <BottomNav tripId={trip.id} />
      </div>
    </section>
  )
}

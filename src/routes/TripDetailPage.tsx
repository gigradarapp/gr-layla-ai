import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  CalendarDays,
  Car,
  ChevronRight,
  ExternalLink,
  Hotel,
  ListChecks,
  MapPin,
  ShoppingCart,
  Shuffle,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { resolveHotelBookingUrl } from '../../shared/hotelBookingUrl'
import { TripOpenMap } from '../components/TripOpenMap'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { pickDayImageUrl, pickStayImageUrl, resolveTripImageUrl } from '../../shared/destinationImages'
import { TripImage } from '../components/TripImage'
import { dayExperienceCount, experienceCountLabel } from '../../shared/experienceCount'
import {
  defaultStayTier,
  hotelOffersByTierLists,
  STAY_TIER_LABELS,
  STAY_TIERS,
  type StayTier,
} from '../../shared/stayTiers'
import { parseStayPerks } from '../../shared/stayOfferMeta'
import { api } from '../lib/api'
import { daysBetween, money, shortDate, travelerCountLabel } from '../lib/format'
import type { Offer, TripDetail } from '../lib/types'

function dateRange(trip: TripDetail) {
  return `${shortDate(trip.startDate)} - ${shortDate(trip.endDate)}`
}

function transferMeta(trip: TripDetail) {
  const transfer = trip.offers.find(
    (offer) =>
      offer.type === 'activity' && /transfer|car|crossing/i.test(`${offer.title} ${offer.perks.join(' ')}`),
  )
  const travelTime = transfer?.perks.find((perk) => /\d+\s*m\b/i.test(perk))
  return {
    label: transfer?.title ?? `Private car · ${trip.origin} to ${trip.destination}`,
    time: travelTime ?? 'Door-to-door',
    provider: transfer?.provider,
  }
}

function introCopy(trip: TripDetail) {
  const first = trip.summary.split(/[.!?]\s/)[0]?.trim()
  return first || `Your ${trip.pace} ${trip.travelerType} trip from ${trip.origin} to ${trip.destination}.`
}

function RouteSelector({ trip }: { trip: TripDetail }) {
  return (
    <div className="route-selector-v2" aria-label="Trip route">
      <span>
        <MapPin size={16} />
        {trip.origin}
      </span>
      <span className="route-car">
        <Car size={16} />
      </span>
      <strong>
        {trip.destination}
        <small>{dateRange(trip)}</small>
      </strong>
      <span className="route-car">
        <Car size={16} />
      </span>
      <span>
        <MapPin size={16} />
        {trip.origin}
      </span>
    </div>
  )
}

function TimelineSection({
  icon,
  title,
  meta,
  children,
}: {
  icon: React.ReactNode
  title: string
  meta?: string
  children?: React.ReactNode
}) {
  return (
    <section className="trip-timeline-section">
      <div className="timeline-icon">{icon}</div>
      <div className="timeline-content">
        <h2>
          {title}
          {meta ? <span>{meta}</span> : null}
        </h2>
        {children}
      </div>
    </section>
  )
}

function TransportCard({
  from,
  to,
  fromDate,
  toDate,
  label,
  time,
}: {
  from: string
  to: string
  fromDate: string
  toDate: string
  label: string
  time: string
}) {
  return (
    <article className="transport-card-v2">
      <div className="transport-route">
        <div>
          <strong>{from}</strong>
          <span>{fromDate}</span>
        </div>
        <div className="transport-line">
          <span />
          <Car size={25} fill="currentColor" />
          <span />
        </div>
        <div>
          <strong>{to}</strong>
          <span>{toDate}</span>
        </div>
      </div>
      <div className="transport-meta">
        <div>
          <span>Travel time: {time}</span>
          <strong>{label}</strong>
        </div>
        <button type="button" disabled>
          <Shuffle size={16} />
          Change
        </button>
      </div>
    </article>
  )
}

function StayCard({
  offer,
  destination,
  tier,
  tripId,
  rank,
}: {
  offer?: Offer
  destination: string
  tier: StayTier
  tripId: string
  rank?: number
}) {
  const tierIndex = STAY_TIERS.indexOf(tier)
  const stayImage = resolveTripImageUrl(
    offer?.imageUrl,
    pickStayImageUrl(destination, tier, tierIndex >= 0 ? tierIndex : 0),
  )
  const meta = parseStayPerks(offer?.perks ?? [])
  const displayRank = rank ?? meta.rank ?? undefined
  const rating = offer?.rating
  const bookingUrl = offer ? resolveHotelBookingUrl(offer.url, offer.title, destination) : null
  const reviewCountLabel = meta.reviewCount
    ? `${meta.reviewCount.toLocaleString()} reviews`
    : meta.reviewLabel || 'Guest reviews'

  return (
    <article className="stay-card-v2">
      {displayRank ? <span className="stay-rank-badge">#{displayRank}</span> : null}
      <div className="stay-main">
        <TripImage src={stayImage} alt="" />
        <div>
          <span className="stars">{rating ? `${rating.toFixed(1)} ★` : 'Hotel stay'}</span>
          <h3>{offer?.title || `Stay in ${destination}`}</h3>
          {offer?.provider ? <p className="stay-provider">{offer.provider}</p> : null}
          <p>{meta.roomDescription || 'Matched hotel option'}</p>
          {meta.neighborhood ? <small className="stay-neighborhood">{meta.neighborhood}</small> : null}
          {meta.distanceLabel ? <small className="stay-distance">{meta.distanceLabel}</small> : null}
          {meta.amenities.slice(0, 3).map((amenity) => (
            <small key={amenity}>{amenity}</small>
          ))}
          {meta.policies.slice(0, 2).map((policy) => (
            <small key={policy} className="stay-policy">
              {policy}
            </small>
          ))}
        </div>
      </div>
      {rating ? (
        <div className="review-row">
          <strong>{rating.toFixed(1)}</strong>
          <div>
            <b>{rating >= 4.5 ? 'Excellent' : rating >= 4 ? 'Great' : rating >= 3.5 ? 'Good' : 'Fair'}</b>
            <span>{reviewCountLabel}</span>
          </div>
        </div>
      ) : null}
      <div className="stay-price-row">
        <div>
          <span>from</span>
          <strong>{money(offer?.price ?? 0)}</strong>
          <small>Check live rates on Booking.com</small>
        </div>
        <button type="button" disabled>
          <Shuffle size={16} />
          Change
        </button>
        <button type="button" aria-label="Remove stay" disabled>
          <Trash2 size={17} />
        </button>
      </div>
      {bookingUrl ? (
        <div className="stay-booking-actions">
          <a
            href={bookingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="stay-booking-link primary"
          >
            View on Booking.com
            <ExternalLink size={15} />
          </a>
          <Link
            to="/book"
            search={{ tripId }}
            className="stay-booking-link secondary"
            target="_blank"
            rel="noopener noreferrer"
          >
            All trip offers
          </Link>
        </div>
      ) : null}
    </article>
  )
}

function StayRecommendations({ trip }: { trip: TripDetail }) {
  const byTier = hotelOffersByTierLists(trip.offers)
  const [selectedTier, setSelectedTier] = useState<StayTier>(() => defaultStayTier(trip.budgetLevel))

  useEffect(() => {
    setSelectedTier(defaultStayTier(trip.budgetLevel))
  }, [trip.id, trip.budgetLevel])

  const tierOffers = byTier[selectedTier]

  return (
    <div className="stay-recommendations">
      <div className="stay-tier-picker segmented-control" role="tablist" aria-label="Choose hotel tier">
        {STAY_TIERS.map((tier) => {
          const offers = byTier[tier]
          const fromPrice = offers.length > 0 ? Math.min(...offers.map((offer) => offer.price)) : null
          return (
            <button
              key={tier}
              type="button"
              role="tab"
              aria-selected={selectedTier === tier}
              className={`stay-tier-tab stay-tier-${tier}${selectedTier === tier ? ' active' : ''}`}
              onClick={() => setSelectedTier(tier)}
            >
              <span>{STAY_TIER_LABELS[tier]}</span>
              {fromPrice != null ? <small>from {money(fromPrice)}</small> : <small>—</small>}
            </button>
          )
        })}
      </div>
      <div
        className="stay-options-scroll"
        role="list"
        aria-label={`${STAY_TIER_LABELS[selectedTier]} stay options, best rated first`}
      >
        {tierOffers.length > 0 ? (
          tierOffers.map((offer, index) => (
            <StayCard
              key={offer.id}
              tier={selectedTier}
              offer={offer}
              destination={trip.destination}
              tripId={trip.id}
              rank={index + 1}
            />
          ))
        ) : (
          <StayCard tier={selectedTier} destination={trip.destination} tripId={trip.id} />
        )}
      </div>
    </div>
  )
}

function ItineraryCard({
  day,
  tripId,
  imageUrl,
  focusActivities,
}: {
  day: TripDetail['days'][number]
  tripId: string
  imageUrl: string
  focusActivities: string[]
}) {
  const experiences = dayExperienceCount(day.dayNumber, focusActivities, day.activities)

  return (
    <Link
      to="/trips/$tripId/days/$dayId"
      params={{ tripId, dayId: day.id }}
      className="itinerary-card-v2"
      aria-label={`Open Day ${day.dayNumber} itinerary`}
    >
      <TripImage src={imageUrl} alt="" />
      <div>
        <span>
          Day {day.dayNumber} · {experienceCountLabel(experiences)} · {shortDate(day.date)}
        </span>
        <h3>{day.title}</h3>
        {day.summary ? <p>{day.summary}</p> : null}
      </div>
      <ChevronRight size={22} aria-hidden />
    </Link>
  )
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

export function TripDetailPage() {
  const { tripId } = useParams({ from: '/trips/$tripId' })
  const [mapOpen, setMapOpen] = useState(false)
  const query = useQuery({ queryKey: ['trip', tripId], queryFn: () => api.trip(tripId) })

  if (query.isLoading) return <LoadingState />
  if (query.isError) return <ErrorState error={query.error} />
  if (!query.data) return <ErrorState error={new Error('Trip not found')} />

  const trip = query.data
  const transport = transferMeta(trip)
  const totalDays = daysBetween(trip.startDate, trip.endDate)
  const nights = Math.max(1, totalDays - 1)
  return (
    <section className="layla-trip-route">
      <div className="layla-trip-frame">
        <header className="trip-detail-topbar">
          <Link to="/chat">
            <ArrowLeft size={22} />
            <span>Chat</span>
          </Link>
        </header>

        <main className="trip-detail-scroll">
          <TripOpenMap trip={trip} onExpand={() => setMapOpen(true)} />

          <section className="trip-title-v2">
            <h1>{trip.title}</h1>
            <p>
              <UserRound size={16} />
              {travelerCountLabel(trip.travelerType)}
              <CalendarDays size={16} />
              {dateRange(trip)}
            </p>
          </section>

          <RouteSelector trip={trip} />

          <div className="trip-timeline-v2">
            <TimelineSection icon={<MapPin size={25} fill="currentColor" />} title={trip.destination}>
              <div className="destination-intro">
                <strong>
                  Day 1 <span>· {shortDate(trip.startDate)}</span>
                </strong>
                <p>{introCopy(trip)}</p>
              </div>
            </TimelineSection>

            <TimelineSection icon={<Car size={23} fill="currentColor" />} title="Arrive" meta={shortDate(trip.startDate)}>
              <TransportCard
                from={trip.origin}
                to={trip.destination}
                fromDate={shortDate(trip.startDate)}
                toDate={shortDate(trip.startDate)}
                label={transport.label}
                time={transport.time}
              />
            </TimelineSection>

            <TimelineSection icon={<Hotel size={23} />} title="Stay" meta={`${dateRange(trip)} · ${nights} night${nights === 1 ? '' : 's'}`}>
              <StayRecommendations trip={trip} />
            </TimelineSection>

            <TimelineSection icon={<CalendarDays size={23} />} title="Itinerary" meta={dateRange(trip)}>
              <div className="itinerary-list-v2">
                {trip.days.map((day, index) => (
                  <ItineraryCard
                    key={day.id}
                    tripId={trip.id}
                    day={day}
                    focusActivities={trip.focusActivities ?? []}
                    imageUrl={resolveTripImageUrl(day.imageUrl, pickDayImageUrl(trip.destination, day, index), trip.heroImageUrl)}
                  />
                ))}
              </div>
            </TimelineSection>

            <TimelineSection icon={<Car size={23} fill="currentColor" />} title="Depart" meta={shortDate(trip.endDate)}>
              <TransportCard
                from={trip.destination}
                to={trip.origin}
                fromDate={shortDate(trip.endDate)}
                toDate={shortDate(trip.endDate)}
                label={transport.label}
                time={transport.time}
              />
            </TimelineSection>
          </div>
        </main>

        <BottomNav tripId={trip.id} />

        {mapOpen
          ? createPortal(
              <div className="fullscreen-map-modal" role="dialog" aria-modal="true" aria-label="Trip map">
                <div className="map-modal-topbar">
                  <strong>{trip.title}</strong>
                  <button type="button" aria-label="Close map" onClick={() => setMapOpen(false)}>
                    <X size={22} />
                  </button>
                </div>
                <TripOpenMap trip={trip} fullscreen />
              </div>,
              document.body,
            )
          : null}
      </div>
    </section>
  )
}

import { Link, useParams } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  Car,
  ChevronRight,
  Download,
  Home,
  Hotel,
  ListChecks,
  MapPin,
  Play,
  Share2,
  Shuffle,
  ShoppingCart,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { api } from '../lib/api'
import type { Offer, TripDetail } from '../lib/types'
import { daysBetween, money, shortDate } from '../lib/format'

function dateRange(trip: TripDetail) {
  return `${shortDate(trip.startDate)} - ${shortDate(trip.endDate)}`
}

function johorTitle(trip: TripDetail) {
  if (trip.destination.toLowerCase().includes('johor')) return '2-Day Solo Johor Bahru Budget Escape'
  return trip.title
}

function hotelOffer(trip: TripDetail) {
  return trip.offers.find((offer) => offer.type === 'hotel') ?? trip.offers[0]
}

function TripMap({ fullscreen = false, onExpand }: { fullscreen?: boolean; onExpand?: () => void }) {
  return (
    <div className={fullscreen ? 'layla-map fullscreen' : 'layla-map'}>
      <div className="map-roads" aria-hidden="true">
        <span className="road road-one" />
        <span className="road road-two" />
        <span className="road road-three" />
        <span className="water-shape" />
      </div>
      <span className="map-label johor">Johor Bahru</span>
      <span className="map-label singapore">Singapore</span>
      <span className="route-line" />
      <span className="map-pin pin-johor">
        <Building2 size={18} />
      </span>
      <span className="map-pin pin-food">3</span>
      <span className="map-pin pin-stay">
        <Hotel size={17} />
      </span>
      <span className="home-pin">
        <Home size={19} />
      </span>
      <button type="button" className="map-play" aria-label="Preview route">
        <Play size={18} fill="currentColor" />
      </button>
      {onExpand ? (
        <button type="button" className="map-expand" aria-label="Open full screen map" onClick={onExpand}>
          <ChevronRight size={20} />
        </button>
      ) : null}
    </div>
  )
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
  time,
}: {
  from: string
  to: string
  fromDate: string
  toDate: string
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
          <strong>Private car</strong>
        </div>
        <button type="button">
          <Shuffle size={16} />
          Change
        </button>
      </div>
    </article>
  )
}

function StayCard({ offer }: { offer?: Offer }) {
  const hotelName = offer?.title.toLowerCase().includes('mood hotel') ? 'Mood Hotel' : offer?.title || 'Mood Hotel'

  return (
    <article className="stay-card-v2">
      <div className="stay-main">
        <img
          src={offer?.imageUrl || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?auto=format&fit=crop&w=500&q=80'}
          alt=""
        />
        <div>
          <span className="stars">★★★</span>
          <h3>{hotelName}</h3>
          <p>Platform Queen Room</p>
          <small>No meals included</small>
          <small>Non-Refundable</small>
        </div>
      </div>
      <div className="review-row">
        <strong>6.9</strong>
        <div>
          <b>Pleasant</b>
          <span>170 reviews</span>
        </div>
      </div>
      <div className="stay-price-row">
        <div>
          <span>from</span>
          <strong>{money(offer?.price ?? 34)}</strong>
          <small>Includes taxes and fees</small>
        </div>
        <button type="button">
          <Shuffle size={16} />
          Change
        </button>
        <button type="button" aria-label="Remove stay">
          <Trash2 size={17} />
        </button>
      </div>
      <p className="stay-note">✦ The hotel is located in Johor Bahru and keeps the budget tight for this escape.</p>
    </article>
  )
}

function ItineraryCard({ day, imageUrl }: { day: TripDetail['days'][number]; imageUrl: string }) {
  return (
    <article className="itinerary-card-v2">
      <img src={imageUrl} alt="" />
      <div>
        <span>
          Day {day.dayNumber} · {day.activities.length + 2} Experiences · {shortDate(day.date)}
        </span>
        <h3>{day.title}</h3>
      </div>
      <ChevronRight size={22} />
    </article>
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
  const stay = hotelOffer(trip)
  const totalDays = daysBetween(trip.startDate, trip.endDate)
  const title = johorTitle(trip)
  const introCopy = trip.destination.toLowerCase().includes('johor')
    ? 'Hey there! Your upcoming solo overnight escape is shaped around a simple Singapore land route, budget stay, cafes, and easy local activities.'
    : trip.summary.split('. ')[0]
  const dayImages = [
    'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=500&q=80',
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=500&q=80',
    trip.heroImageUrl,
  ]

  return (
    <section className="layla-trip-route">
      <div className="layla-trip-frame">
        <header className="trip-detail-topbar">
          <Link to="/chat">
            <ArrowLeft size={22} />
            <span>Chat</span>
          </Link>
          <div>
            <button type="button" aria-label="Share trip">
              <Share2 size={19} />
            </button>
            <button type="button" className="download-trip">
              <Download size={18} />
              Download
            </button>
          </div>
        </header>

        <main className="trip-detail-scroll">
          <TripMap onExpand={() => setMapOpen(true)} />

          <section className="trip-title-v2">
            <h1>{title}</h1>
            <p>
              <UserRound size={16} />
              1 traveller
              <CalendarDays size={16} />
              {dateRange(trip)}
            </p>
          </section>

          <RouteSelector trip={trip} />

          <div className="trip-timeline-v2">
            <TimelineSection icon={<MapPin size={25} fill="currentColor" />} title={trip.destination}>
              <div className="destination-intro">
                <strong>
                  Day 1 <span>· {dateRange(trip)}</span>
                </strong>
                <p>{introCopy}</p>
                <button type="button">... Read more</button>
              </div>
            </TimelineSection>

            <TimelineSection icon={<Car size={23} fill="currentColor" />} title="Arrive" meta={shortDate(trip.startDate)}>
              <TransportCard from={trip.origin} to={trip.destination} fromDate={shortDate(trip.startDate)} toDate={shortDate(trip.startDate)} time="50m" />
            </TimelineSection>

            <TimelineSection icon={<Hotel size={23} />} title="Stay" meta={`${dateRange(trip)} · ${Math.max(1, totalDays - 1)} night`}>
              <StayCard offer={stay} />
            </TimelineSection>

            <TimelineSection icon={<CalendarDays size={23} />} title="Itinerary" meta={dateRange(trip)}>
              <div className="itinerary-list-v2">
                {trip.days.map((day, index) => (
                  <ItineraryCard key={day.id} day={day} imageUrl={dayImages[index % dayImages.length]} />
                ))}
              </div>
            </TimelineSection>

            <TimelineSection icon={<Car size={23} fill="currentColor" />} title="Depart" meta={shortDate(trip.endDate)}>
              <TransportCard from={trip.destination} to={trip.origin} fromDate={shortDate(trip.endDate)} toDate={shortDate(trip.endDate)} time="42m" />
            </TimelineSection>
          </div>
        </main>

        <BottomNav tripId={trip.id} />

        {mapOpen ? (
          <div className="fullscreen-map-modal">
            <div className="map-modal-topbar">
              <strong>{title}</strong>
              <button type="button" aria-label="Close map" onClick={() => setMapOpen(false)}>
                <X size={22} />
              </button>
            </div>
            <TripMap fullscreen />
          </div>
        ) : null}
      </div>
    </section>
  )
}

import { Link, useParams } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  Bookmark,
  Camera,
  CalendarDays,
  Clock3,
  ExternalLink,
  ListChecks,
  MapPin,
  MessageCircle,
  Navigation,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  ShoppingCart,
  UserRound,
  Wallet,
  X,
} from 'lucide-react'
import { pickDayImageUrl, resolveTripImageUrl } from '../../shared/destinationImages'
import { dayExperienceCount, experienceCountLabel } from '../../shared/experienceCount'
import { ErrorState } from '../components/ErrorState'
import { LoadingState } from '../components/LoadingState'
import { TripImage } from '../components/TripImage'
import { api } from '../lib/api'
import { money, shortDate, titleCase } from '../lib/format'
import type { Activity, TripDay, TripDetail } from '../lib/types'

type RouteTarget = {
  title: string
  origin: string
  destination: string
  url: string
  note: string
}

type SocialPlatform = 'instagram' | 'tiktok'
type SocialEmbedKind = 'post' | 'profile' | 'video' | 'hashtag'

type SocialEmbedSource = {
  id: string
  platform: SocialPlatform
  kind: SocialEmbedKind
  title: string
  context: string
  url?: string
  searchUrl: string
  hashtag?: string
  handle?: string
  videoId?: string
}

type SocialExperience = {
  id: string
  label: string
  title: string
  location: string
  routeOrigin: string
  routeDestination: string
  caption: string
  searchUrl: string
  imageUrl: string
  tags: string[]
  embeds: SocialEmbedSource[]
}

type CuratedTikTokVideo = {
  key: string
  title: string
  context: string
  url: string
  videoId: string
  handle: string
  hashtags: string[]
}

declare global {
  interface Window {
    instgrm?: {
      Embeds?: {
        process?: () => void
      }
    }
  }
}

const tweakPresets = [
  'Make this easier and less rushed',
  'Add better food nearby',
  'Make it cheaper',
  'Reduce walking and waiting',
]

const curatedTikTokVideos: CuratedTikTokVideo[] = [
  {
    key: 'jb-food-wong-ah-fook',
    title: 'TikTok food video near City Square',
    context: 'Yi Wei Fu Mee Tarik, Jalan Wong Ah Fook, Johor Bahru',
    url: 'https://www.tiktok.com/@bestfoodmy/video/7379133074057088274',
    videoId: '7379133074057088274',
    handle: 'bestfoodmy',
    hashtags: ['jbcafe', 'johorbahru', 'food', 'shopping'],
  },
  {
    key: 'jb-causeway-checkpoint',
    title: 'TikTok checkpoint queue video',
    context: 'Woodlands Checkpoint to Johor Bahru Causeway',
    url: 'https://www.tiktok.com/@andathesea/video/7190988255863606530',
    videoId: '7190988255863606530',
    handle: 'andathesea',
    hashtags: ['johorbahru', 'causeway', 'checkpoint', 'woodlands', 'border'],
  },
  {
    key: 'jb-night-market-food',
    title: 'TikTok JB night-market drink video',
    context: 'Johor Bahru night-market food stop',
    url: 'https://www.tiktok.com/@sgfoodbuzz/video/7186635397416471809',
    videoId: '7186635397416471809',
    handle: 'sgfoodbuzz',
    hashtags: ['jbcafe', 'johorbahru', 'food', 'nightmarket'],
  },
  {
    key: 'jb-cafe-seri-alam',
    title: 'TikTok Johor cafe video',
    context: 'Rock & Roal Cafe Seri Alam, Johor',
    url: 'https://www.tiktok.com/@encik.fizie/video/7223330014484385026',
    videoId: '7223330014484385026',
    handle: 'encik.fizie',
    hashtags: ['jbcafe', 'johorbahru', 'cafe', 'johorfoodie'],
  },
]

function displayDayTitle(day: TripDay) {
  const withoutPrefix = day.title.replace(new RegExp(`^Day\\s*${day.dayNumber}\\s*[:\\-–—]?\\s*`, 'i'), '').trim()
  return withoutPrefix || day.title
}

function formatDuration(minutes: number) {
  return minutes >= 60
    ? `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ''}`
    : `${minutes}m`
}

function timeToMinutes(value: string) {
  const match = value.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return null
  return Number(match[1]) * 60 + Number(match[2])
}

function momentToMinutes(value: string) {
  const exact = timeToMinutes(value)
  if (exact != null) return exact

  const lower = value.toLowerCase()
  if (lower.includes('morning')) return 9 * 60
  if (lower.includes('afternoon')) return 14 * 60
  if (lower.includes('evening')) return 18 * 60
  if (lower.includes('night')) return 21 * 60
  return 24 * 60
}

function minutesToTime(value: number) {
  const hours = Math.floor(value / 60) % 24
  const minutes = value % 60
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
}

function orderedActivities(activities: Activity[]) {
  return activities
    .map((activity, index) => ({ activity, index }))
    .sort((left, right) => momentToMinutes(left.activity.time) - momentToMinutes(right.activity.time) || left.index - right.index)
    .map(({ activity }) => activity)
}

function timeWindow(activities: Activity[]) {
  if (activities.length === 0) return 'Flexible'
  const ordered = orderedActivities(activities)
  const first = ordered[0]
  const last = ordered[ordered.length - 1]
  const end = timeToMinutes(last.time)
  if (end == null) return first.time === last.time ? first.time : `${first.time} - ${last.time}`
  return `${first.time} - ${minutesToTime(end + last.durationMinutes)}`
}

function dayMoment(time?: string) {
  if (time && /morning|afternoon|evening|night/i.test(time)) return titleCase(time)
  const minutes = time ? timeToMinutes(time) : null
  if (minutes == null) return 'Flexible'
  if (minutes < 12 * 60) return 'Morning'
  if (minutes < 17 * 60) return 'Afternoon'
  return 'Evening'
}

function primaryLocation(day: TripDay, trip: TripDetail) {
  return (
    day.activities.find((activity) => !/logistics|transport/i.test(activity.category) && activity.location.trim())?.location ||
    day.activities.find((activity) => activity.location.trim())?.location ||
    trip.destination
  )
}

function totalActivityCost(day: TripDay) {
  return day.activities.reduce((sum, activity) => sum + Math.max(0, activity.cost), 0)
}

function categorySlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'general'
}

function directionsUrl(origin: string, destination: string) {
  const search = new URLSearchParams({
    api: '1',
    origin,
    destination,
    travelmode: 'driving',
  })
  return `https://www.google.com/maps/dir/?${search}`
}

function splitRouteLocation(value: string) {
  const match = value.match(/^(.+?)\s+(?:to|->|→)\s+(.+)$/i)
  if (!match) return null
  return { origin: match[1].trim(), destination: match[2].trim() }
}

function buildActivityRouteTarget(activity: Activity, trip: TripDetail): RouteTarget {
  const split = splitRouteLocation(activity.location)
  const origin = split?.origin || trip.destination
  const destination = split?.destination || activity.location || trip.destination

  return {
    title: activity.title,
    origin,
    destination,
    url: directionsUrl(origin, destination),
    note: `${activity.time} · ${formatDuration(activity.durationMinutes)} · ${activity.cost > 0 ? money(activity.cost) : 'Included'}`,
  }
}

function buildDayRouteTarget(day: TripDay, trip: TripDetail): RouteTarget {
  const activities = orderedActivities(day.activities)
  const first = activities[0]
  const last = activities[activities.length - 1]

  if (first) {
    const split = splitRouteLocation(first.location)
    if (split) {
      return {
        title: displayDayTitle(day),
        origin: split.origin,
        destination: split.destination,
        url: directionsUrl(split.origin, split.destination),
        note: `${dayMoment(first.time)} route · ${formatDuration(first.durationMinutes)}`,
      }
    }
  }

  const origin = first?.location || trip.origin
  const destination = last?.location && last.location !== origin ? last.location : primaryLocation(day, trip)

  return {
    title: displayDayTitle(day),
    origin,
    destination,
    url: directionsUrl(origin, destination),
    note: `${timeWindow(day.activities)} · ${trip.destination}`,
  }
}

function socialSearchUrl(query: string) {
  const search = new URLSearchParams({ q: `${query} social media reels TikTok Instagram` })
  return `https://www.google.com/search?${search}`
}

function socialHashtag(value: string) {
  const compact = value
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 48)

  return compact || 'travel'
}

function socialHashtagForContext(context: string) {
  const lower = context.toLowerCase()
  if (/city square|jbcitysquare/.test(lower)) return 'jbcitysquare'
  if (/woodlands|checkpoint|border|ciq|sentral|causeway/.test(lower)) return 'johorbahru'
  if (/cafe|coffee|food|restaurant|eat/.test(lower)) return 'jbcafe'
  if (/johor|bahru|\bjb\b/.test(lower)) return 'johorbahru'
  return socialHashtag(context)
}

function platformSearchUrl(platform: SocialPlatform, hashtag: string) {
  return platform === 'instagram'
    ? `https://www.instagram.com/explore/tags/${hashtag}/`
    : `https://www.tiktok.com/tag/${hashtag}`
}

function knownInstagramEmbedUrl(context: string) {
  const lower = context.toLowerCase()
  if (/city square|jbcitysquare|jb sentral|johor|bahru|\bjb\b/.test(lower)) {
    return 'https://www.instagram.com/p/CzOHmEjJgrB/'
  }
  return undefined
}

function pickTikTokVideo(title: string, context: string, hashtag: string) {
  const lower = `${title} ${context} ${hashtag}`.toLowerCase()

  if (!/johor|bahru|\bjb\b|woodlands|checkpoint|border|ciq|causeway|city square|tan hiok nee/.test(lower)) {
    return undefined
  }

  if (/woodlands|checkpoint|border|ciq|causeway|customs|queue/.test(lower)) {
    return curatedTikTokVideos.find((video) => video.key === 'jb-causeway-checkpoint')
  }

  if (/city square|tan hiok nee|jalan wong ah fook|jbcitysquare|shopping|mall|food|mee|cafe/.test(lower)) {
    return curatedTikTokVideos.find((video) => video.key === 'jb-food-wong-ah-fook')
  }

  if (/night|market|pasar/.test(lower)) {
    return curatedTikTokVideos.find((video) => video.key === 'jb-night-market-food')
  }

  return curatedTikTokVideos.find((video) => video.hashtags.includes(hashtag)) ?? curatedTikTokVideos[0]
}

function parseTikTokVideoId(url: string) {
  return url.match(/\/video\/(\d+)/)?.[1]
}

function parseTikTokHandle(url: string) {
  return url.match(/tiktok\.com\/@([a-zA-Z0-9._-]+)/)?.[1]
}

function parseTikTokHashtag(url: string) {
  return url.match(/tiktok\.com\/tag\/([a-zA-Z0-9._-]+)/)?.[1]
}

function buildSocialEmbeds(baseId: string, title: string, context: string): SocialEmbedSource[] {
  const hashtag = socialHashtagForContext(`${title} ${context}`)
  const instagramUrl = knownInstagramEmbedUrl(`${title} ${context}`)
  const tiktokVideo = pickTikTokVideo(title, context, hashtag)

  return [
    {
      id: `${baseId}-instagram`,
      platform: 'instagram',
      kind: instagramUrl ? 'post' : 'hashtag',
      title: instagramUrl ? 'Instagram post from this area' : `Instagram #${hashtag}`,
      context,
      url: instagramUrl,
      searchUrl: platformSearchUrl('instagram', hashtag),
      hashtag,
    },
    {
      id: `${baseId}-tiktok`,
      platform: 'tiktok',
      kind: tiktokVideo ? 'video' : 'hashtag',
      title: tiktokVideo?.title ?? `TikTok #${hashtag}`,
      context: tiktokVideo?.context ?? context,
      url: tiktokVideo?.url,
      searchUrl: tiktokVideo?.url ?? platformSearchUrl('tiktok', hashtag),
      hashtag,
      handle: tiktokVideo?.handle,
      videoId: tiktokVideo?.videoId,
    },
  ]
}

function socialCaption(activity: Activity, trip: TripDetail) {
  const label = `${activity.category} ${activity.title}`.toLowerCase()
  if (/shopping|mall|market/.test(label)) {
    return `Look for haul clips, crowd levels, food breaks, and storefront walkthroughs before you commit time here.`
  }
  if (/logistics|transport|border|transfer|check/.test(label)) {
    return `Use recent clips to understand pickup points, queue conditions, and where the crossing feels confusing.`
  }
  if (/food|cafe|street/.test(label)) {
    return `Scan short-form posts for ordering cues, best-looking dishes, queue length, and nearby alternates.`
  }
  return `Use social clips to preview the vibe, crowd density, and whether this still matches your ${trip.pace} pace.`
}

function buildSocialExperiences(day: TripDay, trip: TripDetail, imageUrl: string): SocialExperience[] {
  const sourceActivities = orderedActivities(day.activities)
  const activities = sourceActivities
    .map((activity, index) => ({ activity, index }))
    .sort((left, right) => {
      const leftIsLogistics = /logistics|transport|transfer|border|check/i.test(left.activity.category)
      const rightIsLogistics = /logistics|transport|transfer|border|check/i.test(right.activity.category)
      return Number(leftIsLogistics) - Number(rightIsLogistics) || left.index - right.index
    })
    .map(({ activity }) => activity)
  const fallbackLocation = primaryLocation(day, trip)

  if (activities.length === 0) {
    return [
      {
        id: `${day.id}-social-region`,
        label: 'AI social scan',
        title: `${fallbackLocation} vibe check`,
        location: fallbackLocation,
        routeOrigin: trip.origin,
        routeDestination: fallbackLocation,
        caption: 'Search nearby short-form posts to see crowds, storefronts, and current street-level feel before you go.',
        searchUrl: socialSearchUrl(`${fallbackLocation} ${trip.destination}`),
        imageUrl,
        tags: ['nearby', 'vibe', 'crowds'],
        embeds: buildSocialEmbeds(`${day.id}-social-region`, `${fallbackLocation} vibe check`, fallbackLocation),
      },
    ]
  }

  return activities.slice(0, 3).map((activity, index) => {
    const location = activity.location || fallbackLocation
    const route = buildActivityRouteTarget(activity, trip)
    return {
      id: `${activity.id}-social`,
      label: index === 0 ? 'AI social scan' : 'Nearby social',
      title: activity.title,
      location,
      routeOrigin: route.origin,
      routeDestination: route.destination,
      caption: socialCaption(activity, trip),
      searchUrl: socialSearchUrl(`${activity.title} ${location} ${trip.destination}`),
      imageUrl,
      tags: [titleCase(activity.category), dayMoment(activity.time), formatDuration(activity.durationMinutes)],
      embeds: buildSocialEmbeds(`${activity.id}-social`, activity.title, location),
    }
  })
}

function dayBriefingNote(day: TripDay, trip: TripDetail) {
  const context = `${trip.destination} ${day.title} ${day.summary} ${day.activities
    .map((activity) => `${activity.title} ${activity.location} ${activity.category}`)
    .join(' ')}`

  if (/johor|bahru|jb/i.test(trip.destination) && /border|cross|city square|shopping/i.test(context)) {
    return 'Clear CIQ first, keep City Square as the low-friction anchor beside JB Sentral, then check in after the first crowd wave.'
  }

  if (/transfer|arrive|check.?in|logistics/i.test(context)) {
    return `Use this as the settling-in block before you add heavier experiences around ${trip.destination}.`
  }

  if (day.activities.length === 1) {
    return `This is a focused anchor block. Ask Layla to add food, cafe, or rest stops around it if you want a fuller day.`
  }

  return `The day is paced around ${primaryLocation(day, trip)} so the route stays practical instead of turning into a checklist.`
}

function activityReason(activity: Activity, trip: TripDetail) {
  if (activity.notes.trim()) return activity.notes
  if (/shopping/i.test(activity.category)) {
    return `Good anchor because shopping, food, and transport stay close together around ${activity.location || trip.destination}.`
  }
  if (/transport|logistics|transfer/i.test(activity.category)) {
    return 'This keeps the movement block explicit so the rest of the day can stay realistic.'
  }
  if (/food|cafe/i.test(activity.category)) {
    return `Fits the ${trip.pace} pace without pulling you too far from the main route.`
  }
  return `Fits your ${trip.pace} ${trip.travelerType} plan without overpacking the day.`
}

function confidenceLabel(confidence: number) {
  if (confidence >= 85) return 'Strong fit'
  if (confidence >= 70) return 'Good fit'
  return 'Flexible pick'
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

function DayBriefing({
  day,
  trip,
  dayTitle,
  onOpenRoute,
  onTweakPlan,
}: {
  day: TripDay
  trip: TripDetail
  dayTitle: string
  onOpenRoute: (target: RouteTarget) => void
  onTweakPlan: () => void
}) {
  const location = primaryLocation(day, trip)
  const totalCost = totalActivityCost(day)

  return (
    <section className="day-briefing-panel" aria-label="Day briefing">
      <div className="day-briefing-kicker">
        <Sparkles size={15} aria-hidden />
        Day {day.dayNumber} plan
      </div>
      <h1 className="itinerary-day-title">{dayTitle}</h1>
      {day.summary ? <p className="itinerary-day-summary">{day.summary}</p> : null}

      <div className="day-briefing-stats" aria-label="Day at a glance">
        <span>
          <Clock3 size={15} aria-hidden />
          <b>{timeWindow(day.activities)}</b>
        </span>
        <span>
          <MapPin size={15} aria-hidden />
          <b>{location}</b>
        </span>
        <span>
          <Wallet size={15} aria-hidden />
          <b>{totalCost > 0 ? money(totalCost) : 'Included'}</b>
        </span>
      </div>

      <div className="layla-day-note">
        <Sparkles size={16} aria-hidden />
        <p>{dayBriefingNote(day, trip)}</p>
      </div>

      <div className="day-briefing-actions">
        <button type="button" onClick={() => onOpenRoute(buildDayRouteTarget(day, trip))}>
          <Navigation size={16} aria-hidden />
          Open route
        </button>
        <button type="button" onClick={onTweakPlan}>
          <MessageCircle size={16} aria-hidden />
          Tweak plan
        </button>
      </div>
    </section>
  )
}

function ActivityRow({
  activity,
  trip,
  onOpenRoute,
}: {
  activity: Activity
  trip: TripDetail
  onOpenRoute: (target: RouteTarget) => void
}) {
  const [saved, setSaved] = useState(false)
  const duration = formatDuration(activity.durationMinutes)
  const category = categorySlug(activity.category)
  const location = activity.location || trip.destination
  const timeContext = timeToMinutes(activity.time) == null ? duration : dayMoment(activity.time)

  return (
    <article className={`itinerary-activity-row activity-row-${category}`}>
      <div className="itinerary-activity-time">
        <span className="activity-time-icon">
          <Clock3 size={16} aria-hidden />
        </span>
        <strong>{activity.time}</strong>
        <span>{timeContext}</span>
      </div>
      <div className="itinerary-activity-body">
        <div className="itinerary-activity-head">
          <h3>{activity.title}</h3>
          <span className={`activity-category activity-category-${category}`}>{titleCase(activity.category)}</span>
        </div>

        <p className="itinerary-activity-notes">
          <Sparkles size={14} aria-hidden />
          {activityReason(activity, trip)}
        </p>

        <div className="activity-intel-grid" aria-label="Activity details">
          <span>
            <MapPin size={14} aria-hidden />
            <b>{location}</b>
          </span>
          <span>
            <Clock3 size={14} aria-hidden />
            <b>{duration}</b>
          </span>
          <span>
            <Wallet size={14} aria-hidden />
            <b>{activity.cost > 0 ? money(activity.cost) : 'Included'}</b>
          </span>
          <span>
            <ShieldCheck size={14} aria-hidden />
            <b>{confidenceLabel(activity.confidence)}</b>
          </span>
        </div>

        <div className="activity-actions">
          <button type="button" onClick={() => onOpenRoute(buildActivityRouteTarget(activity, trip))}>
            <Navigation size={15} aria-hidden />
            Route
          </button>
          <button type="button" aria-pressed={saved} onClick={() => setSaved((value) => !value)}>
            <Bookmark size={15} fill={saved ? 'currentColor' : 'none'} aria-hidden />
            {saved ? 'Saved' : 'Save'}
          </button>
        </div>
      </div>
    </article>
  )
}

function RouteSheet({ target, onClose }: { target: RouteTarget; onClose: () => void }) {
  return (
    <div className="day-action-overlay" role="dialog" aria-modal="true" aria-label="Open route">
      <button type="button" className="day-action-backdrop" aria-label="Close route" onClick={onClose} />
      <section className="day-action-sheet route-sheet">
        <div className="day-action-sheet-head">
          <div>
            <span>Route handoff</span>
            <h2>{target.title}</h2>
          </div>
          <button type="button" aria-label="Close route" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="route-steps" aria-label="Route">
          <div>
            <small>Start</small>
            <strong>{target.origin}</strong>
          </div>
          <Navigation size={20} aria-hidden />
          <div>
            <small>End</small>
            <strong>{target.destination}</strong>
          </div>
        </div>

        <p>{target.note}</p>

        <a href={target.url} target="_blank" rel="noopener noreferrer" className="day-sheet-primary-action">
          Open in Google Maps
          <ExternalLink size={16} aria-hidden />
        </a>
      </section>
    </div>
  )
}

function TweakPlanSheet({
  day,
  trip,
  dayTitle,
  isPending,
  result,
  onClose,
  onSubmit,
}: {
  day: TripDay
  trip: TripDetail
  dayTitle: string
  isPending: boolean
  result?: string
  onClose: () => void
  onSubmit: (refinement: string) => void
}) {
  const [customNote, setCustomNote] = useState('')

  function submit(value: string) {
    const trimmed = value.trim()
    if (!trimmed || isPending) return
    onSubmit(`Tweak Day ${day.dayNumber} (${dayTitle}) for my ${trip.destination} trip: ${trimmed}.`)
    setCustomNote('')
  }

  return (
    <div className="day-action-overlay" role="dialog" aria-modal="true" aria-label="Tweak plan">
      <button type="button" className="day-action-backdrop" aria-label="Close tweak plan" onClick={onClose} />
      <section className="day-action-sheet tweak-sheet">
        <div className="day-action-sheet-head">
          <div>
            <span>Ask Layla</span>
            <h2>Tweak this day</h2>
          </div>
          <button type="button" aria-label="Close tweak plan" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <p className="tweak-context">{dayTitle}</p>

        <div className="tweak-preset-grid" aria-label="Quick tweaks">
          {tweakPresets.map((preset) => (
            <button key={preset} type="button" disabled={isPending} onClick={() => submit(preset)}>
              {preset}
            </button>
          ))}
        </div>

        <label className="tweak-custom-input">
          <span>Custom tweak</span>
          <textarea
            value={customNote}
            onChange={(event) => setCustomNote(event.target.value)}
            placeholder="e.g. add a cafe near the mall and avoid peak checkpoint timing"
            rows={3}
          />
        </label>

        <button
          type="button"
          className="day-sheet-primary-action"
          disabled={isPending || !customNote.trim()}
          onClick={() => submit(customNote)}
        >
          {isPending ? 'Applying...' : 'Apply tweak'}
          <Sparkles size={16} aria-hidden />
        </button>

        {result ? <p className="tweak-result" role="status">{result}</p> : null}
      </section>
    </div>
  )
}

const instagramEmbedScriptId = 'layla-instagram-embed-script'
const tiktokEmbedScriptId = 'layla-tiktok-embed-script'

function loadScriptOnce(id: string, src: string, onLoad?: () => void) {
  const existing = document.getElementById(id) as HTMLScriptElement | null
  if (existing) {
    onLoad?.()
    return
  }

  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = src
  script.onload = () => onLoad?.()
  document.body.appendChild(script)
}

function reloadScript(id: string, src: string) {
  document.getElementById(id)?.remove()
  const script = document.createElement('script')
  script.id = id
  script.async = true
  script.src = src
  document.body.appendChild(script)
}

function uniqueSocialEmbedSources(experiences: SocialExperience[]) {
  const seen = new Set<string>()
  const sources: SocialEmbedSource[] = []

  for (const experience of experiences) {
    for (const source of experience.embeds) {
      const key = `${source.platform}:${source.kind}:${source.url ?? source.hashtag ?? source.handle ?? source.searchUrl}`
      if (seen.has(key)) continue
      seen.add(key)
      sources.push(source)
      if (sources.length >= 4) return sources
    }
  }

  return sources
}

function platformLabel(platform: SocialPlatform) {
  return platform === 'instagram' ? 'Instagram' : 'TikTok'
}

function kindLabel(kind: SocialEmbedKind) {
  if (kind === 'video') return 'public video'
  if (kind === 'post') return 'public post'
  if (kind === 'profile') return 'creator profile'
  return 'source'
}

function SocialEmbedFallback({ source }: { source: SocialEmbedSource }) {
  return (
    <div className="social-embed-fallback">
      <strong>{platformLabel(source.platform)}</strong>
      <p>
        {source.platform === 'instagram'
          ? 'Waiting for a public post or profile URL from the social extraction step.'
          : 'Open the live TikTok source if the web embed is blocked by the browser.'}
      </p>
      <a href={source.searchUrl} target="_blank" rel="noopener noreferrer">
        Find {platformLabel(source.platform)} posts
        <ExternalLink size={13} aria-hidden />
      </a>
    </div>
  )
}

function InstagramEmbed({ source }: { source: SocialEmbedSource }) {
  if (!source.url) return <SocialEmbedFallback source={source} />

  return (
    <div className="social-embed-frame instagram-embed-frame">
      <blockquote
        className="instagram-media"
        data-instgrm-captioned=""
        data-instgrm-permalink={source.url}
        data-instgrm-version="14"
        style={{ width: '100%', maxWidth: '100%', minWidth: 0, margin: 0, border: 0 }}
      >
        <a href={source.url} target="_blank" rel="noopener noreferrer">
          View this post on Instagram
        </a>
      </blockquote>
    </div>
  )
}

function TikTokEmbed({ source }: { source: SocialEmbedSource }) {
  const hashtag = source.hashtag ?? (source.url ? parseTikTokHashtag(source.url) : undefined)

  if (source.kind === 'hashtag' && hashtag) {
    return <TikTokSourceCard source={source} hashtag={hashtag} />
  }

  if (!source.url) return <SocialEmbedFallback source={source} />

  const videoId = source.videoId ?? parseTikTokVideoId(source.url)
  const handle = source.handle ?? parseTikTokHandle(source.url)

  if (videoId) {
    return (
      <div className="social-embed-frame tiktok-embed-frame tiktok-video-embed-frame">
        <blockquote
          className="tiktok-embed"
          cite={source.url}
          data-video-id={videoId}
          data-embed-from="oembed"
          style={{ maxWidth: '100%', minWidth: 288, margin: 0 }}
        >
          <section>
            <a href={source.url} target="_blank" rel="noopener noreferrer">
              {source.title}
            </a>
          </section>
        </blockquote>
      </div>
    )
  }

  if (source.kind === 'profile' && handle) {
    return (
      <div className="social-embed-frame tiktok-embed-frame">
        <blockquote
          className="tiktok-embed"
          cite={source.url}
          data-unique-id={handle}
          data-embed-type="creator"
          style={{ maxWidth: '100%', minWidth: 288, margin: 0 }}
        >
          <section>
            <a href={`${source.url}?refer=creator_embed`} target="_blank" rel="noopener noreferrer">
              @{handle}
            </a>
          </section>
        </blockquote>
      </div>
    )
  }

  return <SocialEmbedFallback source={source} />
}

function TikTokSourceCard({ source, hashtag }: { source: SocialEmbedSource; hashtag: string }) {
  return (
    <div className="tiktok-source-card">
      <div className="tiktok-source-visual" aria-hidden>
        <div className="tiktok-phone-frame">
          <span className="tiktok-clip tiktok-clip-a">
            <PlayCircle size={15} />
            Street clips
          </span>
          <span className="tiktok-clip tiktok-clip-b">
            <PlayCircle size={15} />
            Crowd check
          </span>
          <span className="tiktok-clip tiktok-clip-c">
            <PlayCircle size={15} />
            Food finds
          </span>
        </div>
      </div>
      <div className="tiktok-source-body">
        <strong>#{hashtag}</strong>
        <p>{source.context}</p>
        <a href={source.searchUrl} target="_blank" rel="noopener noreferrer">
          Open TikTok
          <ExternalLink size={14} aria-hidden />
        </a>
      </div>
    </div>
  )
}

function SocialPlatformEmbed({ source }: { source: SocialEmbedSource }) {
  return source.platform === 'instagram' ? <InstagramEmbed source={source} /> : <TikTokEmbed source={source} />
}

function needsTikTokEmbedScript(source: SocialEmbedSource) {
  if (source.platform !== 'tiktok' || !source.url) return false
  if (source.videoId ?? parseTikTokVideoId(source.url)) return true
  return source.kind === 'profile' && Boolean(source.handle ?? parseTikTokHandle(source.url))
}

function SocialExperienceStrip({
  experiences,
  onOpenRoute,
}: {
  experiences: SocialExperience[]
  onOpenRoute: (target: RouteTarget) => void
}) {
  const embedSources = useMemo(() => uniqueSocialEmbedSources(experiences), [experiences])
  const embedRefreshKey = embedSources
    .map((source) => `${source.platform}:${source.kind}:${source.url ?? source.hashtag ?? source.handle ?? source.id}`)
    .join('|')

  useEffect(() => {
    if (typeof document === 'undefined') return
    if (embedSources.some((source) => source.platform === 'instagram' && source.url)) {
      if (window.instgrm?.Embeds?.process) {
        window.instgrm.Embeds.process()
      } else {
        loadScriptOnce(instagramEmbedScriptId, 'https://www.instagram.com/embed.js', () =>
          window.instgrm?.Embeds?.process?.(),
        )
      }
    }

    if (embedSources.some(needsTikTokEmbedScript)) {
      reloadScript(tiktokEmbedScriptId, 'https://www.tiktok.com/embed.js')
    }
  }, [embedRefreshKey])

  if (experiences.length === 0) return null

  return (
    <section className="social-experience-section" aria-label="Social media previews">
      <div className="social-experience-heading">
        <div>
          <span>
            <Camera size={15} aria-hidden />
            Layla AI social scan
          </span>
          <h2>Instagram & TikTok before you go</h2>
        </div>
        <small>{embedSources.length} social source{embedSources.length === 1 ? '' : 's'}</small>
      </div>

      <div className="social-embed-scroll" aria-label="Instagram and TikTok embeds">
        {embedSources.map((source) => (
          <article key={source.id} className={`social-embed-card social-embed-${source.platform}`}>
            <div className="social-embed-card-head">
              <span>{platformLabel(source.platform)}</span>
              <small>{kindLabel(source.kind)}</small>
            </div>
            <div className="social-embed-source-copy">
              <strong>{source.title}</strong>
              <span>{source.context}</span>
            </div>
            <SocialPlatformEmbed source={source} />
            <div className="social-embed-card-foot">
              <span>{source.context}</span>
              <a href={source.searchUrl} target="_blank" rel="noopener noreferrer">
                Open source
                <ExternalLink size={13} aria-hidden />
              </a>
            </div>
          </article>
        ))}
      </div>

      <div className="social-readout-label">
        <Sparkles size={14} aria-hidden />
        AI readout from nearby clips
      </div>

      <div className="social-experience-scroll">
        {experiences.map((experience) => (
          <article key={experience.id} className="social-experience-card">
            <div className="social-experience-media">
              <TripImage src={experience.imageUrl} alt="" />
              <span>
                <PlayCircle size={15} aria-hidden />
                {experience.label}
              </span>
            </div>
            <div className="social-experience-body">
              <p>{experience.location}</p>
              <h3>{experience.title}</h3>
              <span>{experience.caption}</span>
              <div className="social-tags">
                {experience.tags.map((tag) => (
                  <small key={tag}>{tag}</small>
                ))}
              </div>
              <div className="social-actions">
                <a href={experience.searchUrl} target="_blank" rel="noopener noreferrer">
                  Search social
                  <ExternalLink size={14} aria-hidden />
                </a>
                <button
                  type="button"
                  onClick={() =>
                    onOpenRoute({
                      title: experience.title,
                      origin: experience.routeOrigin,
                      destination: experience.routeDestination,
                      url: directionsUrl(experience.routeOrigin, experience.routeDestination),
                      note: `Preview route context around ${experience.location}`,
                    })
                  }
                >
                  Route
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export function TripDayDetailPage() {
  const { tripId, dayId } = useParams({ from: '/trips/$tripId/days/$dayId' })
  const queryClient = useQueryClient()
  const [routeTarget, setRouteTarget] = useState<RouteTarget | null>(null)
  const [tweakOpen, setTweakOpen] = useState(false)
  const [tweakResult, setTweakResult] = useState<string | undefined>()
  const query = useQuery({ queryKey: ['trip', tripId], queryFn: () => api.trip(tripId) })
  const tweakMutation = useMutation({
    mutationFn: (refinement: string) => api.refineTrip(tripId, refinement),
    onSuccess: async (result) => {
      setTweakResult(result.resultSummary)
      await queryClient.invalidateQueries({ queryKey: ['trip', tripId] })
    },
  })

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
  const location = primaryLocation(day, trip)
  const activities = orderedActivities(day.activities)
  const socialExperiences = buildSocialExperiences(day, trip, heroImage)

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
              <strong className="itinerary-day-hero-title">
                {dayMoment(activities[0]?.time)} in {trip.destination}
              </strong>
              <p className="itinerary-day-hero-meta">
                <CalendarDays size={16} aria-hidden />
                {shortDate(day.date)} · {timeWindow(day.activities)}
              </p>
            </div>
          </div>

          <div className="itinerary-day-content">
            <DayBriefing
              day={day}
              trip={trip}
              dayTitle={dayTitle}
              onOpenRoute={setRouteTarget}
              onTweakPlan={() => {
                setTweakResult(undefined)
                setTweakOpen(true)
              }}
            />

            <SocialExperienceStrip experiences={socialExperiences} onOpenRoute={setRouteTarget} />

            <section className="itinerary-day-activities" aria-label="Day schedule">
              <div className="itinerary-section-heading">
                <div>
                  <h2>Schedule</h2>
                  <p>
                    {experienceCountLabel(experiences)} around {location}
                  </p>
                </div>
                <span>{dayMoment(activities[0]?.time)}</span>
              </div>
              {day.activities.length > 0 ? (
                <div className="itinerary-activity-list">
                  {activities.map((activity) => (
                    <ActivityRow key={activity.id} activity={activity} trip={trip} onOpenRoute={setRouteTarget} />
                  ))}
                </div>
              ) : (
                <p className="itinerary-day-empty">Timed activities for this day are still being generated.</p>
              )}
            </section>
          </div>
        </main>

        <BottomNav tripId={trip.id} />
        {routeTarget ? <RouteSheet target={routeTarget} onClose={() => setRouteTarget(null)} /> : null}
        {tweakOpen ? (
          <TweakPlanSheet
            day={day}
            trip={trip}
            dayTitle={dayTitle}
            isPending={tweakMutation.isPending}
            result={tweakResult}
            onClose={() => setTweakOpen(false)}
            onSubmit={(refinement) => tweakMutation.mutate(refinement)}
          />
        ) : null}
      </div>
    </section>
  )
}

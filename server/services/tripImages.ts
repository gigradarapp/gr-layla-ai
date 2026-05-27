import type { ImageSearchContext } from '../../shared/imageRelevance.js'
import { pickDayImageUrl, pickDestinationImage, pickStayImageUrl, type DestinationImageScene } from '../../shared/destinationImages.js'
import {
  buildDayPhotoQueries,
  buildStayPhotoQueries,
  mergePhotoQueries,
  shouldReresolveTripImage,
} from '../../shared/tripImageQueries.js'
import type { StayTier } from '../../shared/stayTiers.js'
import { suggestImageSearchQuery } from './imageSearchAi.js'
import { fetchPlacePhotoFromQueries } from './placePhotos.js'

type DayLike = {
  title: string
  summary: string
  activities: Array<{ title?: string; location?: string; category?: string }>
}

export type ImageResolveOptions = {
  aiQueries?: string[]
  usedUrls?: Set<string>
  resultIndex?: number
  context?: ImageSearchContext
}

function dayImageContext(day: DayLike): ImageSearchContext {
  const text = `${day.title} ${day.summary}`.toLowerCase()
  if (/food|cafe|coffee|street food|hawker|dining/.test(text)) return 'food'
  if (/causeway|border|cross|transfer|depart/.test(text)) return 'transport'
  if (/mosque|temple|museum|heritage|palace|park/.test(text)) return 'landmark'
  return 'day'
}

async function resolveWithAiFallback(input: {
  label: string
  destination: string
  kind: 'hotel' | 'day'
  hints: string[]
  options?: ImageResolveOptions
  stockFallback: () => string
}) {
  const built = input.kind === 'hotel' ? buildStayPhotoQueries(input.label, input.destination) : buildDayPhotoQueries(
      { title: input.label, summary: input.hints.join(' '), activities: [] },
      input.destination,
      { includeDestinationFallback: false },
    )

  const queries = mergePhotoQueries(input.options?.aiQueries, built)
  let photo = await fetchPlacePhotoFromQueries(queries, {
    resultIndex: input.options?.resultIndex,
    avoidUrls: input.options?.usedUrls,
    context: 'hotel',
  })

  if (!photo && process.env.OPENAI_API_KEY) {
    const aiQuery = await suggestImageSearchQuery({
      label: input.label,
      destination: input.destination,
      kind: input.kind,
      hints: input.hints,
    })
    if (aiQuery) {
      photo = await fetchPlacePhotoFromQueries([aiQuery, ...built], {
        resultIndex: (input.options?.resultIndex ?? 0) + 2,
        avoidUrls: input.options?.usedUrls,
        context: 'hotel',
      })
    }
  }

  if (!photo) {
    photo = await fetchPlacePhotoFromQueries(
      input.kind === 'hotel'
        ? buildStayPhotoQueries(input.label, input.destination)
        : buildDayPhotoQueries(
            { title: input.label, summary: input.hints.join(' '), activities: [] },
            input.destination,
          ),
      { resultIndex: (input.options?.resultIndex ?? 0) + 4, avoidUrls: input.options?.usedUrls, context: 'hotel' },
    )
  }

  return photo ?? input.stockFallback()
}

export async function resolveDayImageUrl(
  destination: string,
  day: DayLike,
  dayIndex: number,
  storedUrl?: string,
  options?: ImageResolveOptions,
) {
  if (!shouldReresolveTripImage(storedUrl, options?.usedUrls)) return storedUrl!

  const built = buildDayPhotoQueries(day, destination, { includeDestinationFallback: false })
  const queries = mergePhotoQueries(options?.aiQueries, built)

  const context = options?.context ?? dayImageContext(day)

  let photo = await fetchPlacePhotoFromQueries(queries, {
    resultIndex: options?.resultIndex ?? dayIndex,
    avoidUrls: options?.usedUrls,
    context,
  })

  if (!photo && process.env.OPENAI_API_KEY) {
    const aiQuery = await suggestImageSearchQuery({
      label: day.title,
      destination,
      kind: 'day',
      hints: [day.summary, ...day.activities.map((item) => `${item.title} ${item.location}`)],
    })
    if (aiQuery) {
      photo = await fetchPlacePhotoFromQueries([aiQuery, ...built], {
        resultIndex: dayIndex + 3,
        avoidUrls: options?.usedUrls,
        context,
      })
    }
  }

  if (!photo) {
    photo = await fetchPlacePhotoFromQueries(buildDayPhotoQueries(day, destination), {
      resultIndex: dayIndex + 5,
      avoidUrls: options?.usedUrls,
      context,
    })
  }

  return photo ?? pickDayImageUrl(destination, day, dayIndex)
}

export async function resolveStayImageUrl(
  destination: string,
  tier: StayTier,
  tierIndex: number,
  stayTitle: string,
  storedUrl?: string,
  options?: ImageResolveOptions,
) {
  if (!shouldReresolveTripImage(storedUrl, options?.usedUrls)) return storedUrl!

  return resolveWithAiFallback({
    label: stayTitle,
    destination,
    kind: 'hotel',
    hints: [`${tier} hotel`, destination],
    options: { ...options, resultIndex: options?.resultIndex ?? tierIndex },
    stockFallback: () => pickStayImageUrl(destination, tier, tierIndex),
  })
}

export async function resolveDestinationHeroImage(destination: string, storedUrl?: string) {
  if (!shouldReresolveTripImage(storedUrl)) return storedUrl!

  const placePhoto = await fetchPlacePhotoFromQueries([`${destination} skyline`, destination], { context: 'landmark' })
  if (placePhoto) return placePhoto

  return pickDestinationImage(destination, 'default', 0)
}

export async function resolveSceneImageUrl(destination: string, scene: DestinationImageScene, storedUrl?: string) {
  if (!shouldReresolveTripImage(storedUrl)) return storedUrl!

  const placePhoto = await fetchPlacePhotoFromQueries(
    [`${destination} ${scene.replace('_', ' ')}`, scene === 'arrival' ? 'Johor–Singapore Causeway' : `${destination}`],
    { context: scene === 'arrival' ? 'transport' : 'landmark' },
  )
  if (placePhoto) return placePhoto

  return pickDestinationImage(destination, scene, 0)
}

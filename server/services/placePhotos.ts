import { pickBestImageCandidate, type ImageSearchContext, isBadImageUrl } from '../../shared/imageRelevance.js'
import { DESTINATION_ONLY_PHOTO_URLS } from '../../shared/tripImageQueries.js'

const WIKI_USER_AGENT = 'LaylaTravelDemo/1.0 (https://github.com/local/layla-demo; travel-planner-demo)'

const photoCache = new Map<string, string | null>()

export type PhotoFetchOptions = {
  resultIndex?: number
  avoidUrls?: Set<string>
  context?: ImageSearchContext
}

function normalizeQuery(query: string) {
  return query.trim().toLowerCase().replace(/\s+/g, ' ')
}

function cacheKey(query: string, resultIndex: number, context: ImageSearchContext) {
  return `${normalizeQuery(query)}#${context}#${resultIndex}`
}

function acceptUrl(url: string | null | undefined, avoidUrls?: Set<string>) {
  if (!url?.trim()) return null
  if (isBadImageUrl(url)) return null
  if (avoidUrls?.has(url)) return null
  if (DESTINATION_ONLY_PHOTO_URLS.has(url) && avoidUrls && avoidUrls.size > 0) return null
  return url
}

async function fetchJson(url: string) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': WIKI_USER_AGENT,
      Accept: 'application/json',
    },
  })
  if (!response.ok) return null
  return response.json() as Promise<Record<string, unknown>>
}

type ImageCandidate = { title: string; url: string }

/** Openverse — free, openly licensed photos (no API key). */
async function searchOpenverseCandidates(query: string): Promise<ImageCandidate[]> {
  const params = new URLSearchParams({
    q: query,
    page_size: '10',
    license_type: 'commercial,modification',
    mature: 'false',
  })
  const data = await fetchJson(`https://api.openverse.org/v1/images/?${params}`)
  const results =
    (data?.results as Array<{ url?: string; title?: string; tags?: Array<{ name?: string }> }> | undefined) ?? []
  return results
    .map((item) => ({
      url: item.url ?? '',
      title: [item.title, ...(item.tags?.map((tag) => tag.name) ?? [])].filter(Boolean).join(' '),
    }))
    .filter((item) => item.url.startsWith('http'))
}

async function wikipediaSearchCandidates(query: string, limit = 6): Promise<ImageCandidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: 'pageimages',
    piprop: 'thumbnail',
    pithumbsize: '800',
    format: 'json',
    origin: '*',
  })
  const data = await fetchJson(`https://en.wikipedia.org/w/api.php?${params}`)
  const pages = (data?.query as { pages?: Record<string, { title?: string; index?: number; thumbnail?: { source?: string } }> } | undefined)
    ?.pages
  if (!pages) return []

  return Object.values(pages)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((page) => ({
      title: page.title ?? query,
      url: page.thumbnail?.source ?? '',
    }))
    .filter((item) => item.url.startsWith('http'))
}

async function commonsSearchCandidates(query: string, limit = 6): Promise<ImageCandidate[]> {
  const params = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: query,
    gsrlimit: String(limit),
    prop: 'imageinfo',
    iiprop: 'url',
    iiurlwidth: '800',
    format: 'json',
    origin: '*',
  })
  const data = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`)
  const pages = (data?.query as {
    pages?: Record<string, { title?: string; index?: number; imageinfo?: Array<{ thumburl?: string; url?: string }> }>
  } | undefined)?.pages
  if (!pages) return []

  return Object.values(pages)
    .sort((a, b) => (a.index ?? 0) - (b.index ?? 0))
    .map((page) => ({
      title: page.title ?? query,
      url: page.imageinfo?.[0]?.thumburl ?? page.imageinfo?.[0]?.url ?? '',
    }))
    .filter((item) => item.url.startsWith('http'))
}

async function searchOpenversePhoto(query: string, context: ImageSearchContext, options?: PhotoFetchOptions) {
  const candidates = await searchOpenverseCandidates(query)
  const picked = pickBestImageCandidate(query, context, candidates, {
    avoidUrls: options?.avoidUrls,
    minScore: context === 'hotel' ? 3 : 2,
  })
  if (picked) return picked

  const offset = options?.resultIndex ?? 0
  const relaxed = candidates[offset % Math.max(1, candidates.length)]
  if (relaxed && !options?.avoidUrls?.has(relaxed.url) && !isBadImageUrl(relaxed.url)) {
    return relaxed.url
  }
  return null
}

async function searchWikiPhoto(query: string, context: ImageSearchContext, options?: PhotoFetchOptions) {
  const wiki = await wikipediaSearchCandidates(query, 6)
  const commons = await commonsSearchCandidates(query, 6)
  return pickBestImageCandidate(query, context, [...wiki, ...commons], {
    avoidUrls: options?.avoidUrls,
    minScore: context === 'hotel' ? 5 : 3,
  })
}

export async function fetchPlacePhotoUrl(query: string, options?: PhotoFetchOptions): Promise<string | null> {
  const trimmed = query.trim()
  if (!trimmed) return null

  const context = options?.context ?? 'general'
  const resultIndex = options?.resultIndex ?? 0
  const key = cacheKey(trimmed, resultIndex, context)
  if (photoCache.has(key)) {
    return acceptUrl(photoCache.get(key) ?? null, options?.avoidUrls)
  }

  let resolved =
    acceptUrl(await searchOpenversePhoto(trimmed, context, options), options?.avoidUrls) ??
    acceptUrl(await searchWikiPhoto(trimmed, context, options), options?.avoidUrls) ??
    null

  photoCache.set(key, resolved)
  return resolved
}

export async function fetchPlacePhotoFromQueries(queries: string[], options?: PhotoFetchOptions) {
  for (let index = 0; index < queries.length; index += 1) {
    const url = await fetchPlacePhotoUrl(queries[index], {
      resultIndex: (options?.resultIndex ?? 0) + index,
      avoidUrls: options?.avoidUrls,
      context: options?.context,
    })
    if (url) return url
  }
  return null
}

export function clearPlacePhotoCacheForTests() {
  photoCache.clear()
}

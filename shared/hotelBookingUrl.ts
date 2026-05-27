const PLACEHOLDER_URLS = /^#|about:blank$/i

export function buildHotelBookingUrl(hotelTitle: string, destination: string) {
  const query = `${hotelTitle.trim()} ${destination.trim()}`.replace(/\s+/g, ' ').trim()
  return `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(query)}`
}

export function buildGoogleHotelsUrl(hotelTitle: string, destination: string) {
  const query = `${hotelTitle.trim()} ${destination.trim()}`.replace(/\s+/g, ' ').trim()
  return `https://www.google.com/travel/hotels?q=${encodeURIComponent(query)}`
}

export function resolveHotelBookingUrl(
  storedUrl: string | undefined,
  hotelTitle: string,
  destination: string,
) {
  if (storedUrl && !PLACEHOLDER_URLS.test(storedUrl) && storedUrl.startsWith('http')) {
    return storedUrl
  }
  return buildHotelBookingUrl(hotelTitle, destination)
}

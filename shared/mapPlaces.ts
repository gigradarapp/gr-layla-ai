export type MapPlace = {
  lat: number
  lng: number
  label: string
}

const places: Record<string, MapPlace> = {
  singapore: { lat: 1.3521, lng: 103.8198, label: 'Singapore' },
  'johor bahru': { lat: 1.4927, lng: 103.7414, label: 'Johor Bahru' },
  jb: { lat: 1.4927, lng: 103.7414, label: 'Johor Bahru' },
  tokyo: { lat: 35.6762, lng: 139.6503, label: 'Tokyo' },
  kyoto: { lat: 35.0116, lng: 135.7681, label: 'Kyoto' },
  bali: { lat: -8.4095, lng: 115.1889, label: 'Bali' },
  seoul: { lat: 37.5665, lng: 126.978, label: 'Seoul' },
  lisbon: { lat: 38.7223, lng: -9.1393, label: 'Lisbon' },
  queenstown: { lat: -45.0312, lng: 168.6626, label: 'Queenstown' },
  auckland: { lat: -36.8509, lng: 174.7645, label: 'Auckland' },
  'kuala lumpur': { lat: 3.139, lng: 101.6869, label: 'Kuala Lumpur' },
  kl: { lat: 3.139, lng: 101.6869, label: 'Kuala Lumpur' },
}

function normalizePlaceKey(name: string) {
  return name.trim().toLowerCase().replace(/\s+/g, ' ')
}

export function resolveMapPlace(name: string): MapPlace {
  const key = normalizePlaceKey(name)
  const direct = places[key]
  if (direct) return { ...direct, label: name.trim() || direct.label }

  const fuzzy = Object.entries(places).find(([candidate]) => key.includes(candidate) || candidate.includes(key))
  if (fuzzy) return { ...fuzzy[1], label: name.trim() || fuzzy[1].label }

  return { lat: 20, lng: 0, label: name.trim() || 'Destination' }
}

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildDayPhotoQueries, buildStayPhotoQueries } from '../../shared/tripImageQueries.js'
import { clearPlacePhotoCacheForTests, fetchPlacePhotoUrl } from '../services/placePhotos.js'

describe('placePhotos', () => {
  it('builds location-first search queries from day activities', () => {
    const queries = buildDayPhotoQueries(
      {
        title: 'Day 1 — Cross the border, café hop',
        summary: 'Cross into Johor Bahru and check in near JB Sentral.',
        activities: [
          { title: 'Causeway transfer', location: 'Johor–Singapore Causeway', category: 'logistics' },
          { title: 'Old Town cafe', location: 'Jalan Tan Hiok Nee', category: 'food' },
        ],
      },
      'Johor Bahru',
    )

    assert.ok(queries.some((query) => /causeway/i.test(query)))
    assert.ok(queries.some((query) => /jalan tan hiok nee/i.test(query)))
  })

  it('resolves a region photo via web or wiki search', async () => {
    clearPlacePhotoCacheForTests()
    const url = await fetchPlacePhotoUrl('R&F Princess Cove Johor Bahru hotel', { context: 'hotel' })
    assert.ok(url)
    assert.doesNotMatch(url, /unsplash\.com/i)
    assert.ok(!/sultan|eagle|hawk|portrait/i.test(url))
  })

  it('returns different photos for city vs a specific street', async () => {
    clearPlacePhotoCacheForTests()
    const city = await fetchPlacePhotoUrl('Johor Bahru', { resultIndex: 0 })
    const street = await fetchPlacePhotoUrl('Jalan Tan Hiok Nee Johor Bahru', { resultIndex: 0 })
    assert.ok(city)
    assert.ok(street)
    assert.notEqual(city, street)
  })

  it('builds distinct stay search queries per hotel', () => {
    const a = buildStayPhotoQueries('Fives Hotel Johor Bahru', 'Johor Bahru')
    const b = buildStayPhotoQueries('Amari Johor Bahru', 'Johor Bahru')
    assert.notDeepEqual(a, b)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { buildHotelBookingUrl, resolveHotelBookingUrl } from '../../shared/hotelBookingUrl.js'

describe('hotelBookingUrl', () => {
  it('builds a Booking.com search URL from hotel title and destination', () => {
    const url = buildHotelBookingUrl('DoubleTree by Hilton Johor Bahru', 'Johor Bahru')
    assert.match(url, /^https:\/\/www\.booking\.com\/searchresults\.html\?ss=/)
    assert.match(url, /DoubleTree/)
    assert.match(url, /Johor/)
  })

  it('replaces placeholder stored URLs', () => {
    const url = resolveHotelBookingUrl('#simulated-handoff', 'Amari Johor Bahru', 'Johor Bahru')
    assert.match(url, /booking\.com/)
  })
})

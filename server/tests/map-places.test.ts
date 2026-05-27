import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { resolveMapPlace } from '../../shared/mapPlaces.js'

describe('mapPlaces', () => {
  it('resolves Singapore and Johor Bahru coordinates', () => {
    const singapore = resolveMapPlace('Singapore')
    const johor = resolveMapPlace('Johor Bahru')

    assert.ok(singapore.lat < johor.lat)
    assert.ok(Math.abs(singapore.lng - johor.lng) < 1)
  })
})

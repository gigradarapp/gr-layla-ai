import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { pickDayImageUrl, pickStayImageUrl } from '../../shared/destinationImages.js'

describe('destinationImages', () => {
  it('picks different hotel images per tier for Johor Bahru', () => {
    const budget = pickStayImageUrl('Johor Bahru', 'budget', 0)
    const regular = pickStayImageUrl('Johor Bahru', 'regular', 0)
    const premium = pickStayImageUrl('Johor Bahru', 'premium', 0)

    assert.notEqual(budget, regular)
    assert.notEqual(regular, premium)
    assert.doesNotMatch(budget, /1503899036084/)
  })

  it('picks different day images from title context', () => {
    const dayOne = pickDayImageUrl(
      'Johor Bahru',
      {
        title: 'Day 1 — Cross the border and check in',
        summary: 'Cross into Johor Bahru.',
        activities: [{ category: 'logistics', title: 'Border crossing' }],
      },
      0,
    )
    const dayTwo = pickDayImageUrl(
      'Johor Bahru',
      {
        title: 'Day 2 — Cafe hopping downtown',
        summary: 'Food and local cafes.',
        activities: [{ category: 'food', title: 'Cafe crawl' }],
      },
      1,
    )

    assert.notEqual(dayOne, dayTwo)
  })
})

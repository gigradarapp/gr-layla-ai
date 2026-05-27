import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { dayExperienceCount, tripExperienceCount } from '../../shared/experienceCount.js'
import { normalizeItineraryDays } from '../../shared/normalizeItinerary.js'

describe('experienceCount', () => {
  it('uses chat picks for trip and day counts', () => {
    const focus = ['Cafe hopping in JB old town']
    const days = [
      {
        activities: [
          { title: 'Check-in', category: 'logistics' },
          { title: 'Cafe hopping in JB old town', category: 'experience' },
          { title: 'Dinner', category: 'food' },
        ],
      },
      {
        activities: [{ title: 'Return to Singapore', category: 'logistics' }],
      },
    ]

    assert.equal(tripExperienceCount(focus, days), 1)
    assert.equal(dayExperienceCount(1, focus, days[0].activities), 1)
    assert.equal(dayExperienceCount(2, focus, days[1].activities), 0)
  })
})

describe('normalizeItineraryDays', () => {
  it('keeps one experience when user picked one activity', () => {
    const normalized = normalizeItineraryDays(
      [
        {
          dayNumber: 1,
          title: 'Day 1',
          summary: 'Arrival',
          activities: [
            { time: '09:00', title: 'Check-in', location: 'JB', category: 'logistics', cost: 0, durationMinutes: 60 },
            { time: '10:00', title: 'Spa', location: 'JB', category: 'wellness', cost: 40, durationMinutes: 90 },
            { time: '12:00', title: 'Mall', location: 'JB', category: 'shopping', cost: 0, durationMinutes: 120 },
            { time: '14:00', title: 'Cafe hopping', location: 'JB', category: 'experience', cost: 20, durationMinutes: 120 },
          ],
        },
        {
          dayNumber: 2,
          title: 'Day 2',
          summary: 'Return',
          activities: [
            { time: '09:00', title: 'Breakfast', location: 'JB', category: 'food', cost: 15, durationMinutes: 60 },
            { time: '11:00', title: 'Shopping', location: 'JB', category: 'shopping', cost: 0, durationMinutes: 120 },
          ],
        },
      ],
      ['Cafe hopping'],
      'Johor Bahru',
      'slow',
    )

    assert.equal(normalized[0]?.activities.filter((item) => item.category === 'experience').length, 1)
    assert.equal(normalized[1]?.activities.some((item) => item.category === 'experience'), false)
  })
})

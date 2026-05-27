import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isBadImageUrl, pickBestImageCandidate, scoreImageCandidate } from '../../shared/imageRelevance.js'

describe('imageRelevance', () => {
  it('rejects portrait and bird-like results for hotels', () => {
    assert.ok(isBadImageUrl('https://upload.wikimedia.org/wikipedia/commons/Sultan_Ibrahim_Portrait.jpg'))
    assert.ok(
      scoreImageCandidate({
        query: 'DoubleTree Hilton Johor Bahru',
        title: 'White-bellied Sea Eagle in flight',
        context: 'hotel',
      }) < 0,
    )
    assert.ok(
      scoreImageCandidate({
        query: 'R&F Princess Cove Johor Bahru',
        title: "Johor Bahru coastal skyline R&F Princess Cove",
        context: 'hotel',
      }) > 5,
    )
  })

  it('picks the best hotel candidate from a mixed list', () => {
    const url = pickBestImageCandidate(
      'R&F Princess Cove Johor Bahru',
      'hotel',
      [
        { title: 'Sultan Ibrahim of Johor', url: 'https://example.com/sultan.jpg' },
        { title: 'R&F Princess Cove waterfront towers', url: 'https://example.com/princess.jpg' },
      ],
      { minScore: 3 },
    )
    assert.equal(url, 'https://example.com/princess.jpg')
  })
})

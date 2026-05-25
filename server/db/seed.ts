import { db, id, jsonArray, migrate } from './sqlite.js'

const now = new Date().toISOString()

const users = [
  {
    id: 'usr_demo',
    name: 'Sayyid',
    email: 'sayyid@example.com',
    home_airport: 'SIN',
    traveler_type: 'operator',
  },
]

const destinations = [
  {
    id: 'dest_tokyo',
    name: 'Tokyo',
    country: 'Japan',
    vibe: 'food, culture, neon, efficient',
    budget_level: 'mid',
    weather: 'cool spring',
    ideal_duration: '5 days',
    traveler_types: ['couples', 'solo', 'friends', 'foodies'],
    flight_price_from: 420,
    image_url:
      'https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=1200&q=80',
    summary: 'A fast, food-led city trip with tight transit, late-night neighborhoods, and easy day-plan density.',
    highlights: ['Tsukiji breakfast crawl', 'Shimokitazawa vintage lanes', 'teamLab Borderless', 'Golden Gai'],
  },
  {
    id: 'dest_kyoto',
    name: 'Kyoto',
    country: 'Japan',
    vibe: 'heritage, calm, temples, craft',
    budget_level: 'mid',
    weather: 'mild autumn',
    ideal_duration: '4 days',
    traveler_types: ['couples', 'families', 'culture seekers'],
    flight_price_from: 470,
    image_url:
      'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80',
    summary: 'A slower cultural route with shrines, old streets, tea houses, and compact rail hops.',
    highlights: ['Fushimi Inari early walk', 'Gion evening lanes', 'Arashiyama bamboo grove', 'Uji tea day trip'],
  },
  {
    id: 'dest_bali',
    name: 'Bali',
    country: 'Indonesia',
    vibe: 'wellness, surf, villas, nature',
    budget_level: 'budget',
    weather: 'warm tropical',
    ideal_duration: '4 days',
    traveler_types: ['couples', 'solo', 'wellness'],
    flight_price_from: 160,
    image_url:
      'https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80',
    summary: 'A quick recharge trip with villas, cafes, beach clubs, waterfalls, and low-friction flights from Singapore.',
    highlights: ['Canggu surf morning', 'Ubud rice terraces', 'Seminyak sunset', 'Mount Batur sunrise'],
  },
  {
    id: 'dest_johor_bahru',
    name: 'Johor Bahru',
    country: 'Malaysia',
    vibe: 'budget, cafes, quick escape, local activities',
    budget_level: 'budget',
    weather: 'warm tropical',
    ideal_duration: '2 days',
    traveler_types: ['solo', 'couples', 'families', 'weekenders'],
    flight_price_from: 0,
    image_url:
      'https://images.unsplash.com/photo-1596422846543-75c6fc197f07?auto=format&fit=crop&w=1200&q=80',
    summary: 'A fast Singapore-origin land getaway with cafes, hotels under tight budgets, shopping, and easy local activities.',
    highlights: ['Cafe hopping', 'Old town walk', 'Budget hotel stay', 'Private car crossing'],
  },
  {
    id: 'dest_seoul',
    name: 'Seoul',
    country: 'South Korea',
    vibe: 'food, shopping, nightlife, design',
    budget_level: 'mid',
    weather: 'crisp winter',
    ideal_duration: '5 days',
    traveler_types: ['friends', 'couples', 'solo'],
    flight_price_from: 380,
    image_url:
      'https://images.unsplash.com/photo-1538485399081-7c8f3b2171a6?auto=format&fit=crop&w=1200&q=80',
    summary: 'A high-energy friends trip with food markets, design districts, cosmetics, cafes, and late-night streets.',
    highlights: ['Ikseon-dong cafes', 'Hongdae night route', 'Gwangjang Market', 'Seongsu design shops'],
  },
  {
    id: 'dest_queenstown',
    name: 'Queenstown',
    country: 'New Zealand',
    vibe: 'road trip, alpine, adventure, scenic',
    budget_level: 'premium',
    weather: 'cool alpine',
    ideal_duration: '8 days',
    traveler_types: ['road trippers', 'couples', 'adventure'],
    flight_price_from: 980,
    image_url:
      'https://images.unsplash.com/photo-1507699622108-4be3abd695ad?auto=format&fit=crop&w=1200&q=80',
    summary: 'A premium nature route with scenic drives, lake stays, hikes, vineyards, and adventure add-ons.',
    highlights: ['Glenorchy drive', 'Milford Sound flight', 'Arrowtown lunch', 'Lake Wakatipu cruise'],
  },
  {
    id: 'dest_lisbon',
    name: 'Lisbon',
    country: 'Portugal',
    vibe: 'sunny, food, tile, walkable',
    budget_level: 'mid',
    weather: 'sunny shoulder season',
    ideal_duration: '6 days',
    traveler_types: ['couples', 'solo', 'families'],
    flight_price_from: 780,
    image_url:
      'https://images.unsplash.com/photo-1501927023255-9063be98970c?auto=format&fit=crop&w=1200&q=80',
    summary: 'A city break with warm light, seafood, viewpoints, day trips, and strong value for Europe.',
    highlights: ['Alfama tram loop', 'Sintra day trip', 'Time Out Market', 'Belém pastries'],
  },
  {
    id: 'dest_jordan',
    name: 'Jordan',
    country: 'Jordan',
    vibe: 'desert, history, honeymoon, cinematic',
    budget_level: 'premium',
    weather: 'dry warm',
    ideal_duration: '7 days',
    traveler_types: ['couples', 'luxury', 'culture seekers'],
    flight_price_from: 760,
    image_url:
      'https://images.unsplash.com/photo-1548786811-dd6e453ccca7?auto=format&fit=crop&w=1200&q=80',
    summary: 'A cinematic route through Amman, Petra, Wadi Rum, and the Dead Sea with premium desert stays.',
    highlights: ['Petra by candlelight', 'Wadi Rum camp', 'Dead Sea float', 'Amman food walk'],
  },
  {
    id: 'dest_maldives',
    name: 'Maldives',
    country: 'Maldives',
    vibe: 'beach, resort, snorkel, honeymoon',
    budget_level: 'premium',
    weather: 'warm ocean',
    ideal_duration: '4 days',
    traveler_types: ['couples', 'luxury', 'families'],
    flight_price_from: 300,
    image_url:
      'https://images.unsplash.com/photo-1514282401047-d79a71a590e8?auto=format&fit=crop&w=1200&q=80',
    summary: 'A direct reset trip where the planning job is choosing the right island, transfer, and resort inclusions.',
    highlights: ['House reef snorkel', 'Sandbank picnic', 'Sunset dhoni', 'Overwater villa'],
  },
]

const seedTrips = [
  {
    id: 'trip_tokyo_kyoto',
    title: '5-day Japan food and culture sprint',
    destination: 'Tokyo + Kyoto',
    origin: 'Singapore',
    start_date: '2026-07-08',
    end_date: '2026-07-13',
    budget_level: 'mid',
    traveler_type: 'couple',
    pace: 'balanced',
    status: 'ready',
    summary:
      'A tight but realistic Japan route for two: Tokyo food neighborhoods first, then a calmer Kyoto heritage finish with rail timing kept simple.',
    estimated_cost: 3200,
    hero_image_url:
      'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=1200&q=80',
    confidence: 86,
    days: [
      {
        title: 'Land, eat, and reset in Shinjuku',
        summary: 'Keep arrival day light: rail transfer, hotel check-in, one excellent food district.',
        activities: [
          ['16:00', 'Arrive and check in near Shinjuku Station', 'Shinjuku', 'logistics', 0, 90],
          ['18:30', 'Omoide Yokocho yakitori crawl', 'Shinjuku', 'food', 55, 120],
          ['21:00', 'Golden Gai low-key drink route', 'Golden Gai', 'nightlife', 35, 90],
        ],
      },
      {
        title: 'Markets, museums, and east Tokyo',
        summary: 'Start with food, then balance with a visual museum and riverside neighborhoods.',
        activities: [
          ['08:30', 'Tsukiji outer market breakfast', 'Tsukiji', 'food', 45, 120],
          ['11:30', 'teamLab Borderless slot', 'Azabudai Hills', 'culture', 45, 120],
          ['15:00', 'Asakusa and Sumida river walk', 'Asakusa', 'culture', 20, 150],
        ],
      },
      {
        title: 'Kyoto rail transfer and Gion evening',
        summary: 'Use the Shinkansen as the main move, then keep Kyoto evening atmospheric.',
        activities: [
          ['09:30', 'Shinkansen to Kyoto', 'Tokyo Station', 'transport', 145, 140],
          ['14:00', 'Check in near Kawaramachi', 'Kyoto', 'logistics', 0, 60],
          ['18:00', 'Gion and Pontocho dinner walk', 'Gion', 'food', 75, 150],
        ],
      },
    ],
  },
  {
    id: 'trip_bali_reset',
    title: 'Bali wellness weekend from Singapore',
    destination: 'Bali',
    origin: 'Singapore',
    start_date: '2026-06-12',
    end_date: '2026-06-16',
    budget_level: 'budget',
    traveler_type: 'solo',
    pace: 'slow',
    status: 'draft',
    summary:
      'A short wellness reset with low transit complexity: Canggu cafes, Ubud nature, massage blocks, and one sunrise activity.',
    estimated_cost: 980,
    hero_image_url:
      'https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?auto=format&fit=crop&w=1200&q=80',
    confidence: 82,
    days: [
      {
        title: 'Canggu arrival and beach sunset',
        summary: 'Arrival day stays flexible with a villa check-in and sunset meal.',
        activities: [
          ['15:00', 'Check in near Batu Bolong', 'Canggu', 'logistics', 0, 60],
          ['17:30', 'Echo Beach sunset walk', 'Canggu', 'nature', 0, 90],
          ['19:30', 'Casual Indonesian dinner', 'Canggu', 'food', 18, 90],
        ],
      },
      {
        title: 'Ubud nature and spa day',
        summary: 'Move inland for rice terraces, a massage, and a quiet evening.',
        activities: [
          ['09:00', 'Transfer to Ubud', 'Canggu to Ubud', 'transport', 28, 90],
          ['11:00', 'Tegallalang rice terrace walk', 'Ubud', 'nature', 10, 120],
          ['15:00', 'Balinese massage and recovery block', 'Ubud', 'wellness', 35, 120],
        ],
      },
    ],
  },
  {
    id: 'trip_seoul_friends',
    title: 'Seoul food, shopping, and cafe run',
    destination: 'Seoul',
    origin: 'Singapore',
    start_date: '2026-09-04',
    end_date: '2026-09-09',
    budget_level: 'mid',
    traveler_type: 'friends',
    pace: 'fast',
    status: 'ready',
    summary:
      'A friends trip optimized around food markets, shopping districts, cafe neighborhoods, and late-night movement.',
    estimated_cost: 2400,
    hero_image_url:
      'https://images.unsplash.com/photo-1506816561089-5cc37b3aa9b0?auto=format&fit=crop&w=1200&q=80',
    confidence: 79,
    days: [
      {
        title: 'Myeongdong base and night snacks',
        summary: 'Settle into a central base and start with easy food wins.',
        activities: [
          ['16:30', 'Check in near Myeongdong', 'Myeongdong', 'logistics', 0, 60],
          ['18:00', 'Myeongdong street snack circuit', 'Myeongdong', 'food', 30, 120],
          ['21:00', 'Namsan night view', 'N Seoul Tower', 'viewpoint', 18, 90],
        ],
      },
      {
        title: 'Markets, palaces, and Hongdae',
        summary: 'Classic Seoul day with a late-night student district finish.',
        activities: [
          ['09:30', 'Gyeongbokgung palace walk', 'Jongno', 'culture', 5, 120],
          ['12:30', 'Gwangjang Market lunch', 'Jongno', 'food', 25, 90],
          ['20:00', 'Hongdae music and dessert route', 'Hongdae', 'nightlife', 45, 180],
        ],
      },
    ],
  },
]

const baseOffers = [
  ['flight', 'SkySearch demo', 'Singapore to Tokyo round trip', 420, 4.4, ['1 stop', '12h total', 'checked bag option'], 'dest_tokyo'],
  ['hotel', 'StayFinder demo', 'Shinjuku design hotel', 165, 4.7, ['near station', 'breakfast option', 'free cancellation'], 'dest_tokyo'],
  ['activity', 'LocalPass demo', 'Tokyo food alley evening tour', 72, 4.8, ['small group', '3 hours', 'local guide'], 'dest_tokyo'],
  ['flight', 'SkySearch demo', 'Singapore to Bali direct', 160, 4.5, ['direct', '2h 45m', 'budget carrier'], 'dest_bali'],
  ['hotel', 'StayFinder demo', 'Canggu pool villa', 98, 4.6, ['private pool', 'workspace', 'breakfast included'], 'dest_bali'],
  ['activity', 'LocalPass demo', 'Ubud rice terrace and spa day', 64, 4.7, ['pickup included', '6 hours', 'wellness'], 'dest_bali'],
  ['hotel', 'StayFinder demo', 'Mood Hotel platform queen room', 34, 3.7, ['budget stay', '170 reviews', 'non-refundable'], 'dest_johor_bahru'],
  ['activity', 'LocalPass demo', 'Historic Johor Bahru cafe walk', 28, 4.4, ['5 experiences', 'local food', 'old town route'], 'dest_johor_bahru'],
  ['activity', 'Transfer demo', 'Singapore to Johor Bahru private car', 42, 4.5, ['50m estimate', 'land crossing', 'door to door'], 'dest_johor_bahru'],
  ['flight', 'SkySearch demo', 'Singapore to Seoul round trip', 380, 4.3, ['direct option', '6h 30m', 'red-eye return'], 'dest_seoul'],
  ['hotel', 'StayFinder demo', 'Myeongdong boutique stay', 142, 4.5, ['central', 'quad rooms', 'airport bus nearby'], 'dest_seoul'],
  ['activity', 'LocalPass demo', 'Seoul night market crawl', 45, 4.8, ['food-led', '2.5 hours', 'group friendly'], 'dest_seoul'],
  ['flight', 'SkySearch demo', 'Singapore to Queenstown open jaw', 980, 4.2, ['1 stop', 'premium economy option', 'flex dates'], 'dest_queenstown'],
  ['hotel', 'StayFinder demo', 'Lake Wakatipu lodge', 260, 4.9, ['lake view', 'parking', 'breakfast included'], 'dest_queenstown'],
  ['activity', 'LocalPass demo', 'Milford Sound fly-cruise-fly', 420, 4.9, ['weather dependent', 'half day', 'scenic flight'], 'dest_queenstown'],
] as const

function clear() {
  db.exec(`
    DELETE FROM trip_refinements;
    DELETE FROM offers;
    DELETE FROM chat_messages;
    DELETE FROM activities;
    DELETE FROM trip_days;
    DELETE FROM trips;
    DELETE FROM destinations;
    DELETE FROM users;
  `)
}

export function seedDatabase() {
  migrate()
  clear()

  const insertUser = db.prepare(
    'INSERT INTO users (id, name, email, home_airport, traveler_type, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (const user of users) {
    insertUser.run(user.id, user.name, user.email, user.home_airport, user.traveler_type, now)
  }

  const insertDestination = db.prepare(`
    INSERT INTO destinations
      (id, name, country, vibe, budget_level, weather, ideal_duration, traveler_types, flight_price_from, image_url, summary, highlights, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const destination of destinations) {
    insertDestination.run(
      destination.id,
      destination.name,
      destination.country,
      destination.vibe,
      destination.budget_level,
      destination.weather,
      destination.ideal_duration,
      jsonArray(destination.traveler_types),
      destination.flight_price_from,
      destination.image_url,
      destination.summary,
      jsonArray(destination.highlights),
      now,
    )
  }

  const insertTrip = db.prepare(`
    INSERT INTO trips
      (id, user_id, title, destination, origin, start_date, end_date, budget_level, traveler_type, pace, status, summary, estimated_cost, hero_image_url, confidence, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertDay = db.prepare(`
    INSERT INTO trip_days (id, trip_id, day_number, date, title, summary)
    VALUES (?, ?, ?, ?, ?, ?)
  `)
  const insertActivity = db.prepare(`
    INSERT INTO activities
      (id, trip_day_id, time, title, location, category, cost, duration_minutes, notes, confidence)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const insertMessage = db.prepare(`
    INSERT INTO chat_messages (id, trip_id, role, content, created_at)
    VALUES (?, ?, ?, ?, ?)
  `)

  for (const trip of seedTrips) {
    insertTrip.run(
      trip.id,
      'usr_demo',
      trip.title,
      trip.destination,
      trip.origin,
      trip.start_date,
      trip.end_date,
      trip.budget_level,
      trip.traveler_type,
      trip.pace,
      trip.status,
      trip.summary,
      trip.estimated_cost,
      trip.hero_image_url,
      trip.confidence,
      now,
      now,
    )

    insertMessage.run(id('msg'), trip.id, 'user', `Plan ${trip.title.toLowerCase()} from ${trip.origin}.`, now)
    insertMessage.run(id('msg'), trip.id, 'assistant', trip.summary, now)

    trip.days.forEach((day, index) => {
      const dayId = `${trip.id}_day_${index + 1}`
      insertDay.run(dayId, trip.id, index + 1, trip.start_date, day.title, day.summary)
      day.activities.forEach((activity, activityIndex) => {
        insertActivity.run(
          `${dayId}_act_${activityIndex + 1}`,
          dayId,
          activity[0],
          activity[1],
          activity[2],
          activity[3],
          activity[4],
          activity[5],
          'Demo recommendation. Verify live opening hours and booking terms before purchase.',
          78 + activityIndex * 4,
        )
      })
    })
  }

  const insertOffer = db.prepare(`
    INSERT INTO offers
      (id, trip_id, destination_id, type, provider, title, price, rating, perks, url, image_url, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const [type, provider, title, price, rating, perks, destinationId] of baseOffers) {
    const imageUrl =
      destinations.find((destination) => destination.id === destinationId)?.image_url ?? destinations[0].image_url
    const relatedTrip = destinationId === 'dest_tokyo' ? 'trip_tokyo_kyoto' : destinationId === 'dest_bali' ? 'trip_bali_reset' : destinationId === 'dest_seoul' ? 'trip_seoul_friends' : null
    insertOffer.run(
      id('offer'),
      relatedTrip,
      destinationId,
      type,
      provider,
      title,
      price,
      rating,
      jsonArray(perks),
      '#simulated-handoff',
      imageUrl,
      now,
    )
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  seedDatabase()
  console.log('Seeded SQLite demo data in data/app.db')
}

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  home_airport TEXT NOT NULL,
  traveler_type TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS destinations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  country TEXT NOT NULL,
  vibe TEXT NOT NULL,
  budget_level TEXT NOT NULL,
  weather TEXT NOT NULL,
  ideal_duration TEXT NOT NULL,
  traveler_types TEXT NOT NULL,
  flight_price_from INTEGER NOT NULL,
  image_url TEXT NOT NULL,
  summary TEXT NOT NULL,
  highlights TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  destination TEXT NOT NULL,
  origin TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  budget_level TEXT NOT NULL,
  traveler_type TEXT NOT NULL,
  pace TEXT NOT NULL,
  status TEXT NOT NULL,
  summary TEXT NOT NULL,
  estimated_cost INTEGER NOT NULL,
  hero_image_url TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  focus_activities TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS trip_days (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  day_number INTEGER NOT NULL,
  date TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  image_url TEXT NOT NULL DEFAULT '',
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  trip_day_id TEXT NOT NULL,
  time TEXT NOT NULL,
  title TEXT NOT NULL,
  location TEXT NOT NULL,
  category TEXT NOT NULL,
  cost INTEGER NOT NULL,
  duration_minutes INTEGER NOT NULL,
  notes TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  FOREIGN KEY (trip_day_id) REFERENCES trip_days(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  trip_id TEXT,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS offers (
  id TEXT PRIMARY KEY,
  trip_id TEXT,
  destination_id TEXT,
  type TEXT NOT NULL,
  provider TEXT NOT NULL,
  title TEXT NOT NULL,
  price INTEGER NOT NULL,
  rating REAL NOT NULL,
  perks TEXT NOT NULL,
  url TEXT NOT NULL,
  image_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE,
  FOREIGN KEY (destination_id) REFERENCES destinations(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS trip_refinements (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL,
  refinement TEXT NOT NULL,
  result_summary TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_trip_days_trip_id ON trip_days(trip_id);
CREATE INDEX IF NOT EXISTS idx_activities_day_id ON activities(trip_day_id);
CREATE INDEX IF NOT EXISTS idx_messages_trip_id ON chat_messages(trip_id);
CREATE INDEX IF NOT EXISTS idx_offers_trip_id ON offers(trip_id);
CREATE INDEX IF NOT EXISTS idx_offers_destination_id ON offers(destination_id);

-- Photos, mission references and company logos live outside the event JSON.
-- The event row stays a few KB, so every poll and every upload stays fast
-- no matter how many photos the hall has taken.
CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  event_id TEXT NOT NULL,
  data BYTEA NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS images_event_id_idx ON images (event_id);

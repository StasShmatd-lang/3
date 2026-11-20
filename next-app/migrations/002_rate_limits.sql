CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key TEXT PRIMARY KEY,
  hits INT NOT NULL,
  reset_at TIMESTAMPTZ NOT NULL
);

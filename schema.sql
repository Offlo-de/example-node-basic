CREATE TABLE IF NOT EXISTS requests (
  id UUID PRIMARY KEY,
  message TEXT NOT NULL,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  arrived_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS daily_request_counts (
  day DATE PRIMARY KEY,
  request_count BIGINT NOT NULL,
  calculated_at TIMESTAMPTZ NOT NULL
);

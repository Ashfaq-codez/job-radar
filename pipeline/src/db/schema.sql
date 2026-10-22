CREATE TABLE IF NOT EXISTS jobs (
  id            text PRIMARY KEY,          -- "greenhouse:stripe:12345"
  source        text NOT NULL,
  company       text NOT NULL,
  title         text NOT NULL,
  location      text NOT NULL,
  is_remote     boolean NOT NULL DEFAULT false,
  url           text NOT NULL,
  posted_at     timestamptz,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_first_seen_at_idx ON jobs (first_seen_at DESC);

-- Phase 4: descriptions + scoring
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fit_score   integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS fit_reasons text;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scored_at   timestamptz;
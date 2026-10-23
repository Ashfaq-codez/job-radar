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

-- Dashboard: application tracking
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'new'
  CHECK (status IN ('new', 'applied', 'interviewing', 'offer', 'rejected', 'hidden'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

-- Role classification (filled by the pipeline)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS category   text;  -- 'developer' | 'other'
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS employment text;  -- 'internship' | 'full_time'
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS seniority  text;  -- 'entry' | 'senior'
CREATE INDEX IF NOT EXISTS jobs_category_idx ON jobs (category, seniority);
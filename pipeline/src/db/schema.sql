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
-- Formatted description for the dashboard (sanitized HTML from the source)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS description_html text NOT NULL DEFAULT '';

-- Dashboard triage: a "saved" shortlist and free-text notes per application
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS jobs_status_check;
ALTER TABLE jobs ADD CONSTRAINT jobs_status_check
  CHECK (status IN ('new', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'hidden'));
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notes text NOT NULL DEFAULT '';

-- Job boards to fetch: found by discovery, or added from the dashboard
CREATE TABLE IF NOT EXISTS companies (
  source          text NOT NULL,             -- 'greenhouse' | 'lever' | 'ashby' | 'workday' | 'careers'
  slug            text NOT NULL,             -- board name in the API URL (careers: the page URL)
  india_jobs      integer NOT NULL DEFAULT 0,
  total_jobs      integer NOT NULL DEFAULT 0,
  last_checked_at timestamptz,
  check_error     text,
  PRIMARY KEY (source, slug)
);

-- Companies added from the dashboard ("Add company"). source may now also be 'careers'
-- (slug = the careers page URL) or 'workday' (slug = "{tenant}.wd{N}/{site}").
ALTER TABLE companies ADD COLUMN IF NOT EXISTS name        text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS careers_url text;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS added_by    text NOT NULL DEFAULT 'discovery';
ALTER TABLE companies ADD COLUMN IF NOT EXISTS added_at    timestamptz;

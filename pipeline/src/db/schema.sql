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

-- Discord notifications: when a job was sent, so it's never sent twice
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS notified_at timestamptz;
CREATE INDEX IF NOT EXISTS jobs_notify_idx ON jobs (fit_score DESC) WHERE notified_at IS NULL;

-- Experience asked for in the description ("0-2 years" → 0); NULL when it doesn't say
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS min_years       integer;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS experience_text text;

-- When "Apply on company site" was clicked, so the dashboard can ask "Did you apply?"
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS opened_at timestamptz;

-- ═══════════════════════════════════════════════════════════════════════════
-- Multi-user (branch multi-user). Run this whole block once, top to bottom.
-- ═══════════════════════════════════════════════════════════════════════════

-- Better Auth core tables (user, session, account, verification), from its
-- built-in schema for Postgres. Column names are camelCase, so they're quoted.
CREATE TABLE IF NOT EXISTS "user" (
  "id"            text PRIMARY KEY,
  "name"          text NOT NULL,
  "email"         text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL,
  "image"         text,
  "createdAt"     timestamptz NOT NULL DEFAULT now(),
  "updatedAt"     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "session" (
  "id"        text PRIMARY KEY,
  "expiresAt" timestamptz NOT NULL,
  "token"     text NOT NULL UNIQUE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId"    text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS session_user_id_idx ON "session" ("userId");

CREATE TABLE IF NOT EXISTS "account" (
  "id"                    text PRIMARY KEY,
  "accountId"             text NOT NULL,
  "providerId"            text NOT NULL,
  "userId"                text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  "accessToken"           text,
  "refreshToken"          text,
  "idToken"               text,
  "accessTokenExpiresAt"  timestamptz,
  "refreshTokenExpiresAt" timestamptz,
  "scope"                 text,
  "password"              text,
  "createdAt"             timestamptz NOT NULL DEFAULT now(),
  "updatedAt"             timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS account_user_id_idx ON "account" ("userId");

CREATE TABLE IF NOT EXISTS "verification" (
  "id"         text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value"      text NOT NULL,
  "expiresAt"  timestamptz NOT NULL,
  "createdAt"  timestamptz NOT NULL DEFAULT now(),
  "updatedAt"  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS verification_identifier_idx ON "verification" ("identifier");

-- Invite-only: only these emails (plus OWNER_EMAIL) can sign in. Stored lowercase.
CREATE TABLE IF NOT EXISTS invites (
  email      text PRIMARY KEY CHECK (email = lower(email)),
  invited_at timestamptz NOT NULL DEFAULT now(),
  invited_by text
);

-- One row per person: resume text + what they're looking for
CREATE TABLE IF NOT EXISTS profiles (
  user_id             text PRIMARY KEY REFERENCES "user" ("id") ON DELETE CASCADE,
  resume_text         text,
  resume_updated_at   timestamptz,
  role_families       text[] NOT NULL DEFAULT '{}',
  extra_titles        text[] NOT NULL DEFAULT '{}',
  experience_level    text,           -- 'fresher' | 'lt1' | '1-2' | '2-3' | '3plus'
  max_min_years       integer NOT NULL DEFAULT 1,
  job_types           text[] NOT NULL DEFAULT '{internship,full_time}',
  locations           text[] NOT NULL DEFAULT '{}',
  open_to_relocate    boolean NOT NULL DEFAULT false,
  work_modes          text[] NOT NULL DEFAULT '{}',
  skills              text[] NOT NULL DEFAULT '{}',
  avoid_keywords      text[] NOT NULL DEFAULT '{}',
  avoid_companies     text[] NOT NULL DEFAULT '{}',
  company_types       text[] NOT NULL DEFAULT '{}',
  grad_year           integer,
  notice_period       text,
  min_salary_lpa      numeric,
  discord_webhook_url text,
  min_notify_score    integer NOT NULL DEFAULT 70,
  ai_consent_at       timestamptz,
  onboarded_at        timestamptz,
  updated_at          timestamptz NOT NULL DEFAULT now()
);

-- Per-person view of a shared job: match, AI score, and application tracking.
-- (These used to be columns on jobs; the old ones stay until the migration is verified.)
CREATE TABLE IF NOT EXISTS user_jobs (
  user_id           text NOT NULL REFERENCES "user" ("id") ON DELETE CASCADE,
  job_id            text NOT NULL REFERENCES jobs (id) ON DELETE CASCADE,
  matched           boolean NOT NULL DEFAULT true,  -- fits the person's current profile
  fit_score         integer,
  fit_reasons       text,
  scored_at         timestamptz,
  status            text NOT NULL DEFAULT 'new'
    CHECK (status IN ('new', 'saved', 'applied', 'interviewing', 'offer', 'rejected', 'hidden')),
  status_changed_at timestamptz,
  opened_at         timestamptz,
  notified_at       timestamptz,
  notes             text NOT NULL DEFAULT '',
  created_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, job_id)
);
CREATE INDEX IF NOT EXISTS user_jobs_review_idx  ON user_jobs (user_id, status, fit_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS user_jobs_unscored_idx ON user_jobs (user_id) WHERE scored_at IS NULL AND matched;
CREATE INDEX IF NOT EXISTS user_jobs_notify_idx  ON user_jobs (user_id, fit_score DESC) WHERE notified_at IS NULL;
CREATE INDEX IF NOT EXISTS user_jobs_opened_idx  ON user_jobs (user_id, opened_at DESC) WHERE opened_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS user_jobs_job_idx     ON user_jobs (job_id);

-- Shared job labels: which role family a title belongs to
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS role_family text;
CREATE INDEX IF NOT EXISTS jobs_open_family_idx ON jobs (last_seen_at DESC, role_family);

-- Companies stay shared; remember which person added one from the dashboard
ALTER TABLE companies ADD COLUMN IF NOT EXISTS added_by_user text REFERENCES "user" ("id") ON DELETE SET NULL;

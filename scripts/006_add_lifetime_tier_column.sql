-- Add lifetime tier tracking directly on the users table
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS lifetime_tier TEXT
  CHECK (lifetime_tier IN ('early', 'mid', 'final'));

-- Helpful index for counting / filtering lifetime customers
CREATE INDEX IF NOT EXISTS idx_users_lifetime_tier
  ON public.users(lifetime_tier)
  WHERE lifetime_tier IS NOT NULL;

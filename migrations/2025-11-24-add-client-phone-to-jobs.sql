-- Migration: add client_phone column to jobs
-- Adds a nullable text column for storing client phone numbers

ALTER TABLE IF EXISTS public.jobs
  ADD COLUMN IF NOT EXISTS client_phone text;

-- Optionally create an index if lookups by phone are needed
-- CREATE INDEX IF NOT EXISTS idx_jobs_client_phone ON public.jobs (client_phone);

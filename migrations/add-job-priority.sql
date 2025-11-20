-- Migration: add `priority` column to jobs
-- Values: 'normal', 'repede', 'urgent'
-- Idempotent: safe to run multiple times

BEGIN;

DO $$
BEGIN
  -- Add the column if missing
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'jobs' AND column_name = 'priority'
  ) THEN
    ALTER TABLE public.jobs ADD COLUMN priority text NOT NULL DEFAULT 'normal';
  END IF;

  -- Add a check constraint for allowed values if not present
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.contype = 'c' AND n.nspname = 'public' AND t.relname = 'jobs' AND c.conname = 'jobs_priority_check'
  ) THEN
    ALTER TABLE public.jobs ADD CONSTRAINT jobs_priority_check CHECK (priority IN ('normal','repede','urgent'));
  END IF;
END$$;

COMMIT;

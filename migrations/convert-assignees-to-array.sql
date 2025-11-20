
BEGIN;

-- Convert `assigned_to` to a proper uuid[] column in a safe, idempotent way.
-- Steps:
-- 1) Create a temporary/new array column `assigned_to_new` (uuid[])
-- 2) Populate it from the existing `assigned_to` whether that column is a scalar uuid or already an array
-- 3) Drop the old scalar `assigned_to` and rename the new column to `assigned_to`
-- 4) Ensure `assigned_to_emails` exists and populate it from `assigned_to_email` or from `profiles`
-- 5) Create a GIN index on the text-cast of the array for Supabase compatibility

-- 1) Create staging column
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to_new uuid[];

-- 2) Populate assigned_to_new safely from existing assigned_to values
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='assigned_to'
  ) THEN
    UPDATE public.tasks
    SET assigned_to_new = (
      CASE
        WHEN assigned_to IS NULL THEN NULL
        WHEN pg_typeof(assigned_to)::text LIKE '%[]' THEN assigned_to
        ELSE ARRAY[assigned_to]::uuid[]
      END
    )
    WHERE assigned_to IS NOT NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'populate assigned_to_new error: %', SQLERRM;
END$$;

-- 3) Replace old assigned_to with the new array column
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='assigned_to_new'
  ) THEN
    -- If there is an existing assigned_to column (any type), drop it first
    IF EXISTS (
      SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='assigned_to'
    ) THEN
      ALTER TABLE public.tasks DROP COLUMN assigned_to;
    END IF;
    -- Rename new column into place
    ALTER TABLE public.tasks RENAME COLUMN assigned_to_new TO assigned_to;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'replace assigned_to error: %', SQLERRM;
END$$;

-- 4) Ensure assigned_to_emails exists and populate
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to_emails text[];

DO $$
BEGIN
  -- If legacy assigned_to_email scalar exists, mirror it into assigned_to_emails
  IF EXISTS (
    SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='tasks' AND column_name='assigned_to_email'
  ) THEN
    UPDATE public.tasks
    SET assigned_to_emails = CASE WHEN assigned_to_email IS NOT NULL THEN ARRAY[assigned_to_email]::text[] ELSE NULL END
    WHERE assigned_to_email IS NOT NULL;
  END IF;

  -- For rows with assigned_to (uuid[]) but no assigned_to_emails, populate from profiles
  UPDATE public.tasks t
  SET assigned_to_emails = sub.emails
  FROM (
    SELECT t2.id, ARRAY_AGG(p.email) AS emails
    FROM public.tasks t2
    JOIN public.profiles p ON p.id = ANY(t2.assigned_to)
    GROUP BY t2.id
  ) AS sub
  WHERE t.id = sub.id AND (t.assigned_to_emails IS NULL OR array_length(t.assigned_to_emails,1) = 0);
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'populate assigned_to_emails error: %', SQLERRM;
END$$;

-- 5) Create GIN index on text-cast of assigned_to (works on Supabase)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_gin ON public.tasks USING GIN ((assigned_to::text[]));

COMMIT;

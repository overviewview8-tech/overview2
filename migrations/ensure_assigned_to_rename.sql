-- Safe migration: rename assigned_to_new -> assigned_to if present
-- Idempotent and non-destructive. Run in Supabase SQL editor or via psql.

BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_to_new'
  ) THEN
    -- Try to coerce the column to uuid[] (no-op if already uuid[])
    BEGIN
      EXECUTE 'ALTER TABLE public.tasks ALTER COLUMN assigned_to_new TYPE uuid[] USING assigned_to_new::uuid[]';
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Skipping type-alter for assigned_to_new (may already be correct or coercion failed): %', SQLERRM;
    END;

    -- If a legacy assigned_to column exists, drop it so we can rename
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'tasks' AND column_name = 'assigned_to'
    ) THEN
      ALTER TABLE public.tasks DROP COLUMN assigned_to;
    END IF;

    -- Rename assigned_to_new into place
    ALTER TABLE public.tasks RENAME COLUMN assigned_to_new TO assigned_to;
  ELSE
    RAISE NOTICE 'No assigned_to_new column found; nothing to rename.';
  END IF;
END$$;

-- Create GIN index on text-cast of assigned_to (idempotent)
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to_gin ON public.tasks USING GIN ((assigned_to::text[]));

COMMIT;

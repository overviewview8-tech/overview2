-- Ensure tasks.created_by exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'created_by'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN created_by uuid;
  END IF;
END
$$;

-- Note: After running this migration in Supabase, restart the project's API (Settings -> Restart) so PostgREST refreshes its schema cache.

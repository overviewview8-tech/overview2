-- 2025-11-21-sync-creator_id-with-created_by.sql
-- Scop: sincronizează valorile din `created_by` în `creator_id` pentru rândurile existente
-- și adaugă un trigger care completează `creator_id` la INSERT atunci când lipsește.
-- Rulează acest fișier în Supabase -> SQL editor.

BEGIN;

-- 1) COPY existing values where possible
UPDATE tasks
SET creator_id = created_by
WHERE creator_id IS NULL
  AND created_by IS NOT NULL;

-- 2) OPTIONAL: if you want to set a fallback for rows where both are NULL,
-- uncomment and replace the UUID below (example uses an admin id from your export):
-- UPDATE tasks SET creator_id = 'a5948c36-3aca-4a60-ae7b-5d533bee339d' WHERE creator_id IS NULL;

-- 3) Create function which sets creator_id automatically on INSERT if missing.
-- It uses, in order of preference: NEW.created_by -> auth.uid() (current user JWT) -> leaves NULL.
CREATE OR REPLACE FUNCTION public.tasks_set_creator_id()
RETURNS trigger AS $$
BEGIN
  IF NEW.creator_id IS NULL THEN
    IF NEW.created_by IS NOT NULL THEN
      NEW.creator_id := NEW.created_by;
    ELSE
      -- auth.uid() returns the authenticated user's id in Supabase (or NULL if anon)
      BEGIN
        NEW.creator_id := auth.uid()::uuid;
      EXCEPTION WHEN others THEN
        -- if casting/auth fails, leave as NULL so caller can handle or a later migration can set a fallback
        NEW.creator_id := NULL;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4) Create trigger if not exists (idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE t.tgname = 'tasks_set_creator_id_trigger' AND c.relname = 'tasks'
  ) THEN
    CREATE TRIGGER tasks_set_creator_id_trigger
    BEFORE INSERT ON tasks
    FOR EACH ROW
    EXECUTE FUNCTION public.tasks_set_creator_id();
  END IF;
END;
$$;

COMMIT;

-- 5) Verification query (run separately to inspect results):
-- SELECT id, created_by, creator_id FROM tasks WHERE creator_id IS NULL OR created_by IS NULL LIMIT 200;

-- Important notes:
-- - This trigger will set `creator_id` to `created_by` when the INSERT payload contains `created_by`.
-- - If `created_by` is not provided, the trigger attempts to use `auth.uid()` (the id from JWT).
-- - If inserts are made via the anon/public key (no JWT), `auth.uid()` will be NULL — these inserts will still fail the NOT NULL constraint unless the insert supplies `creator_id` or you set a fallback for existing rows.
-- - If you need anonymous inserts to succeed, either:
--    * allow `creator_id` to be NULL (drop NOT NULL constraint temporarily), or
--    * set a default/fallback UUID for `creator_id` (e.g., a dedicated system account), or
--    * ensure inserts are done with a service role key that sets a valid `creator_id`.

-- If you want, I can add a second migration to set a fallback for any remaining NULL `creator_id` rows.

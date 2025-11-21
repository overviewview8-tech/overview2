-- Add reception_number sequence, column and trigger to assign it when a job is completed

-- Create sequence if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind = 'S' AND relname = 'reception_number_seq') THEN
    CREATE SEQUENCE reception_number_seq START 1;
  END IF;
END$$;

-- Add column to jobs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'reception_number') THEN
    ALTER TABLE jobs ADD COLUMN reception_number bigint;
  END IF;
END$$;

-- Create function to assign reception number on insert/update when status becomes 'completed'
CREATE OR REPLACE FUNCTION public.assign_reception_number()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- On insert or update, if status is 'completed' and reception_number is null, assign nextval
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    IF (NEW.status = 'completed') AND (OLD IS NULL OR OLD.status IS DISTINCT FROM 'completed') THEN
      IF NEW.reception_number IS NULL THEN
        NEW.reception_number := nextval('reception_number_seq');
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Create the trigger (if not exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_assign_reception_number'
  ) THEN
    CREATE TRIGGER trigger_assign_reception_number
    BEFORE INSERT OR UPDATE ON jobs
    FOR EACH ROW
    EXECUTE FUNCTION public.assign_reception_number();
  END IF;
END$$;

-- Optional: add a unique constraint to reception_number to avoid duplicates
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes WHERE tablename = 'jobs' AND indexname = 'jobs_reception_number_idx'
  ) THEN
    CREATE UNIQUE INDEX jobs_reception_number_idx ON jobs(reception_number);
  END IF;
END$$;

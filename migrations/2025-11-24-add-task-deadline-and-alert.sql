-- Migration: add deadline and alert flag to tasks
-- Adds a nullable timestamp with timezone for task deadlines and
-- a boolean flag to indicate whether a deadline-alert email has been sent.

ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS deadline timestamptz;

ALTER TABLE IF EXISTS public.tasks
  ADD COLUMN IF NOT EXISTS deadline_alert_sent boolean DEFAULT false;

-- Optional index to efficiently find overdue tasks
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON public.tasks (deadline);

-- Notes:
-- After running this migration, run the deadline-check script or schedule it (cron/hosted job) to notify on missed deadlines.

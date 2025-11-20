-- Create a join table to allow assigning tasks to multiple profiles
-- Run this in your Postgres / Supabase SQL editor

CREATE TABLE IF NOT EXISTS public.task_assignments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Add an index for faster lookups
CREATE INDEX IF NOT EXISTS idx_task_assignments_task_id ON public.task_assignments(task_id);
CREATE INDEX IF NOT EXISTS idx_task_assignments_profile_id ON public.task_assignments(profile_id);

-- Add client detail columns to jobs table if they don't exist
-- Run this in your Postgres / Supabase SQL editor
ALTER TABLE public.jobs
  ADD COLUMN IF NOT EXISTS client_first_name text,
  ADD COLUMN IF NOT EXISTS client_last_name text,
  ADD COLUMN IF NOT EXISTS client_id_series text,
  ADD COLUMN IF NOT EXISTS client_cnp varchar(64),
  ADD COLUMN IF NOT EXISTS client_address text,
  ADD COLUMN IF NOT EXISTS description text;

-- Optionally populate client_first_name/client_last_name from existing client_name
-- (splits on first space; adjust logic as needed):
-- UPDATE public.jobs SET client_first_name = split_part(client_name, ' ', 1), client_last_name = trim(substring(client_name from length(split_part(client_name, ' ', 1)) + 2));

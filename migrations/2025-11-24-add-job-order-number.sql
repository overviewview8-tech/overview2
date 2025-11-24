-- Migration: add job order sequence and assign function
BEGIN;

-- Sequence for job-order numbers
CREATE SEQUENCE IF NOT EXISTS job_order_seq START 1;

-- Add column to jobs table (nullable)
ALTER TABLE IF EXISTS jobs ADD COLUMN IF NOT EXISTS order_number bigint;

-- Create a function to atomically get next order and assign to job
CREATE OR REPLACE FUNCTION public.assign_job_order(p_job_id uuid)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  v bigint;
BEGIN
  v := nextval('job_order_seq');
  UPDATE jobs SET order_number = v WHERE id = p_job_id;
  RETURN v;
END;
$$;

COMMIT;

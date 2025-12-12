-- Add amount_paid column to jobs table
-- This tracks how much money has been collected for each job

ALTER TABLE jobs 
ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(10, 2) DEFAULT 0;

COMMENT ON COLUMN jobs.amount_paid IS 'Amount of money collected/received for this job in RON';

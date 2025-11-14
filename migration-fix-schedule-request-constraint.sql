-- Fix the unique constraint for match_schedule_requests
-- The current constraint prevents multiple approved requests for the same match
-- We should only prevent multiple PENDING requests for the same match

-- Drop the current unique constraint
ALTER TABLE public.match_schedule_requests 
DROP CONSTRAINT IF EXISTS match_schedule_requests_match_id_status_key;

-- Create a partial unique index that only applies to pending status
-- This allows multiple approved/rejected/superseded requests but only one pending
CREATE UNIQUE INDEX CONCURRENTLY idx_match_schedule_requests_pending_unique 
ON public.match_schedule_requests(match_id) 
WHERE status = 'pending';

-- Also ensure we have a general index on match_id and status for performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_match_schedule_requests_match_status 
ON public.match_schedule_requests(match_id, status);

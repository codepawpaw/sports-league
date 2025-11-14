-- Migration: Fix player registration requests to allow multiple requests per email when previous ones are rejected
-- This migration removes the unique constraint on (league_id, claimer_email) that prevents users
-- from submitting new registration requests after previous ones were rejected.

-- The business logic should allow:
-- 1. A user can submit multiple requests to the same league IF previous requests were rejected
-- 2. A user can only have ONE pending or approved request per league at a time (enforced by API logic)
-- 3. A player can only have ONE pending or approved request at a time (enforced by API logic)

-- Step 1: Drop the problematic unique constraint
ALTER TABLE public.player_registration_requests 
DROP CONSTRAINT IF EXISTS player_registration_requests_league_id_claimer_email_key;

-- Step 2: Create a partial unique index that only enforces uniqueness for pending/approved requests
-- This ensures a user can only have one active (pending/approved) request per league
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_registration_per_email_league 
ON public.player_registration_requests(league_id, claimer_email) 
WHERE status IN ('pending', 'approved');

-- Step 3: Update the existing unique constraint for player_id to also be partial
-- Drop the existing constraint first
ALTER TABLE public.player_registration_requests 
DROP CONSTRAINT IF EXISTS player_registration_requests_league_id_player_id_key;

-- Create a partial unique index for player_id as well
-- This ensures a player can only have one active (pending/approved) request per league
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_registration_per_player_league 
ON public.player_registration_requests(league_id, player_id) 
WHERE status IN ('pending', 'approved');

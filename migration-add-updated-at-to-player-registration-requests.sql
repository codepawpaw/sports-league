-- Migration: Add updated_at column to player_registration_requests table
-- Run this script to fix the missing updated_at column that's causing the reject operation to fail

-- Add the missing updated_at column
ALTER TABLE public.player_registration_requests 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone default timezone('utc'::text, now()) not null;

-- Update existing records to have the correct updated_at value
UPDATE public.player_registration_requests 
SET updated_at = created_at 
WHERE updated_at IS NULL;

-- Verify the trigger exists (it should already exist from the schema)
-- If not, create it:
-- CREATE TRIGGER update_player_registration_requests_updated_at 
-- BEFORE UPDATE ON public.player_registration_requests
-- FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

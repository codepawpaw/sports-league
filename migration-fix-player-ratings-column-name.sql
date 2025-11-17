-- Fix column name mismatch in player_ratings table
-- Change last_updated_at to updated_at to match the trigger function

-- Rename the column to match the existing trigger function
alter table public.player_ratings rename column last_updated_at to updated_at;

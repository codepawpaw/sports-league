-- Fix RLS policy to allow participants to update match scheduling
-- This allows match participants to update the scheduled_at field when approving schedule requests

-- Drop existing restrictive policy if it conflicts
DROP POLICY IF EXISTS "League admins can manage matches" ON public.matches;

-- Create a comprehensive policy that allows both admins and participants to update matches
CREATE POLICY "League management and participant scheduling" ON public.matches FOR update USING (
  -- League admins can update everything
  exists (
    select 1 from public.league_admins 
    where league_id = matches.league_id 
    and email = auth.jwt() ->> 'email'
  )
  OR
  -- Match participants can update for scheduling purposes
  exists (
    select 1 from public.participants p
    where (p.id = matches.player1_id or p.id = matches.player2_id)
    and p.email = auth.jwt() ->> 'email'
  )
) WITH CHECK (
  -- Same conditions for insert/update checks
  exists (
    select 1 from public.league_admins 
    where league_id = matches.league_id 
    and email = auth.jwt() ->> 'email'
  )
  OR
  exists (
    select 1 from public.participants p
    where (p.id = matches.player1_id or p.id = matches.player2_id)
    and p.email = auth.jwt() ->> 'email'
  )
);

-- Also need to recreate the insert and delete policies for league admins
CREATE POLICY "League admins can insert matches" ON public.matches FOR insert WITH CHECK (
  exists (
    select 1 from public.league_admins 
    where league_id = matches.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

CREATE POLICY "League admins can delete matches" ON public.matches FOR delete USING (
  exists (
    select 1 from public.league_admins 
    where league_id = matches.league_id 
    and email = auth.jwt() ->> 'email'
  )
);

-- Grant execute permission on the stored procedure to all authenticated users
-- This is needed for the handle_schedule_approval function to work
GRANT EXECUTE ON FUNCTION public.handle_schedule_approval(UUID, UUID, TIMESTAMP WITH TIME ZONE) TO authenticated;

-- Also grant usage on the public schema if needed
GRANT USAGE ON SCHEMA public TO authenticated;

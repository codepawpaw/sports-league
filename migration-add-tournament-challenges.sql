-- Migration: Add Tournament Challenges System
-- This migration adds the tournament_challenges table to support exhibition tournament challenges

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create tournament_challenges table
CREATE TABLE public.tournament_challenges (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  challenger_participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  challenged_participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  message text,
  status varchar(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  responded_at timestamp with time zone,
  UNIQUE(tournament_id, challenger_participant_id, challenged_participant_id, status) -- Prevent duplicate pending challenges
);

-- Step 2: Create indexes for performance
CREATE INDEX idx_tournament_challenges_tournament_id ON public.tournament_challenges(tournament_id);
CREATE INDEX idx_tournament_challenges_challenger ON public.tournament_challenges(challenger_participant_id);
CREATE INDEX idx_tournament_challenges_challenged ON public.tournament_challenges(challenged_participant_id);
CREATE INDEX idx_tournament_challenges_status ON public.tournament_challenges(status);
CREATE INDEX idx_tournament_challenges_created_at ON public.tournament_challenges(created_at);

-- Step 3: Enable Row Level Security
ALTER TABLE public.tournament_challenges ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for tournament challenges
-- Users can view challenges they are involved in
CREATE POLICY "Users can view their tournament challenges" ON public.tournament_challenges FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.email = auth.jwt() ->> 'email'
    AND (
      p.id = tournament_challenges.challenger_participant_id OR 
      p.id = tournament_challenges.challenged_participant_id
    )
  )
);

-- Users can create challenges if they are tournament participants
CREATE POLICY "Tournament participants can create challenges" ON public.tournament_challenges FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.participants p
    JOIN public.tournament_participants tp ON tp.participant_id = p.id
    WHERE p.email = auth.jwt() ->> 'email'
    AND p.id = tournament_challenges.challenger_participant_id
    AND tp.tournament_id = tournament_challenges.tournament_id
  )
);

-- Users can update challenges they received (to accept/reject)
CREATE POLICY "Users can respond to challenges sent to them" ON public.tournament_challenges FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.email = auth.jwt() ->> 'email'
    AND p.id = tournament_challenges.challenged_participant_id
  )
);

-- Users can delete challenges they sent (if still pending)
CREATE POLICY "Users can delete their pending challenges" ON public.tournament_challenges FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.participants p
    WHERE p.email = auth.jwt() ->> 'email'
    AND p.id = tournament_challenges.challenger_participant_id
    AND tournament_challenges.status = 'pending'
  )
);

-- League admins can manage all tournament challenges
CREATE POLICY "League admins can manage tournament challenges" ON public.tournament_challenges FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.league_admins la
    JOIN public.tournaments t ON t.id = tournament_challenges.tournament_id
    WHERE la.league_id = t.league_id 
    AND la.email = auth.jwt() ->> 'email'
  )
);

-- Step 5: Add constraint to prevent self-challenges
ALTER TABLE public.tournament_challenges ADD CONSTRAINT no_self_challenge 
CHECK (challenger_participant_id != challenged_participant_id);

-- Step 6: Add constraint to ensure both participants are in the tournament
-- Note: This will be enforced at the application level for better performance

-- Step 7: Add comments for documentation
COMMENT ON TABLE public.tournament_challenges IS 'Stores challenge requests between tournament participants in exhibition tournaments';
COMMENT ON COLUMN public.tournament_challenges.tournament_id IS 'References the tournament where the challenge is made';
COMMENT ON COLUMN public.tournament_challenges.challenger_participant_id IS 'The participant who sent the challenge';
COMMENT ON COLUMN public.tournament_challenges.challenged_participant_id IS 'The participant who received the challenge';
COMMENT ON COLUMN public.tournament_challenges.message IS 'Optional message included with the challenge';
COMMENT ON COLUMN public.tournament_challenges.status IS 'Current status: pending, accepted, rejected, cancelled';
COMMENT ON COLUMN public.tournament_challenges.created_at IS 'When the challenge was created';
COMMENT ON COLUMN public.tournament_challenges.responded_at IS 'When the challenge was accepted or rejected';

COMMIT;

-- Verification queries (run these after migration):
-- SELECT * FROM public.tournament_challenges;
-- SELECT count(*) FROM public.tournament_challenges WHERE status = 'pending';

-- Migration: Decouple participants from seasons
-- This migration creates a many-to-many relationship between participants and seasons

-- Step 1: Create the season_participants junction table
CREATE TABLE public.season_participants (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  season_id uuid REFERENCES public.seasons(id) ON DELETE CASCADE NOT NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(season_id, participant_id)
);

-- Step 2: Create indexes for performance
CREATE INDEX idx_season_participants_season_id ON public.season_participants(season_id);
CREATE INDEX idx_season_participants_participant_id ON public.season_participants(participant_id);
CREATE INDEX idx_season_participants_joined_at ON public.season_participants(joined_at);

-- Step 3: Enable RLS for season_participants
ALTER TABLE public.season_participants ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies for season_participants
CREATE POLICY "Anyone can view season participants" ON public.season_participants FOR SELECT USING (true);
CREATE POLICY "League admins can manage season participants" ON public.season_participants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.league_admins la
    JOIN public.seasons s ON s.id = season_participants.season_id
    WHERE la.league_id = s.league_id 
    AND la.email = auth.jwt() ->> 'email'
  )
);

-- Step 5: Migrate existing data from participants.season_id to season_participants table
INSERT INTO public.season_participants (season_id, participant_id, joined_at)
SELECT 
  p.season_id,
  p.id,
  p.created_at
FROM public.participants p
WHERE p.season_id IS NOT NULL;

-- Step 6: Remove the season_id foreign key constraint from participants table
ALTER TABLE public.participants DROP CONSTRAINT IF EXISTS participants_season_id_fkey;

-- Step 7: Remove the season_id column from participants table
ALTER TABLE public.participants DROP COLUMN season_id;

-- Step 8: Update matches table to use season_participants for validation if needed
-- Note: matches already have direct season_id, so no changes needed there

-- Verification queries (run these after migration to verify):
-- SELECT COUNT(*) FROM season_participants; -- Should match previous participant count
-- SELECT s.name, COUNT(sp.*) as participant_count 
-- FROM seasons s 
-- LEFT JOIN season_participants sp ON s.id = sp.season_id 
-- GROUP BY s.id, s.name 
-- ORDER BY s.created_at;

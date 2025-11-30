-- Migration: Add Tournament System
-- This migration introduces a tournament-based system alongside the existing season system

-- Enable UUID extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Step 1: Create tournaments table
CREATE TABLE public.tournaments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
  name varchar(255) NOT NULL,
  slug varchar(255) NOT NULL,
  description text,
  tournament_type varchar(50) NOT NULL CHECK (tournament_type IN ('round_robin', 'table_system', 'exhibition', 'single_elimination', 'double_elimination')),
  status varchar(20) DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  start_date timestamp with time zone,
  end_date timestamp with time zone,
  max_participants integer,
  auto_generate_matches boolean DEFAULT false,
  settings jsonb DEFAULT '{}', -- Store tournament-specific settings
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(league_id, slug)
);

-- Step 2: Create tournament participants junction table
CREATE TABLE public.tournament_participants (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  seed_position integer, -- For seeded tournaments
  UNIQUE(tournament_id, participant_id)
);

-- Step 3: Add tournament_id to matches table and make season_id optional
ALTER TABLE public.matches ADD COLUMN tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE;
ALTER TABLE public.matches ALTER COLUMN season_id DROP NOT NULL;

-- Step 4: Add constraint to ensure match belongs to either season OR tournament
ALTER TABLE public.matches ADD CONSTRAINT match_belongs_to_season_or_tournament 
CHECK (
  (season_id IS NOT NULL AND tournament_id IS NULL) OR 
  (season_id IS NULL AND tournament_id IS NOT NULL)
);

-- Step 5: Create indexes for performance
CREATE INDEX idx_tournaments_league_id ON public.tournaments(league_id);
CREATE INDEX idx_tournaments_status ON public.tournaments(status);
CREATE INDEX idx_tournaments_type ON public.tournaments(tournament_type);
CREATE INDEX idx_tournaments_slug ON public.tournaments(league_id, slug);

CREATE INDEX idx_tournament_participants_tournament_id ON public.tournament_participants(tournament_id);
CREATE INDEX idx_tournament_participants_participant_id ON public.tournament_participants(participant_id);
CREATE INDEX idx_tournament_participants_joined_at ON public.tournament_participants(joined_at);

CREATE INDEX idx_matches_tournament_id ON public.matches(tournament_id);

-- Step 6: Create trigger for tournaments updated_at
CREATE TRIGGER update_tournaments_updated_at 
BEFORE UPDATE ON public.tournaments
FOR EACH ROW 
EXECUTE FUNCTION public.update_updated_at_column();

-- Step 7: Enable Row Level Security
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

-- Step 8: Create RLS policies for tournaments
CREATE POLICY "Anyone can view tournaments" ON public.tournaments FOR SELECT USING (true);
CREATE POLICY "League admins can manage tournaments" ON public.tournaments FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.league_admins 
    WHERE league_id = tournaments.league_id 
    AND email = auth.jwt() ->> 'email'
  )
);

-- Step 9: Create RLS policies for tournament participants
CREATE POLICY "Anyone can view tournament participants" ON public.tournament_participants FOR SELECT USING (true);
CREATE POLICY "League admins can manage tournament participants" ON public.tournament_participants FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.league_admins la
    JOIN public.tournaments t ON t.id = tournament_participants.tournament_id
    WHERE la.league_id = t.league_id 
    AND la.email = auth.jwt() ->> 'email'
  )
);

-- Step 10: Update existing matches policy to include tournament matches
DROP POLICY IF EXISTS "League admins can manage matches" ON public.matches;
CREATE POLICY "League admins can manage matches" ON public.matches FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.league_admins la
    WHERE (
      -- Season-based match
      (matches.season_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.seasons s 
        WHERE s.id = matches.season_id 
        AND la.league_id = s.league_id 
        AND la.email = auth.jwt() ->> 'email'
      )) 
      OR 
      -- Tournament-based match
      (matches.tournament_id IS NOT NULL AND EXISTS (
        SELECT 1 FROM public.tournaments t 
        WHERE t.id = matches.tournament_id 
        AND la.league_id = t.league_id 
        AND la.email = auth.jwt() ->> 'email'
      ))
    )
  )
);

-- Step 11: Migrate existing active seasons to tournaments (optional)
-- This creates a tournament for each active season
INSERT INTO public.tournaments (league_id, name, slug, description, tournament_type, status, start_date, settings)
SELECT 
  s.league_id,
  s.name || ' (Migrated Season)',
  s.slug || '-tournament',
  s.description || ' - Migrated from season system',
  'exhibition', -- Default to exhibition type
  CASE 
    WHEN s.is_active THEN 'active'
    WHEN s.is_finished THEN 'completed'
    ELSE 'upcoming'
  END,
  s.start_date,
  jsonb_build_object(
    'migrated_from_season', true,
    'original_season_id', s.id
  )
FROM public.seasons s;

-- Step 12: Migrate season participants to tournament participants
INSERT INTO public.tournament_participants (tournament_id, participant_id, joined_at)
SELECT 
  t.id as tournament_id,
  sp.participant_id,
  sp.joined_at
FROM public.tournament_participants tp_check
RIGHT JOIN public.tournaments t ON t.settings->>'migrated_from_season' = 'true'
RIGHT JOIN public.seasons s ON s.id = (t.settings->>'original_season_id')::uuid
JOIN public.season_participants sp ON sp.season_id = s.id
WHERE tp_check.id IS NULL; -- Avoid duplicates

-- Step 13: Create some example tournament settings templates
COMMENT ON COLUMN public.tournaments.settings IS 'JSONB field for tournament-specific settings. Examples:
- Round Robin: {"points_per_win": 3, "points_per_draw": 1, "points_per_loss": 0}
- Table System: {"promotion_spots": 2, "relegation_spots": 1, "track_goal_difference": true}
- Exhibition: {"allow_flexible_scheduling": true, "track_rankings": false}';

-- Verification queries (uncomment to run after migration):
-- SELECT 'Tournaments created:' as info, COUNT(*) as count FROM tournaments;
-- SELECT 'Tournament participants:' as info, COUNT(*) as count FROM tournament_participants;
-- SELECT 'Matches with season_id:' as info, COUNT(*) as count FROM matches WHERE season_id IS NOT NULL;
-- SELECT 'Matches with tournament_id:' as info, COUNT(*) as count FROM matches WHERE tournament_id IS NOT NULL;

-- Migration Script: Allow Season Matches to be Coupled to Tournaments
-- This script provides several approaches to migrate existing season-only matches

-- =============================================================================
-- APPROACH 1: CREATE TOURNAMENTS FOR ALL SEASONS (RECOMMENDED)
-- =============================================================================

-- Step 1: Create tournaments for existing seasons that don't have tournaments yet
INSERT INTO public.tournaments (
    league_id, 
    name, 
    slug, 
    description, 
    tournament_type, 
    status, 
    start_date, 
    end_date,
    auto_generate_matches,
    settings
)
SELECT 
    s.league_id,
    s.name || ' Tournament',
    s.slug || '-tournament',
    'Migrated from season: ' || s.name,
    'round_robin'::varchar,
    CASE 
        WHEN s.is_active THEN 'active'::varchar
        WHEN s.is_finished THEN 'completed'::varchar
        ELSE 'upcoming'::varchar
    END,
    s.start_date,
    s.end_date,
    false,
    jsonb_build_object(
        'migrated_from_season', true,
        'original_season_id', s.id,
        'migration_date', now()::text,
        'points_per_win', 3,
        'points_per_draw', 1,
        'points_per_loss', 0
    )
FROM public.seasons s
WHERE NOT EXISTS (
    SELECT 1 FROM public.tournaments t 
    WHERE t.league_id = s.league_id 
    AND (
        t.slug = s.slug || '-tournament' 
        OR t.settings->>'original_season_id' = s.id::text
    )
);

-- Step 2: Migrate season participants to tournament participants
INSERT INTO public.tournament_participants (tournament_id, participant_id, joined_at)
SELECT 
    t.id as tournament_id,
    sp.participant_id,
    sp.joined_at
FROM public.tournaments t
JOIN public.seasons s ON s.id = (t.settings->>'original_season_id')::uuid
JOIN public.season_participants sp ON sp.season_id = s.id
WHERE t.settings->>'migrated_from_season' = 'true'
AND NOT EXISTS (
    SELECT 1 FROM public.tournament_participants tp 
    WHERE tp.tournament_id = t.id 
    AND tp.participant_id = sp.participant_id
);

-- Step 3: Update matches to link to tournaments (keeping season_id for backward compatibility)
-- This approach maintains dual coupling - matches are linked to both season and tournament
UPDATE public.matches 
SET tournament_id = (
    SELECT t.id 
    FROM public.tournaments t 
    WHERE t.settings->>'original_season_id' = matches.season_id::text
    AND t.settings->>'migrated_from_season' = 'true'
)
WHERE matches.season_id IS NOT NULL 
AND matches.tournament_id IS NULL
AND EXISTS (
    SELECT 1 FROM public.tournaments t 
    WHERE t.settings->>'original_season_id' = matches.season_id::text
    AND t.settings->>'migrated_from_season' = 'true'
);

-- =============================================================================
-- APPROACH 2: MODIFY CONSTRAINTS TO ALLOW DUAL COUPLING
-- =============================================================================

-- Remove the existing constraint that prevents dual coupling
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS match_belongs_to_season_or_tournament;
ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS match_belongs_to_season_or_tournament_flexible;

-- Add a new flexible constraint that requires at least one coupling
ALTER TABLE public.matches 
ADD CONSTRAINT match_must_have_season_or_tournament 
CHECK (season_id IS NOT NULL OR tournament_id IS NOT NULL);

-- =============================================================================
-- APPROACH 3: SELECTIVE MIGRATION BY LEAGUE
-- =============================================================================

-- Example: Migrate only specific leagues (replace 'your-league-slug' with actual slug)
-- 
-- Create tournament for specific league:
-- INSERT INTO public.tournaments (league_id, name, slug, description, tournament_type, status, auto_generate_matches, settings)
-- SELECT 
--     l.id,
--     l.name || ' Combined Tournament',
--     l.slug || '-combined-tournament',
--     'Combined tournament for all seasons',
--     'round_robin',
--     'active',
--     false,
--     jsonb_build_object('combined_seasons', true, 'migration_date', now()::text)
-- FROM public.leagues l
-- WHERE l.slug = 'your-league-slug';
-- 
-- Link all season matches from this league to the new tournament:
-- UPDATE public.matches 
-- SET tournament_id = (
--     SELECT t.id FROM public.tournaments t 
--     JOIN public.leagues l ON l.id = t.league_id 
--     WHERE l.slug = 'your-league-slug' 
--     AND t.settings->>'combined_seasons' = 'true'
-- )
-- WHERE league_id = (SELECT id FROM public.leagues WHERE slug = 'your-league-slug')
-- AND season_id IS NOT NULL 
-- AND tournament_id IS NULL;

-- =============================================================================
-- VERIFICATION QUERIES
-- =============================================================================

-- Check migration results
SELECT 
    'Migration Summary' as report_type,
    COUNT(CASE WHEN season_id IS NOT NULL AND tournament_id IS NULL THEN 1 END) as season_only,
    COUNT(CASE WHEN season_id IS NULL AND tournament_id IS NOT NULL THEN 1 END) as tournament_only,
    COUNT(CASE WHEN season_id IS NOT NULL AND tournament_id IS NOT NULL THEN 1 END) as both_coupled,
    COUNT(CASE WHEN season_id IS NULL AND tournament_id IS NULL THEN 1 END) as orphaned,
    COUNT(*) as total_matches
FROM public.matches;

-- Check tournaments created from seasons
SELECT 
    l.name as league_name,
    t.name as tournament_name,
    t.status,
    (t.settings->>'migrated_from_season')::boolean as is_migrated,
    COUNT(m.id) as match_count,
    COUNT(tp.id) as participant_count
FROM public.tournaments t
JOIN public.leagues l ON l.id = t.league_id
LEFT JOIN public.matches m ON m.tournament_id = t.id
LEFT JOIN public.tournament_participants tp ON tp.tournament_id = t.id
WHERE t.settings->>'migrated_from_season' = 'true'
GROUP BY l.name, t.name, t.status, t.settings
ORDER BY l.name, t.name;

-- Check for any issues
SELECT 
    'Potential Issues' as report_type,
    COUNT(*) as orphaned_matches
FROM public.matches 
WHERE season_id IS NULL AND tournament_id IS NULL;

-- =============================================================================
-- ROLLBACK SCRIPT (Use if migration needs to be reversed)
-- =============================================================================

-- Uncomment and run these queries to rollback the migration:

-- Remove tournament_id from matches that were migrated from seasons
-- UPDATE public.matches 
-- SET tournament_id = NULL 
-- WHERE tournament_id IN (
--     SELECT t.id FROM public.tournaments t 
--     WHERE t.settings->>'migrated_from_season' = 'true'
-- );

-- Delete migrated tournament participants
-- DELETE FROM public.tournament_participants 
-- WHERE tournament_id IN (
--     SELECT t.id FROM public.tournaments t 
--     WHERE t.settings->>'migrated_from_season' = 'true'
-- );

-- Delete migrated tournaments
-- DELETE FROM public.tournaments 
-- WHERE settings->>'migrated_from_season' = 'true';

-- Restore original constraint (if desired)
-- ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS match_must_have_season_or_tournament;
-- ALTER TABLE public.matches ADD CONSTRAINT match_belongs_to_season_or_tournament 
-- CHECK (
--   (season_id IS NOT NULL AND tournament_id IS NULL) OR 
--   (season_id IS NULL AND tournament_id IS NOT NULL)
-- );

-- =============================================================================
-- USAGE INSTRUCTIONS
-- =============================================================================

/*
HOW TO USE THIS SCRIPT:

1. BACKUP YOUR DATABASE FIRST!
   pg_dump your_database > backup_before_migration.sql

2. Choose your migration approach:
   - Approach 1: Recommended for most cases - creates tournaments for all seasons
   - Approach 2: More flexible - allows matches to be coupled to both season and tournament
   - Approach 3: Selective - migrate specific leagues only

3. Run the chosen approach sections in order

4. Run verification queries to check results

5. Test your application thoroughly

6. If issues occur, use the rollback script

NOTES:
- Approach 1 preserves all existing season data while adding tournament functionality
- The migration maintains backward compatibility with season-based queries
- Tournament participants are automatically created based on season participants
- All migrated tournaments use 'round_robin' type by default (can be changed later via admin)
- Original season IDs are stored in tournament settings for reference

EXAMPLE EXECUTION ORDER:
1. Run "Step 1: Create tournaments" 
2. Run "Step 2: Migrate season participants"
3. Run "Step 3: Update matches"
4. Run "Modify constraints" (Approach 2)
5. Run verification queries
*/

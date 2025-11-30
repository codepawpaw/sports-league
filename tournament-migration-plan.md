# Tournament System Migration Plan

## Overview
Transform the current season-based system into a flexible tournament system that allows multiple concurrent tournaments within a single league.

## Current System Analysis
- **Leagues** → Main container
- **Seasons** → Time-based divisions (only 1 active per league)
- **Participants** → Players (many-to-many with seasons via season_participants)
- **Matches** → Games between participants (belong to league + season)

## Proposed Tournament System

### Database Schema Changes

#### 1. Create Tournaments Table
```sql
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
  settings jsonb, -- Store tournament-specific settings
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  UNIQUE(league_id, slug)
);
```

#### 2. Create Tournament Participants Table
```sql
CREATE TABLE public.tournament_participants (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
  participant_id uuid REFERENCES public.participants(id) ON DELETE CASCADE NOT NULL,
  joined_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  seed_position integer, -- For seeded tournaments
  UNIQUE(tournament_id, participant_id)
);
```

#### 3. Update Matches Table
```sql
-- Add tournament_id and make season_id optional
ALTER TABLE public.matches ADD COLUMN tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE;
ALTER TABLE public.matches ALTER COLUMN season_id DROP NOT NULL;

-- Add constraint to ensure match belongs to either season OR tournament
ALTER TABLE public.matches ADD CONSTRAINT match_belongs_to_season_or_tournament 
CHECK (
  (season_id IS NOT NULL AND tournament_id IS NULL) OR 
  (season_id IS NULL AND tournament_id IS NOT NULL)
);
```

### Tournament Types Implementation

#### 1. Round Robin Tournament
- **Features:**
  - Every participant plays every other participant
  - Automatic match generation
  - Points-based ranking system
  - Configurable points per win/draw/loss

#### 2. Table System Tournament
- **Features:**
  - League table with standings
  - Win/loss/draw tracking
  - Goal difference or set difference
  - Promotion/relegation concepts

#### 3. Exhibition Tournament
- **Features:**
  - Flexible match scheduling
  - No automatic ranking
  - Can be used for friendly matches
  - Custom match formats

### Migration Strategy

#### Phase 1: Database Migration
1. Create new tournament tables
2. Migrate existing seasons to tournaments
3. Update existing matches to reference tournaments
4. Maintain backward compatibility

#### Phase 2: API Development
1. Tournament CRUD endpoints
2. Tournament participant management
3. Tournament-specific match handling
4. Tournament standings/rankings

#### Phase 3: UI Updates
1. Tournament management interface
2. Tournament creation wizard
3. Tournament-specific views
4. Tournament standings pages

## Benefits of Tournament System

1. **Flexibility:** Multiple tournaments per league
2. **Variety:** Different tournament formats
3. **Concurrent Events:** Run exhibition alongside competitive tournaments
4. **Better UX:** Clearer purpose for each set of matches
5. **Scalability:** Easy to add new tournament types

## Example Scenarios

### WSL League Example:
- **Round Robin Tournament:** "WSL Championship 2024"
- **Exhibition Tournament:** "Pre-season Friendlies"
- **Table System Tournament:** "WSL Division A"

All running simultaneously with different participants and rules.

## Implementation Priority

1. **High Priority:**
   - Basic tournament CRUD
   - Tournament participant management
   - Exhibition tournament type
   - Round robin tournament type

2. **Medium Priority:**
   - Table system tournament type
   - Tournament standings
   - Advanced tournament settings

3. **Low Priority:**
   - Single/Double elimination
   - Seeding systems
   - Tournament brackets

## Timeline Estimate
- **Week 1-2:** Database schema and basic API
- **Week 3:** Tournament management UI
- **Week 4:** Tournament types implementation
- **Week 5:** Testing and refinement

# Season to Tournament Migration Guide

## 🎯 **What Happens to Your Existing Data**

This migration **preserves ALL your existing data** while converting your seasons into tournaments. Here's exactly what happens:

## 📋 **Step-by-Step Migration Process**

### **Step 1: Database Schema Setup**
- Creates new `tournaments` and `tournament_participants` tables
- Adds `tournament_id` column to existing `matches` table
- Makes `season_id` optional (preserves existing matches)

### **Step 2: Convert Seasons → Tournaments**
```sql
-- Each season becomes a round_robin tournament
INSERT INTO tournaments (name, tournament_type, status, settings)
SELECT 
  season_name,           -- "Season 1" → "Season 1"
  'round_robin',         -- Assumes round robin (most common)
  'active'/'completed',  -- Preserves season status
  jsonb_build_object(
    'points_per_win', 3,
    'points_per_draw', 1,
    'points_per_loss', 0,
    'migrated_from_season', true,
    'original_season_id', season_id
  )
FROM seasons;
```

### **Step 3: Migrate Participants**
```sql
-- All season participants → tournament participants
INSERT INTO tournament_participants (tournament_id, participant_id, joined_at)
SELECT tournament_id, participant_id, original_join_date
FROM season_participants → tournament_participants
```

### **Step 4: Migrate Matches**
```sql
-- All season matches → tournament matches
UPDATE matches 
SET tournament_id = new_tournament_id
WHERE season_id = old_season_id;
```

## 🔍 **Data Mapping Example**

### **Before Migration (Season System):**
```
League: "WSL"
└── Season: "Season 1" (Active)
    ├── Participants: [Alice, Bob, Charlie]
    └── Matches: 
        ├── Alice vs Bob (Completed: 3-1)
        ├── Alice vs Charlie (Scheduled)
        └── Bob vs Charlie (Completed: 2-3)
```

### **After Migration (Tournament System):**
```
League: "WSL"
├── Tournament: "Season 1" (Active, Round Robin)
│   ├── Participants: [Alice, Bob, Charlie] 
│   ├── Matches: 
│   │   ├── Alice vs Bob (Completed: 3-1)
│   │   ├── Alice vs Charlie (Scheduled)
│   │   └── Bob vs Charlie (Completed: 2-3)
│   └── Settings: {
│       "points_per_win": 3,
│       "points_per_draw": 1,
│       "points_per_loss": 0,
│       "migrated_from_season": true
│     }
└── (Original Season 1 data preserved for reference)
```

## ✅ **What's Preserved**

1. **All Participants**: Every player in your seasons
2. **All Matches**: Every match with scores, dates, status
3. **Match History**: Complete record of who played whom and when
4. **Completed Results**: All existing scores and match outcomes
5. **Scheduled Matches**: Upcoming matches remain scheduled
6. **Timestamps**: Original creation dates and join dates
7. **Original Season Data**: Kept for reference and rollback

## 🎯 **What Changes**

1. **Structure**: Seasons → Tournaments (same data, better organization)
2. **Tournament Type**: All converted to `round_robin` (most common)
3. **Settings**: Default round robin scoring (3-1-0 points)
4. **New Capabilities**: Can now create multiple tournaments per league

## 🚀 **Running the Migration**

### **Step 1: Backup Your Database**
```bash
pg_dump your_database > backup_before_tournament_migration.sql
```

### **Step 2: Run the Migration**
```bash
psql your_database < migration-add-tournament-system.sql
```

### **Step 3: Verify Migration Success**
```sql
-- Check migration status for all leagues
SELECT * FROM public.get_migration_status();

-- Should show:
-- league_name | seasons_migrated | participants_migrated | matches_migrated
-- WSL         | 1               | 3                     | 3
```

### **Step 4: Verify Your Data**
```sql
-- Check your migrated tournament
SELECT t.name, t.tournament_type, t.status, 
       count(tp.participant_id) as participants,
       count(m.id) as matches
FROM tournaments t
LEFT JOIN tournament_participants tp ON tp.tournament_id = t.id
LEFT JOIN matches m ON m.tournament_id = t.id
WHERE t.league_id = (SELECT id FROM leagues WHERE slug = 'your-league-slug')
GROUP BY t.id, t.name, t.tournament_type, t.status;
```

## 🔧 **After Migration Benefits**

### **Immediate Benefits:**
- ✅ All existing data works exactly the same
- ✅ Current users see no disruption
- ✅ Admin panel continues to work

### **New Capabilities:**
- ✅ Create new tournaments alongside migrated one
- ✅ Run "Exhibition" friendlies separate from main competition
- ✅ Start "Table System" division tournaments
- ✅ Multiple concurrent tournaments per league

### **Example Post-Migration Setup:**
```javascript
// Your existing season is now: "Season 1" (Round Robin Tournament)
// You can now add:

// Exhibition friendlies
POST /api/leagues/wsl/tournaments
{
  "name": "Pre-season Friendlies",
  "tournament_type": "exhibition"
}

// Division tournament
POST /api/leagues/wsl/tournaments  
{
  "name": "WSL Division A",
  "tournament_type": "table_system",
  "max_participants": 8
}
```

## 🛡️ **Safety Features**

1. **Reversible**: Original season data is preserved
2. **Flexible Constraints**: Allows both season and tournament matches during transition
3. **Data Integrity**: Foreign key constraints prevent data loss
4. **Verification Functions**: Built-in functions to check migration success

## 🎯 **Next Steps After Migration**

1. **Test your current functionality** - everything should work the same
2. **Create new tournaments** - experiment with different types
3. **Update UI gradually** - add tournament features to admin panel
4. **Migrate API calls** - gradually shift from season endpoints to tournament endpoints

Your round robin season will become a round robin tournament with identical functionality, but now you can create multiple tournaments as needed!

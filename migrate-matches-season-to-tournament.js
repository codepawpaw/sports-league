#!/usr/bin/env node

/**
 * Migration Script: Season-to-Tournament Match Migration
 * 
 * This script provides multiple strategies to migrate existing matches
 * that are currently coupled to seasons to also be coupled to tournaments.
 * 
 * Run with: node migrate-matches-season-to-tournament.js
 */

const { createClient } = require('@supabase/supabase-js');
const readline = require('readline');

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Migration strategies
const MIGRATION_STRATEGIES = {
  1: 'CREATE_TOURNAMENTS_FOR_SEASONS',
  2: 'LINK_TO_EXISTING_TOURNAMENTS', 
  3: 'DUAL_COUPLING_ALLOW_BOTH',
  4: 'SELECTIVE_BY_LEAGUE',
  5: 'PREVIEW_ONLY'
};

async function main() {
  console.log('🏆 Season-to-Tournament Match Migration Tool\n');
  
  // Check current state
  await checkCurrentState();
  
  // Show migration options
  showMigrationOptions();
  
  const strategy = await askQuestion('\nSelect migration strategy (1-5): ');
  
  switch (strategy) {
    case '1':
      await createTournamentsForSeasons();
      break;
    case '2':
      await linkToExistingTournaments();
      break;
    case '3':
      await allowDualCoupling();
      break;
    case '4':
      await selectiveByLeague();
      break;
    case '5':
      await previewOnly();
      break;
    default:
      console.log('❌ Invalid selection. Exiting.');
      process.exit(1);
  }
  
  rl.close();
}

async function checkCurrentState() {
  console.log('📊 Checking current database state...\n');
  
  try {
    // Count matches by coupling type
    const { data: matchStats } = await supabase
      .from('matches')
      .select('season_id, tournament_id, league_id, status');
    
    if (!matchStats) {
      console.log('❌ Failed to fetch match statistics');
      return;
    }
    
    const seasonOnly = matchStats.filter(m => m.season_id && !m.tournament_id).length;
    const tournamentOnly = matchStats.filter(m => !m.season_id && m.tournament_id).length;
    const both = matchStats.filter(m => m.season_id && m.tournament_id).length;
    const orphaned = matchStats.filter(m => !m.season_id && !m.tournament_id).length;
    
    console.log('Current Match Distribution:');
    console.log(`  📅 Season-only matches: ${seasonOnly}`);
    console.log(`  🏆 Tournament-only matches: ${tournamentOnly}`);
    console.log(`  🔗 Both season & tournament: ${both}`);
    console.log(`  ❓ Orphaned matches: ${orphaned}`);
    console.log(`  📈 Total matches: ${matchStats.length}\n`);
    
    // Show leagues with season-only matches
    const leaguesWithSeasonMatches = new Map();
    matchStats
      .filter(m => m.season_id && !m.tournament_id)
      .forEach(m => {
        if (!leaguesWithSeasonMatches.has(m.league_id)) {
          leaguesWithSeasonMatches.set(m.league_id, 0);
        }
        leaguesWithSeasonMatches.set(m.league_id, leaguesWithSeasonMatches.get(m.league_id) + 1);
      });
    
    if (leaguesWithSeasonMatches.size > 0) {
      console.log('Leagues with season-only matches:');
      for (const [leagueId, count] of leaguesWithSeasonMatches) {
        const { data: league } = await supabase
          .from('leagues')
          .select('name, slug')
          .eq('id', leagueId)
          .single();
        
        console.log(`  • ${league?.name || 'Unknown'} (${league?.slug}): ${count} matches`);
      }
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error checking current state:', error.message);
  }
}

function showMigrationOptions() {
  console.log('🔧 Available Migration Strategies:\n');
  console.log('1. CREATE_TOURNAMENTS_FOR_SEASONS');
  console.log('   Creates a tournament for each season and migrates matches');
  console.log('   • Safe: preserves original season data');
  console.log('   • Creates 1:1 season-to-tournament mapping\n');
  
  console.log('2. LINK_TO_EXISTING_TOURNAMENTS');
  console.log('   Links season matches to existing tournaments based on criteria');
  console.log('   • Requires existing tournaments');
  console.log('   • Smart matching by date/league\n');
  
  console.log('3. DUAL_COUPLING_ALLOW_BOTH');
  console.log('   Modifies constraints to allow matches coupled to both season AND tournament');
  console.log('   • Most flexible option');
  console.log('   • Requires schema modification\n');
  
  console.log('4. SELECTIVE_BY_LEAGUE');
  console.log('   Choose specific leagues to migrate');
  console.log('   • Interactive selection');
  console.log('   • Preview before applying\n');
  
  console.log('5. PREVIEW_ONLY');
  console.log('   Show what would be migrated without making changes');
  console.log('   • Safe dry-run mode');
  console.log('   • No database modifications');
}

async function createTournamentsForSeasons() {
  console.log('\n🔄 Strategy 1: Creating tournaments for seasons...\n');
  
  const confirm = await askQuestion('This will create tournaments for all seasons. Continue? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Migration cancelled.');
    return;
  }
  
  try {
    // Get all seasons that don't have corresponding tournaments
    const { data: seasons } = await supabase
      .from('seasons')
      .select(`
        id, name, slug, description, league_id, is_active, is_finished,
        start_date, end_date, created_at,
        leagues(name, slug)
      `);
    
    if (!seasons?.length) {
      console.log('❌ No seasons found to migrate.');
      return;
    }
    
    console.log(`Found ${seasons.length} seasons to process...\n`);
    
    for (const season of seasons) {
      console.log(`Processing season: ${season.name} (${season.leagues.name})`);
      
      // Check if tournament already exists for this season
      const { data: existingTournament } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('league_id', season.league_id)
        .or(`slug.eq.${season.slug}-tournament,settings->>original_season_id.eq.${season.id}`)
        .single();
      
      if (existingTournament) {
        console.log(`  ⚠️  Tournament already exists: ${existingTournament.name}`);
        continue;
      }
      
      // Create tournament for season
      const { data: tournament, error: tournamentError } = await supabase
        .from('tournaments')
        .insert({
          league_id: season.league_id,
          name: season.name,
          slug: `${season.slug}-tournament`,
          description: `Migrated from season: ${season.name}`,
          tournament_type: 'round_robin',
          status: season.is_active ? 'active' : season.is_finished ? 'completed' : 'upcoming',
          start_date: season.start_date,
          end_date: season.end_date,
          auto_generate_matches: false,
          settings: {
            migrated_from_season: true,
            original_season_id: season.id,
            migration_date: new Date().toISOString(),
            points_per_win: 3,
            points_per_draw: 1,
            points_per_loss: 0
          }
        })
        .select()
        .single();
      
      if (tournamentError) {
        console.error(`  ❌ Error creating tournament: ${tournamentError.message}`);
        continue;
      }
      
      console.log(`  ✅ Created tournament: ${tournament.name}`);
      
      // Migrate season participants to tournament
      const { data: seasonParticipants } = await supabase
        .from('season_participants')
        .select('participant_id, joined_at')
        .eq('season_id', season.id);
      
      if (seasonParticipants?.length) {
        const { error: participantsError } = await supabase
          .from('tournament_participants')
          .insert(
            seasonParticipants.map(sp => ({
              tournament_id: tournament.id,
              participant_id: sp.participant_id,
              joined_at: sp.joined_at
            }))
          );
        
        if (participantsError) {
          console.error(`  ❌ Error migrating participants: ${participantsError.message}`);
        } else {
          console.log(`  ✅ Migrated ${seasonParticipants.length} participants`);
        }
      }
      
      // Migrate matches from season to tournament
      const { data: seasonMatches, error: matchesError } = await supabase
        .from('matches')
        .update({ tournament_id: tournament.id })
        .eq('season_id', season.id)
        .is('tournament_id', null)
        .select('id');
      
      if (matchesError) {
        console.error(`  ❌ Error migrating matches: ${matchesError.message}`);
      } else {
        console.log(`  ✅ Migrated ${seasonMatches?.length || 0} matches`);
      }
      
      console.log('');
    }
    
    console.log('✅ Tournament creation and migration completed!');
    
  } catch (error) {
    console.error('❌ Migration error:', error.message);
  }
}

async function linkToExistingTournaments() {
  console.log('\n🔗 Strategy 2: Linking to existing tournaments...\n');
  
  try {
    // Get tournaments that could accept season matches
    const { data: tournaments } = await supabase
      .from('tournaments')
      .select(`
        id, name, slug, league_id, status, start_date, end_date,
        leagues(name, slug)
      `)
      .in('status', ['upcoming', 'active']);
    
    if (!tournaments?.length) {
      console.log('❌ No available tournaments found to link matches to.');
      return;
    }
    
    console.log('Available tournaments:');
    tournaments.forEach((t, i) => {
      console.log(`  ${i + 1}. ${t.name} (${t.leagues.name}) - ${t.status}`);
    });
    
    const selection = await askQuestion('\nSelect tournament number to link matches to (or 0 to cancel): ');
    const tournamentIndex = parseInt(selection) - 1;
    
    if (tournamentIndex < 0 || tournamentIndex >= tournaments.length) {
      console.log('❌ Invalid selection or cancelled.');
      return;
    }
    
    const selectedTournament = tournaments[tournamentIndex];
    console.log(`\nSelected: ${selectedTournament.name}`);
    
    // Get season matches that could be linked
    const { data: seasonMatches } = await supabase
      .from('matches')
      .select(`
        id, league_id, season_id, scheduled_at, status,
        seasons(name)
      `)
      .eq('league_id', selectedTournament.league_id)
      .is('tournament_id', null)
      .not('season_id', 'is', null);
    
    if (!seasonMatches?.length) {
      console.log('❌ No season matches found for this league.');
      return;
    }
    
    console.log(`\nFound ${seasonMatches.length} matches that could be linked.`);
    
    const confirm = await askQuestion(`Link these matches to "${selectedTournament.name}"? (y/N): `);
    if (confirm.toLowerCase() !== 'y') {
      console.log('❌ Linking cancelled.');
      return;
    }
    
    // Update matches to link to tournament
    const { data: updatedMatches, error } = await supabase
      .from('matches')
      .update({ tournament_id: selectedTournament.id })
      .in('id', seasonMatches.map(m => m.id))
      .select('id');
    
    if (error) {
      console.error('❌ Error linking matches:', error.message);
    } else {
      console.log(`✅ Successfully linked ${updatedMatches?.length || 0} matches to tournament.`);
    }
    
  } catch (error) {
    console.error('❌ Linking error:', error.message);
  }
}

async function allowDualCoupling() {
  console.log('\n🔗 Strategy 3: Allow dual coupling (season AND tournament)...\n');
  
  console.log('⚠️  This will modify database constraints to allow matches to be');
  console.log('    coupled to BOTH a season AND a tournament simultaneously.\n');
  
  const confirm = await askQuestion('Continue with schema modification? (y/N): ');
  if (confirm.toLowerCase() !== 'y') {
    console.log('❌ Schema modification cancelled.');
    return;
  }
  
  try {
    // Remove existing constraint
    console.log('🔧 Removing existing constraint...');
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS match_belongs_to_season_or_tournament;'
    });
    
    await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.matches DROP CONSTRAINT IF EXISTS match_belongs_to_season_or_tournament_flexible;'
    });
    
    // Add new flexible constraint
    console.log('🔧 Adding flexible constraint...');
    await supabase.rpc('exec_sql', {
      sql: `
        ALTER TABLE public.matches 
        ADD CONSTRAINT match_must_have_season_or_tournament 
        CHECK (season_id IS NOT NULL OR tournament_id IS NOT NULL);
      `
    });
    
    console.log('✅ Schema updated! Matches can now be coupled to both season and tournament.');
    console.log('📝 Note: This allows maximum flexibility but requires careful data management.');
    
  } catch (error) {
    console.error('❌ Schema modification error:', error.message);
  }
}

async function selectiveByLeague() {
  console.log('\n🎯 Strategy 4: Selective migration by league...\n');
  
  try {
    // Get leagues with season matches
    const { data: leagues } = await supabase
      .from('leagues')
      .select(`
        id, name, slug,
        matches!inner(id, season_id, tournament_id)
      `)
      .not('matches.season_id', 'is', null)
      .is('matches.tournament_id', null);
    
    if (!leagues?.length) {
      console.log('❌ No leagues with season-only matches found.');
      return;
    }
    
    // Count matches per league
    const leagueStats = leagues.map(league => ({
      ...league,
      matchCount: league.matches.length
    }));
    
    console.log('Leagues with season-only matches:');
    leagueStats.forEach((league, i) => {
      console.log(`  ${i + 1}. ${league.name} (${league.slug}) - ${league.matchCount} matches`);
    });
    
    const selection = await askQuestion('\nSelect league number to migrate (or 0 to cancel): ');
    const leagueIndex = parseInt(selection) - 1;
    
    if (leagueIndex < 0 || leagueIndex >= leagueStats.length) {
      console.log('❌ Invalid selection or cancelled.');
      return;
    }
    
    const selectedLeague = leagueStats[leagueIndex];
    console.log(`\nSelected: ${selectedLeague.name}`);
    console.log(`This will migrate ${selectedLeague.matchCount} matches.`);
    
    // Show migration options for this league
    console.log('\nMigration options for this league:');
    console.log('1. Create new tournament for each season');
    console.log('2. Create single tournament for all seasons');
    console.log('3. Link to existing tournament');
    
    const option = await askQuestion('Select option (1-3): ');
    
    switch (option) {
      case '1':
        await migrateLeagueCreateMultipleTournaments(selectedLeague.id);
        break;
      case '2':
        await migrateLeagueCreateSingleTournament(selectedLeague);
        break;
      case '3':
        await migrateLeagueLinkExisting(selectedLeague.id);
        break;
      default:
        console.log('❌ Invalid option.');
    }
    
  } catch (error) {
    console.error('❌ Selective migration error:', error.message);
  }
}

async function migrateLeagueCreateSingleTournament(league) {
  const tournamentName = await askQuestion(`Enter tournament name (default: "${league.name} Tournament"): `) || `${league.name} Tournament`;
  
  try {
    // Create single tournament for league
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert({
        league_id: league.id,
        name: tournamentName,
        slug: `${league.slug}-combined-tournament`,
        description: `Combined tournament for ${league.name}`,
        tournament_type: 'round_robin',
        status: 'active',
        auto_generate_matches: false,
        settings: {
          combined_seasons: true,
          migration_date: new Date().toISOString()
        }
      })
      .select()
      .single();
    
    if (tournamentError) {
      console.error('❌ Error creating tournament:', tournamentError.message);
      return;
    }
    
    console.log(`✅ Created tournament: ${tournament.name}`);
    
    // Migrate all season matches to this tournament
    const { data: updatedMatches, error: matchError } = await supabase
      .from('matches')
      .update({ tournament_id: tournament.id })
      .eq('league_id', league.id)
      .not('season_id', 'is', null)
      .is('tournament_id', null)
      .select('id');
    
    if (matchError) {
      console.error('❌ Error migrating matches:', matchError.message);
    } else {
      console.log(`✅ Migrated ${updatedMatches?.length || 0} matches to tournament.`);
    }
    
  } catch (error) {
    console.error('❌ Tournament creation error:', error.message);
  }
}

async function previewOnly() {
  console.log('\n👀 Strategy 5: Preview-only mode...\n');
  
  try {
    console.log('📊 Migration Preview Report\n');
    
    // Get detailed breakdown
    const { data: allMatches } = await supabase
      .from('matches')
      .select(`
        id, league_id, season_id, tournament_id, status, scheduled_at,
        leagues(name, slug),
        seasons(name),
        tournaments(name)
      `);
    
    if (!allMatches) {
      console.log('❌ Failed to fetch match data for preview.');
      return;
    }
    
    const seasonOnlyMatches = allMatches.filter(m => m.season_id && !m.tournament_id);
    
    // Group by league
    const leagueGroups = new Map();
    seasonOnlyMatches.forEach(match => {
      const leagueKey = match.leagues.slug;
      if (!leagueGroups.has(leagueKey)) {
        leagueGroups.set(leagueKey, {
          league: match.leagues,
          matches: [],
          seasons: new Set()
        });
      }
      leagueGroups.get(leagueKey).matches.push(match);
      if (match.seasons?.name) {
        leagueGroups.get(leagueKey).seasons.add(match.seasons.name);
      }
    });
    
    console.log(`Total matches needing migration: ${seasonOnlyMatches.length}\n`);
    
    for (const [leagueSlug, data] of leagueGroups) {
      console.log(`🏆 League: ${data.league.name}`);
      console.log(`   Matches to migrate: ${data.matches.length}`);
      console.log(`   Seasons involved: ${Array.from(data.seasons).join(', ')}`);
      
      const statusBreakdown = {};
      data.matches.forEach(m => {
        statusBreakdown[m.status] = (statusBreakdown[m.status] || 0) + 1;
      });
      
      console.log(`   Status breakdown: ${Object.entries(statusBreakdown).map(([k,v]) => `${k}: ${v}`).join(', ')}`);
      console.log('');
    }
    
    console.log('🔍 Recommended migration strategy:');
    if (leagueGroups.size <= 3) {
      console.log('   → Strategy 1: Create tournaments for seasons (small number of leagues)');
    } else {
      console.log('   → Strategy 4: Selective by league (many leagues - process individually)');
    }
    
    console.log('\n💡 Migration Impact:');
    console.log(`   • ${leagueGroups.size} leagues will be affected`);
    console.log(`   • ${seasonOnlyMatches.length} matches will be migrated`);
    console.log(`   • ${new Set(seasonOnlyMatches.map(m => m.season_id)).size} seasons will be converted to tournaments`);
    
  } catch (error) {
    console.error('❌ Preview error:', error.message);
  }
}

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      resolve(answer);
    });
  });
}

// Run the migration tool
main().catch(console.error);

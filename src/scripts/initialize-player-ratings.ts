import { createClient } from '@supabase/supabase-js'
import { USATTRatingCalculator, MatchResult, PlayerRating } from '../lib/usatt-rating-calculator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

async function initializePlayerRatings() {
  console.log('Starting player ratings initialization...')

  try {
    // Get all leagues
    const { data: leagues, error: leaguesError } = await supabase
      .from('leagues')
      .select('id, name, slug')

    if (leaguesError) {
      console.error('Error fetching leagues:', leaguesError)
      return
    }

    console.log(`Found ${leagues.length} leagues`)

    for (const league of leagues) {
      console.log(`\nProcessing league: ${league.name} (${league.slug})`)

      // Get all participants in this league
      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('id, name')
        .eq('league_id', league.id)

      if (participantsError) {
        console.error(`Error fetching participants for league ${league.name}:`, participantsError)
        continue
      }

      console.log(`  Found ${participants.length} participants`)

      // Get all completed matches for this league
      const { data: matches, error: matchesError } = await supabase
        .from('matches')
        .select(`
          id,
          player1_id,
          player2_id,
          player1_score,
          player2_score,
          completed_at
        `)
        .eq('league_id', league.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: true })

      if (matchesError) {
        console.error(`Error fetching matches for league ${league.name}:`, matchesError)
        continue
      }

      console.log(`  Found ${matches.length} completed matches`)

      if (matches.length === 0) {
        console.log(`  No matches to process, creating default ratings...`)
        
        // Create default ratings for all participants
        const defaultRatings = participants.map(participant => ({
          player_id: participant.id,
          league_id: league.id,
          current_rating: 1200,
          matches_played: 0,
          is_provisional: true,
          updated_at: new Date().toISOString()
        }))

        const { error: insertError } = await supabase
          .from('player_ratings')
          .upsert(defaultRatings, {
            onConflict: 'player_id,league_id',
            ignoreDuplicates: false
          })

        if (insertError) {
          console.error(`  Error creating default ratings:`, insertError)
        } else {
          console.log(`  Created default ratings for ${participants.length} participants`)
        }
        continue
      }

      // Convert to required format
      const matchResults: MatchResult[] = matches.map(match => ({
        id: match.id,
        player1_id: match.player1_id,
        player2_id: match.player2_id,
        player1_score: match.player1_score || 0,
        player2_score: match.player2_score || 0,
        completed_at: match.completed_at
      }))

      // Initialize player ratings
      const playerRatings = new Map<string, PlayerRating>()
      
      // Get all player IDs who have played matches
      const allPlayerIds = new Set<string>()
      matchResults.forEach(match => {
        allPlayerIds.add(match.player1_id)
        allPlayerIds.add(match.player2_id)
      })

      // Initialize all players with default ratings
      allPlayerIds.forEach(playerId => {
        playerRatings.set(playerId, {
          player_id: playerId,
          current_rating: 1200,
          matches_played: 0,
          is_provisional: true
        })
      })

      console.log(`  Calculating ratings for ${allPlayerIds.size} players...`)

      // Calculate new ratings using USATT algorithm
      const calculator = new USATTRatingCalculator()
      const ratingResults = calculator.calculateLeagueRatings(matchResults, playerRatings)

      console.log(`  Calculated ratings for ${ratingResults.length} players`)

      // Prepare rating updates
      const ratingUpdates = ratingResults.map(result => ({
        player_id: result.player_id,
        league_id: league.id,
        current_rating: result.new_rating,
        matches_played: result.matches_played,
        is_provisional: result.is_provisional,
        updated_at: new Date().toISOString()
      }))

      // Also create default ratings for participants who haven't played any matches
      const playersWithoutMatches = participants.filter(p => !allPlayerIds.has(p.id))
      playersWithoutMatches.forEach(participant => {
        ratingUpdates.push({
          player_id: participant.id,
          league_id: league.id,
          current_rating: 1200,
          matches_played: 0,
          is_provisional: true,
          updated_at: new Date().toISOString()
        })
      })

      console.log(`  Updating ${ratingUpdates.length} total rating records...`)

      // Insert or update ratings in database
      const { error: updateError } = await supabase
        .from('player_ratings')
        .upsert(ratingUpdates, {
          onConflict: 'player_id,league_id',
          ignoreDuplicates: false
        })

      if (updateError) {
        console.error(`  Error updating ratings:`, updateError)
      } else {
        console.log(`  ✅ Successfully updated ratings for league ${league.name}`)
        
        // Log some sample ratings for verification
        const sampleRatings = ratingResults.slice(0, 5)
        if (sampleRatings.length > 0) {
          console.log(`  Sample ratings:`)
          for (const rating of sampleRatings) {
            const participant = participants.find(p => p.id === rating.player_id)
            console.log(`    ${participant?.name || 'Unknown'}: ${rating.old_rating} → ${rating.new_rating} (${rating.matches_played} matches, ${rating.is_provisional ? 'provisional' : 'established'})`)
          }
        }
      }
    }

    console.log('\n✅ Player ratings initialization completed!')

  } catch (error) {
    console.error('Error during ratings initialization:', error)
  }
}

// Run the migration if this file is executed directly
if (require.main === module) {
  initializePlayerRatings()
    .then(() => {
      console.log('Migration completed')
      process.exit(0)
    })
    .catch(error => {
      console.error('Migration failed:', error)
      process.exit(1)
    })
}

export { initializePlayerRatings }

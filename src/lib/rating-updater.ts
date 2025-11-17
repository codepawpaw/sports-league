import { createClient } from '@supabase/supabase-js'
import { USATTRatingCalculator, MatchResult, PlayerRating } from './usatt-rating-calculator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export interface RatingUpdateResult {
  success: boolean
  error?: string
  updated_players?: number
  player_ratings?: Array<{
    player_id: string
    old_rating: number
    new_rating: number
    rating_change: number
  }>
}

/**
 * Update ratings for players involved in a specific match
 */
export async function updateRatingsForMatch(
  leagueId: string,
  matchId: string
): Promise<RatingUpdateResult> {
  try {
    // Get the completed match
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .eq('league_id', leagueId)
      .eq('status', 'completed')
      .single()

    if (matchError || !match) {
      return { success: false, error: 'Match not found or not completed' }
    }

    // Get all completed matches up to and including this match for proper rating calculation
    const { data: allMatches, error: allMatchesError } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, player1_score, player2_score, completed_at')
      .eq('league_id', leagueId)
      .eq('status', 'completed')
      .lte('completed_at', match.completed_at)
      .order('completed_at', { ascending: true })

    if (allMatchesError) {
      return { success: false, error: 'Failed to fetch matches for rating calculation' }
    }

    // Get current ratings for all players in the league
    const { data: existingRatings, error: ratingsError } = await supabase
      .from('player_ratings')
      .select('player_id, current_rating, matches_played, is_provisional')
      .eq('league_id', leagueId)

    if (ratingsError) {
      return { success: false, error: 'Failed to fetch existing ratings' }
    }

    // Convert to required format
    const matchResults: MatchResult[] = (allMatches || []).map(m => ({
      id: m.id,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      player1_score: m.player1_score || 0,
      player2_score: m.player2_score || 0,
      completed_at: m.completed_at
    }))

    // Build player ratings map
    const playerRatings = new Map<string, PlayerRating>()
    
    // Get all unique player IDs from matches
    const allPlayerIds = new Set<string>()
    matchResults.forEach(m => {
      allPlayerIds.add(m.player1_id)
      allPlayerIds.add(m.player2_id)
    })

    // Initialize ratings for all players
    allPlayerIds.forEach(playerId => {
      const existingRating = existingRatings?.find(r => r.player_id === playerId)
      playerRatings.set(playerId, {
        player_id: playerId,
        current_rating: existingRating?.current_rating || 1200,
        matches_played: 0, // Will be calculated during rating process
        is_provisional: existingRating?.is_provisional !== false
      })
    })

    // Calculate new ratings using USATT algorithm
    const calculator = new USATTRatingCalculator()
    const ratingResults = calculator.calculateLeagueRatings(matchResults, playerRatings)

    // Update ratings in database
    const ratingUpdates = ratingResults.map(result => ({
      player_id: result.player_id,
      league_id: leagueId,
      current_rating: result.new_rating,
      matches_played: result.matches_played,
      is_provisional: result.is_provisional,
      last_updated_at: new Date().toISOString()
    }))

    const { error: updateError } = await supabase
      .from('player_ratings')
      .upsert(ratingUpdates, {
        onConflict: 'player_id,league_id',
        ignoreDuplicates: false
      })

    if (updateError) {
      return { success: false, error: 'Failed to update ratings in database' }
    }

    // Return only the ratings for the players involved in this specific match
    const matchPlayerRatings = ratingResults.filter(r => 
      r.player_id === match.player1_id || r.player_id === match.player2_id
    ).map(r => ({
      player_id: r.player_id,
      old_rating: r.old_rating,
      new_rating: r.new_rating,
      rating_change: r.rating_change
    }))

    return {
      success: true,
      updated_players: ratingResults.length,
      player_ratings: matchPlayerRatings
    }

  } catch (error) {
    console.error('Rating update error:', error)
    return { success: false, error: 'Internal error during rating update' }
  }
}

/**
 * Recalculate all ratings for a league (for manual recalculation)
 */
export async function recalculateAllRatings(leagueId: string): Promise<RatingUpdateResult> {
  try {
    // Get all completed matches for the league
    const { data: allMatches, error: matchesError } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, player1_score, player2_score, completed_at')
      .eq('league_id', leagueId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: true })

    if (matchesError) {
      return { success: false, error: 'Failed to fetch matches' }
    }

    // Get current ratings
    const { data: existingRatings, error: ratingsError } = await supabase
      .from('player_ratings')
      .select('player_id, current_rating, matches_played, is_provisional')
      .eq('league_id', leagueId)

    if (ratingsError) {
      return { success: false, error: 'Failed to fetch ratings' }
    }

    // Convert to required format
    const matchResults: MatchResult[] = (allMatches || []).map(m => ({
      id: m.id,
      player1_id: m.player1_id,
      player2_id: m.player2_id,
      player1_score: m.player1_score || 0,
      player2_score: m.player2_score || 0,
      completed_at: m.completed_at
    }))

    const playerRatings = new Map<string, PlayerRating>()
    
    // Get all unique player IDs
    const allPlayerIds = new Set<string>()
    matchResults.forEach(m => {
      allPlayerIds.add(m.player1_id)
      allPlayerIds.add(m.player2_id)
    })

    // Initialize ratings
    allPlayerIds.forEach(playerId => {
      const existingRating = existingRatings?.find(r => r.player_id === playerId)
      playerRatings.set(playerId, {
        player_id: playerId,
        current_rating: existingRating?.current_rating || 1200,
        matches_played: 0,
        is_provisional: existingRating?.is_provisional !== false
      })
    })

    // Calculate new ratings
    const calculator = new USATTRatingCalculator()
    const ratingResults = calculator.calculateLeagueRatings(matchResults, playerRatings)

    // Update ratings in database
    const ratingUpdates = ratingResults.map(result => ({
      player_id: result.player_id,
      league_id: leagueId,
      current_rating: result.new_rating,
      matches_played: result.matches_played,
      is_provisional: result.is_provisional,
      last_updated_at: new Date().toISOString()
    }))

    const { error: updateError } = await supabase
      .from('player_ratings')
      .upsert(ratingUpdates, {
        onConflict: 'player_id,league_id',
        ignoreDuplicates: false
      })

    if (updateError) {
      return { success: false, error: 'Failed to update ratings in database' }
    }

    return {
      success: true,
      updated_players: ratingResults.length,
      player_ratings: ratingResults.map(r => ({
        player_id: r.player_id,
        old_rating: r.old_rating,
        new_rating: r.new_rating,
        rating_change: r.rating_change
      }))
    }

  } catch (error) {
    console.error('Rating recalculation error:', error)
    return { success: false, error: 'Internal error during rating recalculation' }
  }
}

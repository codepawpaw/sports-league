import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { USATTRatingCalculator, MatchResult, PlayerRating } from '@/lib/usatt-rating-calculator'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    // Verify league exists
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Check if user is league admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from auth header (simplified - in production you'd validate the JWT)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin for this league
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Not authorized to manage this league' }, { status: 403 })
    }

    // Fetch all completed matches for this league
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
      console.error('Error fetching matches:', matchesError)
      return NextResponse.json({ error: 'Failed to fetch matches' }, { status: 500 })
    }

    // Fetch current player ratings
    const { data: existingRatings, error: ratingsError } = await supabase
      .from('player_ratings')
      .select('player_id, current_rating, matches_played, is_provisional')
      .eq('league_id', league.id)

    if (ratingsError) {
      console.error('Error fetching ratings:', ratingsError)
      return NextResponse.json({ error: 'Failed to fetch ratings' }, { status: 500 })
    }

    // Convert to required format
    const matchResults: MatchResult[] = (matches || []).map(match => ({
      id: match.id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      player1_score: match.player1_score || 0,
      player2_score: match.player2_score || 0,
      completed_at: match.completed_at
    }))

    const playerRatings = new Map<string, PlayerRating>()
    
    // Initialize all players who have matches
    const allPlayerIds = new Set<string>()
    matchResults.forEach(match => {
      allPlayerIds.add(match.player1_id)
      allPlayerIds.add(match.player2_id)
    })

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
      league_id: league.id,
      current_rating: result.new_rating,
      matches_played: result.matches_played,
      is_provisional: result.is_provisional,
      last_updated_at: new Date().toISOString()
    }))

    // Use upsert to insert or update ratings
    const { error: updateError } = await supabase
      .from('player_ratings')
      .upsert(ratingUpdates, {
        onConflict: 'player_id,league_id',
        ignoreDuplicates: false
      })

    if (updateError) {
      console.error('Error updating ratings:', updateError)
      return NextResponse.json({ error: 'Failed to update ratings' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Ratings recalculated successfully',
      league: {
        id: league.id,
        name: league.name
      },
      updated_players: ratingResults.length,
      total_matches_processed: matchResults.length
    })

  } catch (error) {
    console.error('Rating recalculation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

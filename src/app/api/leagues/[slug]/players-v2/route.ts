import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic behavior to prevent caching
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface SupabaseMatchData {
  id: string
  player1_score: number | null
  player2_score: number | null
  status: string
  completed_at: string | null
  tournament_id: string
}

interface SupabaseRatingData {
  current_rating: number
  matches_played: number
  is_provisional: boolean
}

interface SupabaseParticipantData {
  id: string
  name: string
  email: string | null
  league_id: string
  player1_matches?: SupabaseMatchData[]
  player2_matches?: SupabaseMatchData[]
  player_ratings?: SupabaseRatingData[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const timestamp = new Date().toISOString()
  const requestId = Math.random().toString(36).substring(7)
  
  console.log(`[${timestamp}] [${requestId}] GET /api/leagues/${params.slug}/players-v2 - Starting request`)
  
  try {
    const { slug } = params
    const { searchParams } = new URL(request.url)
    const tournamentId = searchParams.get('tournamentId')

    if (!tournamentId) {
      return NextResponse.json(
        { error: 'Tournament ID is required' },
        { status: 400 }
      )
    }

    // Fetch league info
    console.log(`[${timestamp}] [${requestId}] Fetching league data for slug: ${slug}`)
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      console.log(`[${timestamp}] [${requestId}] League not found for slug: ${slug}`, leagueError)
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    console.log(`[${timestamp}] [${requestId}] Found league:`, { id: league.id, name: league.name })

    // Verify tournament exists and belongs to the league
    console.log(`[${timestamp}] [${requestId}] Fetching tournament: ${tournamentId}`)
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, name, slug, status, tournament_type')
      .eq('id', tournamentId)
      .eq('league_id', league.id)
      .single()

    if (tournamentError || !tournament) {
      console.log(`[${timestamp}] [${requestId}] Tournament not found: ${tournamentId}`, tournamentError)
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    console.log(`[${timestamp}] [${requestId}] Found tournament:`, { id: tournament.id, name: tournament.name })

    // First get participant IDs for the tournament
    console.log(`[${timestamp}] [${requestId}] Fetching tournament participants for tournament: ${tournament.id}`)
    const { data: tournamentParticipants, error: tournamentParticipantsError } = await supabase
      .from('tournament_participants')
      .select('participant_id')
      .eq('tournament_id', tournament.id)

    if (tournamentParticipantsError) {
      console.error(`[${timestamp}] [${requestId}] Error fetching tournament participants:`, tournamentParticipantsError)
      return NextResponse.json(
        { error: 'Failed to fetch tournament participants' },
        { status: 500 }
      )
    }

    const participantIds = tournamentParticipants?.map(tp => tp.participant_id) || []
    console.log(`[${timestamp}] [${requestId}] Found ${participantIds.length} participants in tournament`)

    if (participantIds.length === 0) {
      console.log(`[${timestamp}] [${requestId}] No participants found, returning empty result`)
      const emptyResponse = NextResponse.json({
        league: {
          id: league.id,
          name: league.name
        },
        tournament: {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status,
          tournament_type: tournament.tournament_type
        },
        players: [],
        total: 0
      })

      // Set cache-control headers to prevent caching
      emptyResponse.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0')
      emptyResponse.headers.set('CDN-Cache-Control', 'no-store')
      emptyResponse.headers.set('Vercel-CDN-Cache-Control', 'no-store')
      emptyResponse.headers.set('Pragma', 'no-cache')
      emptyResponse.headers.set('Expires', '0')
      emptyResponse.headers.set('Surrogate-Control', 'no-store')
      emptyResponse.headers.set('Vary', '*')

      return emptyResponse
    }

    // Fetch participants for tournament with calculated stats and ratings
    console.log(`[${timestamp}] [${requestId}] Fetching participant data with matches and ratings`)
    const { data: participantsData, error: participantsError } = await supabase
      .from('participants')
      .select(`
        *,
        player1_matches:matches!matches_player1_id_fkey(id, player1_score, player2_score, status, completed_at, tournament_id),
        player2_matches:matches!matches_player2_id_fkey(id, player1_score, player2_score, status, completed_at, tournament_id),
        player_ratings!player_ratings_player_id_fkey(current_rating, matches_played, is_provisional)
      `)
      .eq('league_id', league.id)
      .in('id', participantIds)
      .order('updated_at', { ascending: false }) // Force fresh query by adding ordering

    if (participantsError) {
      console.error(`[${timestamp}] [${requestId}] Error fetching participants:`, participantsError)
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      )
    }

    console.log(`[${timestamp}] [${requestId}] Found ${participantsData?.length || 0} participants with match data`)

    // Helper function to calculate current winning streak (only for current tournament)
    const calculateWinningStreak = (player1Matches: SupabaseMatchData[], player2Matches: SupabaseMatchData[], playerId: string) => {
      // Combine all completed matches from current tournament with their results
      const allMatches: { completed_at: string, isWin: boolean }[] = []

      // Process matches where player was player1 (only current tournament)
      player1Matches.forEach(m => {
        if (m.status === 'completed' && m.completed_at && m.tournament_id === tournament.id) {
          const player1_sets = m.player1_score || 0
          const player2_sets = m.player2_score || 0
          allMatches.push({
            completed_at: m.completed_at,
            isWin: player1_sets > player2_sets
          })
        }
      })

      // Process matches where player was player2 (only current tournament)
      player2Matches.forEach(m => {
        if (m.status === 'completed' && m.completed_at && m.tournament_id === tournament.id) {
          const player1_sets = m.player1_score || 0
          const player2_sets = m.player2_score || 0
          allMatches.push({
            completed_at: m.completed_at,
            isWin: player2_sets > player1_sets
          })
        }
      })

      // Sort by completion date (most recent first)
      allMatches.sort((a, b) => new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime())

      // Count consecutive wins from most recent matches
      let streak = 0
      for (const match of allMatches) {
        if (match.isWin) {
          streak++
        } else {
          break // Stop at first loss
        }
      }

      return streak
    }

    const participants = (participantsData as SupabaseParticipantData[]).map((p: SupabaseParticipantData) => {
      // Filter matches to only include those from the current tournament
      const completedMatches1 = p.player1_matches?.filter((m: SupabaseMatchData) => 
        m.status === 'completed' && m.tournament_id === tournament.id
      ) || []
      const completedMatches2 = p.player2_matches?.filter((m: SupabaseMatchData) => 
        m.status === 'completed' && m.tournament_id === tournament.id
      ) || []
      
      let wins = 0
      let losses = 0
      let sets_won = 0
      let sets_lost = 0

      completedMatches1.forEach((m: SupabaseMatchData) => {
        const player1_sets = m.player1_score || 0
        const player2_sets = m.player2_score || 0
        
        sets_won += player1_sets
        sets_lost += player2_sets
        
        if (player1_sets > player2_sets) wins++
        else losses++
      })

      completedMatches2.forEach((m: SupabaseMatchData) => {
        const player1_sets = m.player1_score || 0
        const player2_sets = m.player2_score || 0
        
        sets_won += player2_sets
        sets_lost += player1_sets
        
        if (player2_sets > player1_sets) wins++
        else losses++
      })

      // Calculate current winning streak
      const winning_streak = calculateWinningStreak(p.player1_matches || [], p.player2_matches || [], p.id)

      const set_diff = sets_won - sets_lost
      const points = wins * 2

      // Get rating information
      const ratingData = p.player_ratings?.[0]
      
      // Only use fallback values when no rating record exists
      // If rating record exists, use the actual values from database
      let current_rating, is_provisional
      if (ratingData) {
        current_rating = ratingData.current_rating
        is_provisional = ratingData.is_provisional
      } else {
        // No rating record exists, use defaults
        current_rating = 1200
        is_provisional = true
      }
      
      const total_matches = wins + losses

      return {
        id: p.id,
        name: p.name,
        email: p.email,
        wins,
        losses,
        sets_won,
        sets_lost,
        set_diff,
        points,
        current_rating,
        is_provisional,
        total_matches,
        winning_streak
      }
    })

    // Sort participants based on tournament type
    if (tournament.tournament_type === 'exhibition') {
      // For exhibition tournaments, sort by rating (descending), then by win rate, then by name
      participants.sort((a, b) => {
        // Primary sort: by rating (descending)
        if (a.current_rating !== b.current_rating) return b.current_rating - a.current_rating
        
        // Secondary sort: by win rate (descending)
        const aWinRate = (a.wins + a.losses) > 0 ? a.wins / (a.wins + a.losses) : 0
        const bWinRate = (b.wins + b.losses) > 0 ? b.wins / (b.wins + b.losses) : 0
        if (aWinRate !== bWinRate) return bWinRate - aWinRate
        
        // Tertiary sort: alphabetically by name (ascending)
        return a.name.localeCompare(b.name)
      })
    } else {
      // For competitive tournaments, sort by points (descending), then by set diff (descending), then alphabetically by name (ascending)
      participants.sort((a, b) => {
        // Primary sort: by points (descending)
        if (a.points !== b.points) return b.points - a.points
        
        // Secondary sort: by set difference (descending)
        if (a.set_diff !== b.set_diff) return b.set_diff - a.set_diff
        
        // Tertiary sort: alphabetically by name (ascending)
        return a.name.localeCompare(b.name)
      })
    }

    console.log(`[${timestamp}] [${requestId}] Successfully calculated tournament rankings for ${participants.length} participants`)

    const response = NextResponse.json({
      league: {
        id: league.id,
        name: league.name
      },
      tournament: {
        id: tournament.id,
        name: tournament.name,
        slug: tournament.slug,
        status: tournament.status,
        tournament_type: tournament.tournament_type
      },
      players: participants,
      total: participants.length,
      // Add timestamp for debugging
      generated_at: timestamp,
      request_id: requestId
    })

    // Set comprehensive cache-control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0, s-maxage=0')
    response.headers.set('CDN-Cache-Control', 'no-store')
    response.headers.set('Vercel-CDN-Cache-Control', 'no-store')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')
    response.headers.set('Surrogate-Control', 'no-store')
    response.headers.set('Vary', '*')

    console.log(`[${timestamp}] [${requestId}] Returning response with ${participants.length} players`)
    return response

  } catch (error) {
    console.error(`[${timestamp}] [${requestId}] Error in players-v2 API:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

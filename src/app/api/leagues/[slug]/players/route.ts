import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface SupabaseMatchData {
  id: string
  player1_score: number | null
  player2_score: number | null
  status: string
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
  try {
    const { slug } = params

    // Fetch league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Get active season for the league
    const { data: activeSeason, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('league_id', league.id)
      .eq('is_active', true)
      .single()

    if (seasonError || !activeSeason) {
      return NextResponse.json(
        { error: 'No active season found' },
        { status: 404 }
      )
    }

    // First get participant IDs for the active season
    const { data: seasonParticipants, error: seasonParticipantsError } = await supabase
      .from('season_participants')
      .select('participant_id')
      .eq('season_id', activeSeason.id)

    if (seasonParticipantsError) {
      console.error('Error fetching season participants:', seasonParticipantsError)
      return NextResponse.json(
        { error: 'Failed to fetch season participants' },
        { status: 500 }
      )
    }

    const participantIds = seasonParticipants?.map(sp => sp.participant_id) || []

    if (participantIds.length === 0) {
      return NextResponse.json({
        league: {
          id: league.id,
          name: league.name
        },
        players: [],
        total: 0
      })
    }

    // Fetch participants for active season with calculated stats and ratings
    const { data: participantsData, error: participantsError } = await supabase
      .from('participants')
      .select(`
        *,
        player1_matches:matches!matches_player1_id_fkey(id, player1_score, player2_score, status),
        player2_matches:matches!matches_player2_id_fkey(id, player1_score, player2_score, status),
        player_ratings!player_ratings_player_id_fkey(current_rating, matches_played, is_provisional)
      `)
      .eq('league_id', league.id)
      .in('id', participantIds)

    if (participantsError) {
      console.error('Error fetching participants:',   )
      return NextResponse.json(
        { error: 'Failed to fetch participants' },
        { status: 500 }
      )
    }

    const participants = (participantsData as SupabaseParticipantData[]).map((p: SupabaseParticipantData) => {
      const completedMatches1 = p.player1_matches?.filter((m: SupabaseMatchData) => m.status === 'completed') || []
      const completedMatches2 = p.player2_matches?.filter((m: SupabaseMatchData) => m.status === 'completed') || []
      
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
        total_matches
      }
    })

    // Sort by rating (descending), then by points (descending), then by set diff (descending), then alphabetically by name (ascending)
    participants.sort((a, b) => {
      if (a.points !== b.points) return b.points - a.points
      if (a.set_diff !== b.set_diff) return b.set_diff - a.set_diff
      return a.name.localeCompare(b.name)
    })

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name
      },
      players: participants,
      total: participants.length
    })

  } catch (error) {
    console.error('Error in players API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

interface PlayerMatch {
  id: string
  opponent: {
    id: string
    name: string
  }
  player_score: number
  opponent_score: number
  result: 'win' | 'loss'
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
}

interface MatchData {
  id: string
  player1_id: string
  player2_id: string
  player1_score: number | null
  player2_score: number | null
  status: string
  scheduled_at: string | null
  completed_at: string | null
  player1: {
    id: string
    name: string
  }
  player2: {
    id: string
    name: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; playerId: string } }
) {
  try {
    const { slug, playerId } = params

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Verify player exists in this league
    const { data: player, error: playerError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('id', playerId)
      .eq('league_id', league.id)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found in this league' }, { status: 404 })
    }

    // Get all matches for this player
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        player1_id,
        player2_id,
        player1_score,
        player2_score,
        status,
        scheduled_at,
        completed_at,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .eq('league_id', league.id)
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('scheduled_at', { ascending: false, nullsFirst: false })

    if (matchesError) {
      console.error('Error fetching player matches:', matchesError)
      return NextResponse.json({ error: 'Failed to fetch match data' }, { status: 500 })
    }

    // Transform matches into PlayerMatch format
    const playerMatches: PlayerMatch[] = (matches || []).map((match: any) => {
      const isPlayer1 = match.player1_id === playerId
      
      // Handle the case where Supabase returns player data as arrays or objects
      const player1Data = Array.isArray(match.player1) ? match.player1[0] : match.player1
      const player2Data = Array.isArray(match.player2) ? match.player2[0] : match.player2
      
      // Ensure we have valid opponent data
      const opponent = isPlayer1 ? player2Data : player1Data
      if (!opponent || !opponent.id || !opponent.name) {
        console.warn('Missing opponent data for match:', match.id)
        return null
      }
      
      const playerScore = isPlayer1 ? (match.player1_score || 0) : (match.player2_score || 0)
      const opponentScore = isPlayer1 ? (match.player2_score || 0) : (match.player1_score || 0)
      
      let result: 'win' | 'loss' = 'loss'
      if (match.status === 'completed' && playerScore > opponentScore) {
        result = 'win'
      }

      return {
        id: match.id,
        opponent: {
          id: opponent.id,
          name: opponent.name
        },
        player_score: playerScore,
        opponent_score: opponentScore,
        result,
        status: match.status as 'scheduled' | 'in_progress' | 'completed' | 'cancelled',
        scheduled_at: match.scheduled_at,
        completed_at: match.completed_at
      }
    }).filter(Boolean) as PlayerMatch[]

    return NextResponse.json({
      player: {
        id: player.id,
        name: player.name
      },
      matches: playerMatches
    })

  } catch (error) {
    console.error('Player matches API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

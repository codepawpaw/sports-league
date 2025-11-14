import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

interface UserMatch {
  id: string
  opponent: {
    id: string
    name: string
  }
  player_score: number | null
  opponent_score: number | null
  result?: 'win' | 'loss'
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
}

interface MyMatchesResponse {
  user_player: {
    id: string
    name: string
  } | null
  upcoming_matches: UserMatch[]
  completed_matches: UserMatch[]
  has_claim: boolean
  league: {
    id: string
    name: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Check if user has an approved claim for this league
    const { data: approvedClaim, error: claimError } = await supabase
      .from('player_claims')
      .select(`
        id,
        player_id,
        status,
        player:participants(id, name)
      `)
      .eq('league_id', league.id)
      .eq('claimer_email', user.email)
      .eq('status', 'approved')
      .single()

    const response: MyMatchesResponse = {
      user_player: null,
      upcoming_matches: [],
      completed_matches: [],
      has_claim: !!approvedClaim,
      league: {
        id: league.id,
        name: league.name
      }
    }

    if (!approvedClaim || !approvedClaim.player) {
      // User has no approved claim, return empty response
      return NextResponse.json(response)
    }

    // User has an approved claim, get their matches
    const playerData = Array.isArray(approvedClaim.player) ? approvedClaim.player[0] : approvedClaim.player
    
    if (!playerData) {
      return NextResponse.json(response)
    }

    response.user_player = {
      id: playerData.id,
      name: playerData.name
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
      .or(`player1_id.eq.${playerData.id},player2_id.eq.${playerData.id}`)
      .order('completed_at', { ascending: false, nullsFirst: false })
      .order('scheduled_at', { ascending: false, nullsFirst: false })

    if (matchesError) {
      console.error('Error fetching player matches:', matchesError)
      return NextResponse.json({ error: 'Failed to fetch match data' }, { status: 500 })
    }

    // Transform matches into UserMatch format
    const transformedMatches: UserMatch[] = (matches || []).map((match: any) => {
      const isPlayer1 = match.player1_id === playerData.id
      
      // Handle the case where Supabase returns player data as arrays or objects
      const player1Data = Array.isArray(match.player1) ? match.player1[0] : match.player1
      const player2Data = Array.isArray(match.player2) ? match.player2[0] : match.player2
      
      // Ensure we have valid opponent data
      const opponent = isPlayer1 ? player2Data : player1Data
      if (!opponent || !opponent.id || !opponent.name) {
        console.warn('Missing opponent data for match:', match.id)
        return null
      }
      
      const playerScore = isPlayer1 ? match.player1_score : match.player2_score
      const opponentScore = isPlayer1 ? match.player2_score : match.player1_score
      
      let result: 'win' | 'loss' | undefined
      if (match.status === 'completed' && playerScore !== null && opponentScore !== null) {
        result = playerScore > opponentScore ? 'win' : 'loss'
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
    }).filter(Boolean) as UserMatch[]

    // Split matches into upcoming and completed
    response.upcoming_matches = transformedMatches.filter(match => 
      match.status === 'scheduled' || match.status === 'in_progress'
    )

    response.completed_matches = transformedMatches.filter(match => 
      match.status === 'completed'
    )

    return NextResponse.json(response)

  } catch (error) {
    console.error('My matches API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

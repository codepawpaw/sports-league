import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const supabase = createSupabaseServerClient()

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Fetch all completed matches for this league
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        player1_score,
        player2_score,
        completed_at,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .eq('league_id', league.id)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })

    if (matchesError) {
      console.error('Error fetching completed matches:', matchesError)
      return NextResponse.json({ error: 'Failed to fetch match results' }, { status: 500 })
    }

    // Transform matches to include winner information
    const matchResults = (matches || []).map(match => {
      const player1Score = match.player1_score || 0
      const player2Score = match.player2_score || 0
      
      // Handle the case where Supabase returns player data as arrays or objects
      const player1Data = Array.isArray(match.player1) ? match.player1[0] : match.player1
      const player2Data = Array.isArray(match.player2) ? match.player2[0] : match.player2
      
      return {
        id: match.id,
        player1: player1Data,
        player2: player2Data,
        player1_score: player1Score,
        player2_score: player2Score,
        winner_id: player1Score > player2Score ? player1Data.id : player2Data.id,
        completed_at: match.completed_at
      }
    })

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name
      },
      matches: matchResults,
      total: matchResults.length
    })

  } catch (error) {
    console.error('Results API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

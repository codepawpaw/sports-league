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

    // Fetch all upcoming matches for this league (scheduled and in_progress)
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        player1_score,
        player2_score,
        status,
        scheduled_at,
        created_at,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .eq('league_id', league.id)
      .in('status', ['scheduled', 'in_progress'])
      .order('scheduled_at', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: true })

    if (matchesError) {
      console.error('Error fetching upcoming matches:', matchesError)
      return NextResponse.json({ error: 'Failed to fetch upcoming matches' }, { status: 500 })
    }

    // Transform matches to ensure proper data structure
    const upcomingMatches = (matches || []).map(match => {
      // Handle the case where Supabase returns player data as arrays or objects
      const player1Data = Array.isArray(match.player1) ? match.player1[0] : match.player1
      const player2Data = Array.isArray(match.player2) ? match.player2[0] : match.player2
      
      return {
        id: match.id,
        player1: player1Data,
        player2: player2Data,
        player1_score: match.player1_score,
        player2_score: match.player2_score,
        status: match.status,
        scheduled_at: match.scheduled_at,
        created_at: match.created_at
      }
    })

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name
      },
      matches: upcomingMatches,
      total: upcomingMatches.length
    })

  } catch (error) {
    console.error('Upcoming matches API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

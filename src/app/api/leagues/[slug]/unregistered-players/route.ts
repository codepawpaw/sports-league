import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

interface UnregisteredPlayer {
  id: string
  name: string
}

interface UnregisteredPlayersResponse {
  players: UnregisteredPlayer[]
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

    // Get current user (must be authenticated to view this)
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

    // Get participants without an email (unregistered players)
    const { data: unregisteredPlayers, error: playersError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('league_id', league.id)
      .is('email', null)
      .order('name')

    if (playersError) {
      console.error('Error fetching unregistered players:', playersError)
      return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 })
    }

    const response: UnregisteredPlayersResponse = {
      players: unregisteredPlayers || [],
      league: {
        id: league.id,
        name: league.name
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Unregistered players API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

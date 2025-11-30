import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; tournamentSlug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug, tournamentSlug } = params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Get league first
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Build query for tournament matches
    let query = supabase
      .from('matches')
      .select(`
        *,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .eq('tournament_id', tournament.id)
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status && ['scheduled', 'in_progress', 'completed', 'cancelled'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: matches, error: matchesError } = await query

    if (matchesError) {
      console.error('Error fetching tournament matches:', matchesError)
      return NextResponse.json(
        { error: 'Failed to fetch tournament matches' },
        { status: 500 }
      )
    }

    return NextResponse.json({ matches })
  } catch (error) {
    console.error('Error in GET /api/leagues/[slug]/tournaments/[tournamentSlug]/matches:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; tournamentSlug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug, tournamentSlug } = params

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get league and verify admin access
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    const { data: adminData } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email)
      .single()

    if (!adminData) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    const { player1_id, player2_id, scheduled_at } = await request.json()

    // Validate required fields
    if (!player1_id || !player2_id) {
      return NextResponse.json(
        { error: 'Both players are required' },
        { status: 400 }
      )
    }

    if (player1_id === player2_id) {
      return NextResponse.json(
        { error: 'Players must be different' },
        { status: 400 }
      )
    }

    // Verify both players are in this tournament
    const { data: tournamentParticipants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select('participant_id')
      .eq('tournament_id', tournament.id)
      .in('participant_id', [player1_id, player2_id])

    if (participantsError || !tournamentParticipants || tournamentParticipants.length !== 2) {
      return NextResponse.json(
        { error: 'Both players must be participants in this tournament' },
        { status: 400 }
      )
    }

    // Create the match
    const { data: newMatch, error: matchError } = await supabase
      .from('matches')
      .insert({
        league_id: league.id,
        tournament_id: tournament.id,
        player1_id,
        player2_id,
        scheduled_at: scheduled_at ? new Date(scheduled_at).toISOString() : null,
        status: 'scheduled'
      })
      .select(`
        *,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .single()

    if (matchError) {
      console.error('Error creating tournament match:', matchError)
      return NextResponse.json(
        { error: 'Failed to create match' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      match: newMatch,
      message: 'Tournament match created successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/leagues/[slug]/tournaments/[tournamentSlug]/matches:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

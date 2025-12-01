import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string; tournamentSlug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug, tournamentSlug } = params

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

    // Get tournament with participant count
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select(`
        *,
        tournament_participants(count)
      `)
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Get tournament participants with participant details
    const { data: participants, error: participantsError } = await supabase
      .from('tournament_participants')
      .select(`
        *,
        participants:participant_id (
          id,
          name,
          email
        )
      `)
      .eq('tournament_id', tournament.id)
      .order('joined_at', { ascending: true })

    if (participantsError) {
      console.error('Error fetching tournament participants:', participantsError)
      return NextResponse.json(
        { error: 'Failed to fetch tournament participants' },
        { status: 500 }
      )
    }

    // Get tournament matches
    const { data: matches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        *,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .eq('tournament_id', tournament.id)
      .order('created_at', { ascending: false })

    if (matchesError) {
      console.error('Error fetching tournament matches:', matchesError)
      return NextResponse.json(
        { error: 'Failed to fetch tournament matches' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tournament: {
        ...tournament,
        participant_count: tournament.tournament_participants[0]?.count || 0
      },
      participants: participants?.map(tp => ({
        id: tp.id,
        participant: tp.participants,
        joined_at: tp.joined_at,
        seed_position: tp.seed_position
      })) || [],
      matches: matches || []
    })
  } catch (error) {
    console.error('Error in GET /api/leagues/[slug]/tournaments/[tournamentSlug]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
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

    const updateData = await request.json()
    const allowedFields = [
      'name', 'description', 'status', 'start_date', 'end_date', 
      'max_participants', 'auto_generate_matches', 'settings'
    ]

    // Filter update data to only allowed fields
    const filteredData: any = {}
    for (const field of allowedFields) {
      if (updateData[field] !== undefined) {
        filteredData[field] = updateData[field]
      }
    }

    // Validate status if provided
    if (filteredData.status && !['upcoming', 'active', 'completed', 'cancelled'].includes(filteredData.status)) {
      return NextResponse.json(
        { error: 'Invalid tournament status' },
        { status: 400 }
      )
    }

    // Check for active tournament constraint
    if (filteredData.status === 'active') {
      const { data: activeTournaments, error: activeCheckError } = await supabase
        .from('tournaments')
        .select('id, name')
        .eq('league_id', league.id)
        .eq('status', 'active')
        .neq('id', tournament.id)

      if (activeCheckError) {
        console.error('Error checking for active tournaments:', activeCheckError)
        return NextResponse.json(
          { error: 'Failed to validate tournament status' },
          { status: 500 }
        )
      }

      if (activeTournaments && activeTournaments.length > 0) {
        return NextResponse.json(
          { error: `Cannot activate tournament. There is already an active tournament: "${activeTournaments[0].name}". Please complete or cancel the current active tournament first.` },
          { status: 400 }
        )
      }
    }

    // Update tournament
    const { data: updatedTournament, error: updateError } = await supabase
      .from('tournaments')
      .update(filteredData)
      .eq('id', tournament.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating tournament:', updateError)
      return NextResponse.json(
        { error: 'Failed to update tournament' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tournament: updatedTournament,
      message: 'Tournament updated successfully'
    })
  } catch (error) {
    console.error('Error in PUT /api/leagues/[slug]/tournaments/[tournamentSlug]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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
      .select('id, name')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Delete tournament (this will cascade to tournament_participants and matches)
    const { error: deleteError } = await supabase
      .from('tournaments')
      .delete()
      .eq('id', tournament.id)

    if (deleteError) {
      console.error('Error deleting tournament:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete tournament' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: `Tournament "${tournament.name}" deleted successfully`
    })
  } catch (error) {
    console.error('Error in DELETE /api/leagues/[slug]/tournaments/[tournamentSlug]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

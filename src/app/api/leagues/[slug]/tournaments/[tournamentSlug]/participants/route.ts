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

    // Get tournament
    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, max_participants')
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
    const { data: tournamentParticipants, error: participantsError } = await supabase
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

    // Get all league participants not in this tournament
    const participantIds = tournamentParticipants?.map(tp => tp.participant_id) || []
    
    let availableQuery = supabase
      .from('participants')
      .select('id, name, email')
      .eq('league_id', league.id)
      .order('name')

    if (participantIds.length > 0) {
      availableQuery = availableQuery.not('id', 'in', `(${participantIds.join(',')})`)
    }

    const { data: availableParticipants, error: availableError } = await availableQuery

    if (availableError) {
      console.error('Error fetching available participants:', availableError)
      return NextResponse.json(
        { error: 'Failed to fetch available participants' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tournament_participants: tournamentParticipants?.map(tp => ({
        id: tp.id,
        participant: tp.participants,
        joined_at: tp.joined_at,
        seed_position: tp.seed_position
      })) || [],
      available_participants: availableParticipants || [],
      max_participants: tournament.max_participants,
      current_count: tournamentParticipants?.length || 0
    })
  } catch (error) {
    console.error('Error in GET /api/leagues/[slug]/tournaments/[tournamentSlug]/participants:', error)
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
      .select('id, max_participants, status')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    const { participant_ids, seed_positions } = await request.json()

    if (!participant_ids || !Array.isArray(participant_ids) || participant_ids.length === 0) {
      return NextResponse.json(
        { error: 'Participant IDs are required' },
        { status: 400 }
      )
    }

    // Check if tournament has reached max participants
    if (tournament.max_participants) {
      const { count } = await supabase
        .from('tournament_participants')
        .select('*', { count: 'exact', head: true })
        .eq('tournament_id', tournament.id)

      if (count && count + participant_ids.length > tournament.max_participants) {
        return NextResponse.json(
          { error: `Tournament is limited to ${tournament.max_participants} participants` },
          { status: 400 }
        )
      }
    }

    // Verify all participants exist and belong to the league
    const { data: participants, error: participantsError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .in('id', participant_ids)

    if (participantsError || !participants || participants.length !== participant_ids.length) {
      return NextResponse.json(
        { error: 'One or more participants not found or do not belong to this league' },
        { status: 400 }
      )
    }

    // Prepare tournament participant records
    const tournamentParticipants = participant_ids.map((participantId: string, index: number) => ({
      tournament_id: tournament.id,
      participant_id: participantId,
      seed_position: seed_positions && seed_positions[index] ? seed_positions[index] : null
    }))

    // Insert tournament participants
    const { data: newParticipants, error: insertError } = await supabase
      .from('tournament_participants')
      .insert(tournamentParticipants)
      .select(`
        *,
        participants:participant_id (
          id,
          name,
          email
        )
      `)

    if (insertError) {
      console.error('Error adding tournament participants:', insertError)
      return NextResponse.json(
        { error: 'Failed to add participants to tournament' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      participants: newParticipants?.map(tp => ({
        id: tp.id,
        participant: tp.participants,
        joined_at: tp.joined_at,
        seed_position: tp.seed_position
      })) || [],
      message: `Successfully added ${participant_ids.length} participant(s) to tournament`
    })
  } catch (error) {
    console.error('Error in POST /api/leagues/[slug]/tournaments/[tournamentSlug]/participants:', error)
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
    const { searchParams } = new URL(request.url)
    const participantId = searchParams.get('participant_id')

    if (!participantId) {
      return NextResponse.json(
        { error: 'Participant ID is required' },
        { status: 400 }
      )
    }

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

    // Remove participant from tournament
    const { error: deleteError } = await supabase
      .from('tournament_participants')
      .delete()
      .eq('tournament_id', tournament.id)
      .eq('participant_id', participantId)

    if (deleteError) {
      console.error('Error removing tournament participant:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove participant from tournament' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Participant removed from tournament successfully'
    })
  } catch (error) {
    console.error('Error in DELETE /api/leagues/[slug]/tournaments/[tournamentSlug]/participants:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

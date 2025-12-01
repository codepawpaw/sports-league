import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string; tournamentSlug: string; challengeId: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug, tournamentSlug, challengeId } = params

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get league
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
      .select('id, tournament_type, status')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Check if tournament is exhibition type
    if (tournament.tournament_type !== 'exhibition') {
      return NextResponse.json(
        { error: 'Challenges are only available for exhibition tournaments' },
        { status: 400 }
      )
    }

    const { action } = await request.json()

    if (!action || !['accept', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Valid action (accept or reject) is required' },
        { status: 400 }
      )
    }

    // Get current participant
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email!)
      .single()

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      )
    }

    // Get the challenge and verify permissions
    const { data: challenge, error: challengeError } = await supabase
      .from('tournament_challenges')
      .select(`
        *,
        challenger_participant:challenger_participant_id (
          id,
          name
        ),
        challenged_participant:challenged_participant_id (
          id,
          name
        )
      `)
      .eq('id', challengeId)
      .eq('tournament_id', tournament.id)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      )
    }

    // Only the challenged participant can respond to the challenge
    if (challenge.challenged_participant_id !== participant.id) {
      return NextResponse.json(
        { error: 'You can only respond to challenges sent to you' },
        { status: 403 }
      )
    }

    // Check if challenge is still pending
    if (challenge.status !== 'pending') {
      return NextResponse.json(
        { error: 'Challenge has already been responded to' },
        { status: 400 }
      )
    }

    // Update challenge status
    const newStatus = action === 'accept' ? 'accepted' : 'rejected'
    const { error: updateError } = await supabase
      .from('tournament_challenges')
      .update({ 
        status: newStatus,
        responded_at: new Date().toISOString()
      })
      .eq('id', challengeId)

    if (updateError) {
      console.error('Error updating challenge:', updateError)
      return NextResponse.json(
        { error: 'Failed to update challenge' },
        { status: 500 }
      )
    }

    // If accepted, create a match
    if (action === 'accept') {
      const { data: newMatch, error: matchError } = await supabase
        .from('matches')
        .insert({
          league_id: league.id,
          tournament_id: tournament.id,
          player1_id: challenge.challenger_participant_id,
          player2_id: challenge.challenged_participant_id,
          status: 'scheduled',
          scheduled_at: null // Will be scheduled later
        })
        .select()
        .single()

      if (matchError) {
        console.error('Error creating match:', matchError)
        return NextResponse.json(
          { error: 'Challenge accepted but failed to create match' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        message: 'Challenge accepted and match created',
        match: newMatch
      })
    }

    return NextResponse.json({
      message: 'Challenge rejected'
    })
  } catch (error) {
    console.error('Error in PUT /api/leagues/[slug]/tournaments/[tournamentSlug]/challenges/[challengeId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; tournamentSlug: string; challengeId: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug, tournamentSlug, challengeId } = params

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get league
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
      .select('id, tournament_type')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json(
        { error: 'Tournament not found' },
        { status: 404 }
      )
    }

    // Get current participant
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email!)
      .single()

    if (participantError || !participant) {
      return NextResponse.json(
        { error: 'Participant not found' },
        { status: 404 }
      )
    }

    // Get the challenge and verify permissions
    const { data: challenge, error: challengeError } = await supabase
      .from('tournament_challenges')
      .select('*')
      .eq('id', challengeId)
      .eq('tournament_id', tournament.id)
      .single()

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      )
    }

    // Only the challenger can delete their own challenge
    if (challenge.challenger_participant_id !== participant.id) {
      return NextResponse.json(
        { error: 'You can only delete challenges you sent' },
        { status: 403 }
      )
    }

    // Can only delete pending challenges
    if (challenge.status !== 'pending') {
      return NextResponse.json(
        { error: 'You can only delete pending challenges' },
        { status: 400 }
      )
    }

    // Delete the challenge
    const { error: deleteError } = await supabase
      .from('tournament_challenges')
      .delete()
      .eq('id', challengeId)

    if (deleteError) {
      console.error('Error deleting challenge:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete challenge' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Challenge deleted successfully'
    })
  } catch (error) {
    console.error('Error in DELETE /api/leagues/[slug]/tournaments/[tournamentSlug]/challenges/[challengeId]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

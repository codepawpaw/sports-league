import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
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

    // Check if tournament is exhibition type
    if (tournament.tournament_type !== 'exhibition') {
      return NextResponse.json(
        { error: 'Challenges are only available for exhibition tournaments' },
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

    // Verify participant is in the tournament
    const { data: tournamentParticipant } = await supabase
      .from('tournament_participants')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('participant_id', participant.id)
      .single()

    if (!tournamentParticipant) {
      return NextResponse.json(
        { error: 'You are not a participant in this tournament' },
        { status: 403 }
      )
    }

    // Get challenges sent by current participant
    const { data: sentChallenges, error: sentError } = await supabase
      .from('tournament_challenges')
      .select(`
        *,
        challenged_participant:challenged_participant_id (
          id,
          name
        )
      `)
      .eq('tournament_id', tournament.id)
      .eq('challenger_participant_id', participant.id)
      .order('created_at', { ascending: false })

    if (sentError) {
      console.error('Error fetching sent challenges:', sentError)
    }

    // Get challenges received by current participant
    const { data: receivedChallenges, error: receivedError } = await supabase
      .from('tournament_challenges')
      .select(`
        *,
        challenger_participant:challenger_participant_id (
          id,
          name
        )
      `)
      .eq('tournament_id', tournament.id)
      .eq('challenged_participant_id', participant.id)
      .order('created_at', { ascending: false })

    if (receivedError) {
      console.error('Error fetching received challenges:', receivedError)
    }

    return NextResponse.json({
      sent_challenges: sentChallenges || [],
      received_challenges: receivedChallenges || []
    })
  } catch (error) {
    console.error('Error in GET /api/leagues/[slug]/tournaments/[tournamentSlug]/challenges:', error)
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

    // Check if tournament is active
    if (tournament.status !== 'active') {
      return NextResponse.json(
        { error: 'Tournament must be active to send challenges' },
        { status: 400 }
      )
    }

    const { challenged_participant_id, message } = await request.json()

    if (!challenged_participant_id) {
      return NextResponse.json(
        { error: 'Challenged participant ID is required' },
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

    // Verify both participants are in the tournament
    const { data: tournamentParticipants, error: tpError } = await supabase
      .from('tournament_participants')
      .select('participant_id')
      .eq('tournament_id', tournament.id)
      .in('participant_id', [participant.id, challenged_participant_id])

    if (tpError || !tournamentParticipants || tournamentParticipants.length !== 2) {
      return NextResponse.json(
        { error: 'Both participants must be in the tournament' },
        { status: 400 }
      )
    }

    // Check if challenger is trying to challenge themselves
    if (participant.id === challenged_participant_id) {
      return NextResponse.json(
        { error: 'You cannot challenge yourself' },
        { status: 400 }
      )
    }

    // Check for existing pending challenges between these participants
    const { data: existingChallenge } = await supabase
      .from('tournament_challenges')
      .select('id')
      .eq('tournament_id', tournament.id)
      .eq('status', 'pending')
      .or(`and(challenger_participant_id.eq.${participant.id},challenged_participant_id.eq.${challenged_participant_id}),and(challenger_participant_id.eq.${challenged_participant_id},challenged_participant_id.eq.${participant.id})`)
      .single()

    if (existingChallenge) {
      return NextResponse.json(
        { error: 'A pending challenge already exists between these participants' },
        { status: 400 }
      )
    }

    // Create the challenge
    const { data: challenge, error: challengeError } = await supabase
      .from('tournament_challenges')
      .insert({
        tournament_id: tournament.id,
        challenger_participant_id: participant.id,
        challenged_participant_id,
        message: message?.trim() || null,
        status: 'pending'
      })
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
      .single()

    if (challengeError) {
      console.error('Error creating challenge:', challengeError)
      return NextResponse.json(
        { error: 'Failed to create challenge' },
        { status: 500 }
      )
    }

    // Send Google Chat notification if enabled
    try {
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('name')
        .eq('id', league.id)
        .single()

      const { data: tournamentData } = await supabase
        .from('tournaments')
        .select('name')
        .eq('id', tournament.id)
        .single()

      if (leagueData && tournamentData && challenge.challenger_participant && challenge.challenged_participant) {
        // Send notification via our internal API endpoint
        const notificationPayload = {
          challengerName: challenge.challenger_participant.name,
          challengedName: challenge.challenged_participant.name,
          tournamentName: tournamentData.name,
          leagueName: leagueData.name,
          challengeId: challenge.id,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://sports-league-tau.vercel.app'
        }

        console.log('Sending challenge notification:', notificationPayload)
        
        // Use absolute URL for internal API calls in production
        const baseUrl = process.env.NODE_ENV === 'production' 
          ? (process.env.NEXT_PUBLIC_APP_URL || 'https://sports-league-tau.vercel.app')
          : 'http://localhost:3000'
        
        const notificationUrl = `${baseUrl}/api/leagues/${slug}/chat-integration/notify-challenge`
        
        const response = await fetch(notificationUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(notificationPayload)
        })

        const result = await response.json()
        
        if (!response.ok) {
          console.error('Challenge notification failed:', response.status, result.error)
        } else {
          console.log('Challenge notification sent successfully:', result.message)
        }
      }
    } catch (error) {
      console.error('Error sending challenge notification:', error)
      // Don't fail the challenge creation if notification fails
    }

    return NextResponse.json({
      challenge,
      message: 'Challenge sent successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/leagues/[slug]/tournaments/[tournamentSlug]/challenges:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

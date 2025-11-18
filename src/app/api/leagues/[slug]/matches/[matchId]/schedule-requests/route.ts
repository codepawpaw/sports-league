import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier } from '@/lib/googleChat'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; matchId: string } }
) {
  try {
    const { slug, matchId } = params
    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { requested_date, message } = body

    if (!requested_date) {
      return NextResponse.json({ error: 'Requested date is required' }, { status: 400 })
    }

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Get match info and verify it belongs to the league
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, league_id, status')
      .eq('id', matchId)
      .eq('league_id', league.id)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Verify match is not completed
    if (match.status === 'completed' || match.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot schedule request for completed or cancelled matches' }, { status: 400 })
    }

    // Get user's participant record
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'You are not a participant in this league' }, { status: 403 })
    }

    // Verify user is one of the players in the match
    if (match.player1_id !== participant.id && match.player2_id !== participant.id) {
      return NextResponse.json({ error: 'You are not a player in this match' }, { status: 403 })
    }

    // Determine opponent
    const opponentId = match.player1_id === participant.id ? match.player2_id : match.player1_id

    // Remove ALL existing schedule requests for this match (regardless of status)
    // This ensures only 1 row per match as requested
    const { error: deleteError } = await supabase
      .from('match_schedule_requests')
      .delete()
      .eq('match_id', matchId)

    if (deleteError) {
      console.error('Error deleting existing schedule requests:', deleteError)
      return NextResponse.json({ error: 'Failed to clean up existing schedule requests' }, { status: 500 })
    }

    // Create the schedule request
    const { data: scheduleRequest, error: createError } = await supabase
      .from('match_schedule_requests')
      .insert({
        match_id: matchId,
        requester_id: participant.id,
        opponent_id: opponentId,
        requested_date: requested_date,
        message: message || null
      })
      .select(`
        *,
        requester:participants!match_schedule_requests_requester_id_fkey(id, name),
        opponent:participants!match_schedule_requests_opponent_id_fkey(id, name),
        match:matches(
          id,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating schedule request:', createError)
      return NextResponse.json({ error: 'Failed to create schedule request' }, { status: 500 })
    }

    // Send Google Chat notification if enabled
    try {
      // Get league name and chat integration settings
      const { data: leagueDetails, error: leagueDetailsError } = await supabase
        .from('leagues')
        .select('id, name, slug')
        .eq('id', league.id)
        .single()

      // Get chat integration settings
      const { data: chatIntegration, error: chatError } = await supabase
        .from('league_chat_integrations')
        .select('webhook_url, enabled, notify_schedule_requests')
        .eq('league_id', league.id)
        .eq('enabled', true)
        .eq('notify_schedule_requests', true)
        .single()

      if (!leagueDetailsError && leagueDetails && !chatError && chatIntegration) {
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
        
        await GoogleChatNotifier.notifyScheduleRequest(chatIntegration.webhook_url, {
          leagueName: leagueDetails.name,
          player1Name: scheduleRequest.match.player1.name,
          player2Name: scheduleRequest.match.player2.name,
          requestedByName: scheduleRequest.requester.name,
          proposedAt: requested_date,
          leagueSlug: slug,
          appUrl: appUrl
        })

        console.log('Successfully sent schedule request notification to Google Chat')
      }
    } catch (error) {
      // Don't fail the request if notification fails
      console.error('Failed to send Google Chat notification for schedule request:', error)
    }

    return NextResponse.json({ 
      success: true,
      schedule_request: scheduleRequest 
    })

  } catch (error) {
    console.error('Schedule request API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

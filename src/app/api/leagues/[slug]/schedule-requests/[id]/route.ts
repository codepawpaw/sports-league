import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { slug, id } = params
    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { action } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
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

    // Get schedule request and verify user is the opponent
    const { data: scheduleRequest, error: requestError } = await supabase
      .from('match_schedule_requests')
      .select(`
        *,
        match:matches(id, league_id)
      `)
      .eq('id', id)
      .single()

    if (requestError || !scheduleRequest) {
      return NextResponse.json({ error: 'Schedule request not found' }, { status: 404 })
    }

    // Verify the request is for this league
    if (scheduleRequest.match?.league_id !== league.id) {
      return NextResponse.json({ error: 'Schedule request not found in this league' }, { status: 404 })
    }

    // Verify user is the opponent (recipient) of the request
    if (scheduleRequest.opponent_id !== participant.id) {
      return NextResponse.json({ error: 'You are not authorized to respond to this request' }, { status: 403 })
    }

    // Verify request is still pending
    if (scheduleRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This request has already been responded to' }, { status: 400 })
    }

    // Update the request status
    const newStatus = action === 'approve' ? 'approved' : 'rejected'
    const { data: updatedRequest, error: updateError } = await supabase
      .from('match_schedule_requests')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.email
      })
      .eq('id', id)
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

    if (updateError) {
      console.error('Error updating schedule request:', updateError)
      return NextResponse.json({ error: 'Failed to update schedule request' }, { status: 500 })
    }

    // If approved, update the match scheduled_at time
    if (action === 'approve') {
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          scheduled_at: scheduleRequest.requested_date
        })
        .eq('id', scheduleRequest.match_id)

      if (matchUpdateError) {
        console.error('Error updating match schedule:', matchUpdateError)
        // Note: We don't return an error here because the request was processed successfully
        // The admin can manually update the match schedule if needed
      }
    }

    return NextResponse.json({ 
      success: true,
      schedule_request: updatedRequest,
      action: action
    })

  } catch (error) {
    console.error('Schedule request response API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

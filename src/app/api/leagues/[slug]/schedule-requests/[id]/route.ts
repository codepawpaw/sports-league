import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier } from '@/lib/googleChat'

export async function DELETE(
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

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
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

    // Get schedule request and verify user is the requester
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

    // Verify user is the requester (can only delete their own requests)
    if (scheduleRequest.requester_id !== participant.id) {
      return NextResponse.json({ error: 'You can only delete your own schedule requests' }, { status: 403 })
    }

    // Verify request is still pending (can only delete pending requests)
    if (scheduleRequest.status !== 'pending') {
      return NextResponse.json({ error: 'You can only delete pending schedule requests' }, { status: 400 })
    }

    // Delete the request
    const { error: deleteError } = await supabase
      .from('match_schedule_requests')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting schedule request:', deleteError)
      return NextResponse.json({ error: 'Failed to delete schedule request' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Schedule request deleted successfully'
    })

  } catch (error) {
    console.error('Schedule request delete API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
      .select('id, name')
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

    // If approved, update the match scheduled_at time and delete the request
    if (action === 'approve') {
      // Start a transaction to ensure consistency
      const { error: transactionError } = await supabase.rpc('handle_schedule_approval', {
        p_match_id: scheduleRequest.match_id,
        p_request_id: id,
        p_new_scheduled_date: scheduleRequest.requested_date
      })

      if (transactionError) {
        // Fallback to individual operations if the stored procedure doesn't exist
        console.log('Stored procedure not found, using fallback approach')
        
        // First, delete any previous approved requests for this match
        const { error: deleteOldError } = await supabase
          .from('match_schedule_requests')
          .delete()
          .eq('match_id', scheduleRequest.match_id)
          .eq('status', 'approved')
          .neq('id', id)

        if (deleteOldError) {
          console.error('Error deleting previous approved requests:', deleteOldError)
        }

        // Update the match scheduled_at time
        const { error: matchUpdateError } = await supabase
          .from('matches')
          .update({
            scheduled_at: scheduleRequest.requested_date
          })
          .eq('id', scheduleRequest.match_id)

        if (matchUpdateError) {
          console.error('Error updating match schedule:', matchUpdateError)
          return NextResponse.json({ 
            error: 'Failed to update match schedule' 
          }, { status: 500 })
        }

        // Finally, delete the current approved request
        const { error: deleteCurrentError } = await supabase
          .from('match_schedule_requests')
          .delete()
          .eq('id', id)

        if (deleteCurrentError) {
          console.error('Error deleting current approved request:', deleteCurrentError)
          return NextResponse.json({ 
            error: 'Failed to delete approved request' 
          }, { status: 500 })
        }
      }

      // Send Google Chat notification for schedule approval
      try {
        const { data: chatIntegration, error: chatError } = await supabase
          .from('league_chat_integrations')
          .select('*')
          .eq('league_id', scheduleRequest.match?.league_id)
          .single()

        if (!chatError && chatIntegration?.enabled && chatIntegration?.notify_approved_schedules) {
          // Get app URL from environment or construct it
          const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).origin}`
          
          await GoogleChatNotifier.notifyScheduleApproved(chatIntegration.webhook_url, {
            leagueName: league.name,
            player1Name: updatedRequest.match?.player1?.name || '',
            player2Name: updatedRequest.match?.player2?.name || '',
            scheduledAt: scheduleRequest.requested_date,
            leagueSlug: slug,
            appUrl: appUrl
          })
        }
      } catch (error) {
        // Log error but don't fail the request
        console.error('Failed to send Google Chat notification:', error)
      }

      // Return success without the deleted request data for approved requests
      return NextResponse.json({ 
        success: true,
        action: action,
        message: 'Schedule request approved and match time updated'
      })
    }

    // For rejected requests, keep the current behavior of updating status
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

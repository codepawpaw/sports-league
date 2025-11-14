import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

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

    // Get score request and verify user is the requester
    const { data: scoreRequest, error: requestError } = await supabase
      .from('match_score_requests')
      .select(`
        *,
        match:matches(id, league_id)
      `)
      .eq('id', id)
      .single()

    if (requestError || !scoreRequest) {
      return NextResponse.json({ error: 'Score request not found' }, { status: 404 })
    }

    // Verify the request is for this league
    if (scoreRequest.match?.league_id !== league.id) {
      return NextResponse.json({ error: 'Score request not found in this league' }, { status: 404 })
    }

    // Verify user is the requester (can only delete their own requests)
    if (scoreRequest.requester_id !== participant.id) {
      return NextResponse.json({ error: 'You can only delete your own score requests' }, { status: 403 })
    }

    // Verify request is still pending (can only delete pending requests)
    if (scoreRequest.status !== 'pending') {
      return NextResponse.json({ error: 'You can only delete pending score requests' }, { status: 400 })
    }

    // Delete the request
    const { error: deleteError } = await supabase
      .from('match_score_requests')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting score request:', deleteError)
      return NextResponse.json({ error: 'Failed to delete score request' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Score request deleted successfully'
    })

  } catch (error) {
    console.error('Score request delete API error:', error)
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

    // Get score request and verify user is the opponent
    const { data: scoreRequest, error: requestError } = await supabase
      .from('match_score_requests')
      .select(`
        *,
        match:matches(id, league_id)
      `)
      .eq('id', id)
      .single()

    if (requestError || !scoreRequest) {
      return NextResponse.json({ error: 'Score request not found' }, { status: 404 })
    }

    // Verify the request is for this league
    if (scoreRequest.match?.league_id !== league.id) {
      return NextResponse.json({ error: 'Score request not found in this league' }, { status: 404 })
    }

    // Verify user is the opponent (recipient) of the request
    if (scoreRequest.opponent_id !== participant.id) {
      return NextResponse.json({ error: 'You are not authorized to respond to this request' }, { status: 403 })
    }

    // Verify request is still pending
    if (scoreRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This request has already been responded to' }, { status: 400 })
    }

    // If approved, update the match with final scores and complete it
    if (action === 'approve') {
      // Update the match with scores, mark as completed, and set completion timestamp
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          player1_score: scoreRequest.player1_score,
          player2_score: scoreRequest.player2_score,
          status: 'completed',
          completed_at: new Date().toISOString()
        })
        .eq('id', scoreRequest.match_id)

      if (matchUpdateError) {
        console.error('Error updating match scores:', matchUpdateError)
        return NextResponse.json({ 
          error: 'Failed to update match scores' 
        }, { status: 500 })
      }

      // Delete the approved score request
      const { error: deleteError } = await supabase
        .from('match_score_requests')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting approved score request:', deleteError)
        return NextResponse.json({ 
          error: 'Failed to delete approved request' 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true,
        action: action,
        message: 'Score request approved and match completed'
      })
    }

    // For rejected requests, update status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('match_score_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.email
      })
      .eq('id', id)
      .select(`
        *,
        requester:participants!match_score_requests_requester_id_fkey(id, name),
        opponent:participants!match_score_requests_opponent_id_fkey(id, name),
        match:matches(
          id,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating score request:', updateError)
      return NextResponse.json({ error: 'Failed to update score request' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      score_request: updatedRequest,
      action: action
    })

  } catch (error) {
    console.error('Score request response API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

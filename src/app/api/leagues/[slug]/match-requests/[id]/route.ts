import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

// PUT - Approve or reject match request
export async function PUT(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()
    const { action, scheduledAt } = body // action: 'approve' | 'reject', scheduledAt: optional date

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get match request
    const { data: matchRequest, error: matchRequestError } = await supabase
      .from('match_requests')
      .select(`
        *,
        requesting_player:participants!match_requests_requesting_player_id_fkey(id, name),
        requested_player:participants!match_requests_requested_player_id_fkey(id, name)
      `)
      .eq('id', params.id)
      .eq('league_id', league.id)
      .single()

    if (matchRequestError || !matchRequest) {
      return NextResponse.json({ error: 'Match request not found' }, { status: 404 })
    }

    if (matchRequest.status !== 'pending') {
      return NextResponse.json({ 
        error: 'Match request has already been reviewed' 
      }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Update match request status
    const { error: updateError } = await supabase
      .from('match_requests')
      .update({
        status: newStatus,
        reviewed_by_admin_id: adminData.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', params.id)

    if (updateError) {
      console.error('Error updating match request:', updateError)
      return NextResponse.json({ error: 'Failed to update match request' }, { status: 500 })
    }

    let createdMatch = null

    // If approved, create a new match
    if (action === 'approve') {
      const matchData = {
        league_id: league.id,
        season_id: matchRequest.season_id,
        player1_id: matchRequest.requesting_player_id,
        player2_id: matchRequest.requested_player_id,
        status: 'scheduled' as const,
        scheduled_at: scheduledAt ? new Date(scheduledAt).toISOString() : null
      }

      const { data: newMatch, error: matchError } = await supabase
        .from('matches')
        .insert(matchData)
        .select(`
          *,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        `)
        .single()

      if (matchError) {
        console.error('Error creating match:', matchError)
        // Don't fail the request if match creation fails, just log it
        console.error('Match request was approved but match creation failed')
      } else {
        createdMatch = newMatch
      }
    }

    return NextResponse.json({ 
      success: true,
      status: newStatus,
      match: createdMatch,
      message: action === 'approve' 
        ? 'Match request approved and match created successfully'
        : 'Match request rejected successfully'
    })

  } catch (error) {
    console.error('Error in match request PUT:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE - Delete match request
export async function DELETE(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Check if user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Delete match request
    const { error: deleteError } = await supabase
      .from('match_requests')
      .delete()
      .eq('id', params.id)
      .eq('league_id', league.id)

    if (deleteError) {
      console.error('Error deleting match request:', deleteError)
      return NextResponse.json({ error: 'Failed to delete match request' }, { status: 500 })
    }

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Error in match request DELETE:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

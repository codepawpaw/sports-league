import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

// PUT - Approve or reject match request (opponent or admin)
export async function PUT(
  request: Request,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const body = await request.json()
    const { action, scheduledAt, userRole } = body // action: 'approve' | 'reject', userRole: 'opponent' | 'admin'

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

    // Get match request first to check permissions
    const { data: matchRequest, error: matchRequestError } = await supabase
      .from('match_requests')
      .select(`
        *,
        requesting_player:participants!match_requests_requesting_player_id_fkey(id, name, email),
        requested_player:participants!match_requests_requested_player_id_fkey(id, name, email)
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

    // Check user permissions based on role
    let isAdmin = false
    let isOpponent = false
    
    // Check if user is admin
    const { data: adminData } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email)
      .single()
    
    isAdmin = !!adminData
    
    // Check if user is the requested player (opponent)
    isOpponent = matchRequest.requested_player?.email === session.user.email

    // Determine what action is allowed
    if (userRole === 'opponent') {
      if (!isOpponent) {
        return NextResponse.json({ error: 'Only the requested player can approve/reject this request' }, { status: 403 })
      }
    } else if (userRole === 'admin') {
      if (!isAdmin) {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
      // Admin can force reject anytime, but can only approve if opponent has already approved
      if (action === 'approve' && !matchRequest.opponent_approved) {
        return NextResponse.json({ 
          error: 'Cannot approve match until opponent has approved' 
        }, { status: 400 })
      }
      // Admin can force reject regardless of opponent approval status
    } else {
      return NextResponse.json({ error: 'Invalid user role specified' }, { status: 400 })
    }

    // Prepare update data based on user role and action
    let updateData: any = {}
    
    if (userRole === 'opponent') {
      if (action === 'approve') {
        updateData.opponent_approved = true
        updateData.opponent_approved_at = new Date().toISOString()
      } else {
        updateData.status = 'rejected'
        updateData.reviewed_at = new Date().toISOString()
      }
    } else if (userRole === 'admin') {
      if (action === 'approve') {
        updateData.admin_approved = true
        updateData.admin_approved_at = new Date().toISOString()
        updateData.status = 'approved'
        updateData.reviewed_by_admin_id = adminData!.id
        updateData.reviewed_at = new Date().toISOString()
      } else {
        updateData.status = 'rejected'
        updateData.reviewed_by_admin_id = adminData!.id
        updateData.reviewed_at = new Date().toISOString()
      }
    }

    // Update match request
    const { error: updateError } = await supabase
      .from('match_requests')
      .update(updateData)
      .eq('id', params.id)

    if (updateError) {
      console.error('Error updating match request:', updateError)
      return NextResponse.json({ error: 'Failed to update match request' }, { status: 500 })
    }

    let createdMatch = null
    let message = ''

    // Create match only if both opponent and admin have approved
    if (userRole === 'admin' && action === 'approve') {
      const matchData = {
        league_id: league.id,
        season_id: matchRequest.season_id,
        player1_id: matchRequest.requesting_player_id,
        player2_id: matchRequest.requested_player_id,
        status: 'scheduled' as const,
        scheduled_at: matchRequest.preferred_date || (scheduledAt ? new Date(scheduledAt).toISOString() : null)
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
        message = 'Match request approved but match creation failed'
      } else {
        createdMatch = newMatch
        message = 'Match request approved and match created successfully'
      }
    } else if (userRole === 'opponent' && action === 'approve') {
      message = 'Match request approved by opponent. Waiting for admin approval.'
    } else if (action === 'reject') {
      message = 'Match request rejected successfully'
    }

    return NextResponse.json({ 
      success: true,
      status: updateData.status || 'pending',
      match: createdMatch,
      message: message
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

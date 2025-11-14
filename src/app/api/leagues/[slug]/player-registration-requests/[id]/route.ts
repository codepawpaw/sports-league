import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

async function handleRegistrationRequest(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { slug, id } = params
    const { action } = await request.json() // 'approve' or 'reject'

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

    // Check if user is admin for this league
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get the registration request
    const { data: registrationRequest, error: requestError } = await supabase
      .from('player_registration_requests')
      .select(`
        id,
        player_id,
        claimer_email,
        status,
        player:participants(id, name, email)
      `)
      .eq('id', id)
      .eq('league_id', league.id)
      .single()

    if (requestError || !registrationRequest) {
      return NextResponse.json({ error: 'Registration request not found' }, { status: 404 })
    }

    if (registrationRequest.status !== 'pending') {
      return NextResponse.json({ error: 'Registration request has already been reviewed' }, { status: 400 })
    }

    const playerData = Array.isArray(registrationRequest.player) 
      ? registrationRequest.player[0] 
      : registrationRequest.player

    if (!playerData) {
      return NextResponse.json({ error: 'Associated player not found' }, { status: 404 })
    }

    if (action === 'approve') {
      // Start a transaction to update both tables atomically
      const { error: updateError } = await supabase.rpc('approve_player_registration', {
        request_id: id,
        player_id: registrationRequest.player_id,
        claimer_email: registrationRequest.claimer_email,
        reviewer_email: user.email
      })

      if (updateError) {
        // If we don't have the function, do it manually
        console.log('RPC function not found, doing manual update')
        
        // Update the participant's email
        const { error: participantError } = await supabase
          .from('participants')
          .update({ email: registrationRequest.claimer_email })
          .eq('id', registrationRequest.player_id)

        if (participantError) {
          console.error('Error updating participant:', participantError)
          return NextResponse.json({ error: 'Failed to register player' }, { status: 500 })
        }

        // Update the registration request status
        const { error: statusError } = await supabase
          .from('player_registration_requests')
          .update({
            status: 'approved',
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.email
          })
          .eq('id', id)

        if (statusError) {
          console.error('Error updating request status:', statusError)
          // Try to rollback the participant update
          await supabase
            .from('participants')
            .update({ email: null })
            .eq('id', registrationRequest.player_id)
          
          return NextResponse.json({ error: 'Failed to update request status' }, { status: 500 })
        }
      }

      return NextResponse.json({
        message: 'Registration request approved successfully',
        player_name: playerData.name,
        claimer_email: registrationRequest.claimer_email
      })

    } else if (action === 'reject') {
      // Update the registration request status to rejected
      // Include updated_at explicitly to handle both old and new schema versions
      const updateData = {
        status: 'rejected' as const,
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.email,
        updated_at: new Date().toISOString()
      }

      const { error: statusError } = await supabase
        .from('player_registration_requests')
        .update(updateData)
        .eq('id', id)

      if (statusError) {
        console.error('Error updating request status:', statusError)
        
        // If the error might be due to missing updated_at column, try without it
        if (statusError.message?.includes('updated_at') || statusError.message?.includes('column')) {
          console.log('Retrying without updated_at column...')
          const fallbackUpdateData = {
            status: 'rejected' as const,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.email
          }
          
          const { error: retryError } = await supabase
            .from('player_registration_requests')
            .update(fallbackUpdateData)
            .eq('id', id)
          
          if (retryError) {
            console.error('Error on retry:', retryError)
            return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 })
          }
        } else {
          return NextResponse.json({ error: 'Failed to reject request' }, { status: 500 })
        }
      }

      return NextResponse.json({
        message: 'Registration request rejected',
        player_name: playerData.name,
        claimer_email: registrationRequest.claimer_email
      })

    } else {
      return NextResponse.json({ error: 'Invalid action. Use "approve" or "reject"' }, { status: 400 })
    }

  } catch (error) {
    console.error('Update registration request API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export const PUT = handleRegistrationRequest
export const PATCH = handleRegistrationRequest

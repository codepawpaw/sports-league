import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { action } = await request.json() // 'approve' or 'reject'

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
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

    // Check if user is league admin
    const { data: admin, error: adminError } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (adminError || !admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get the claim
    const { data: claim, error: claimError } = await supabase
      .from('player_claims')
      .select(`
        id,
        player_id,
        claimer_email,
        status,
        league_id
      `)
      .eq('id', params.id)
      .eq('league_id', league.id)
      .single()

    if (claimError || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 })
    }

    if (claim.status !== 'pending') {
      return NextResponse.json({ error: 'Claim has already been reviewed' }, { status: 400 })
    }

    const newStatus = action === 'approve' ? 'approved' : 'rejected'

    // Start transaction-like operations
    if (action === 'approve') {
      // Update participant email
      const { error: participantError } = await supabase
        .from('participants')
        .update({ email: claim.claimer_email })
        .eq('id', claim.player_id)

      if (participantError) {
        console.error('Error updating participant:', participantError)
        return NextResponse.json({ error: 'Failed to update player email' }, { status: 500 })
      }
    }

    // Update claim status
    const { data: updatedClaim, error: updateError } = await supabase
      .from('player_claims')
      .update({
        status: newStatus,
        reviewed_by_admin_id: admin.id,
        reviewed_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating claim:', updateError)
      return NextResponse.json({ error: 'Failed to update claim status' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: `Claim ${action}d successfully`,
      claim: updatedClaim 
    })

  } catch (error) {
    console.error('Error in PUT /claims/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
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

    // Check if user is league admin
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Delete the claim
    const { error: deleteError } = await supabase
      .from('player_claims')
      .delete()
      .eq('id', params.id)
      .eq('league_id', league.id)

    if (deleteError) {
      console.error('Error deleting claim:', deleteError)
      return NextResponse.json({ error: 'Failed to delete claim' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Claim deleted successfully' })

  } catch (error) {
    console.error('Error in DELETE /claims/[id]:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
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

    // Check if user has any claims in this league
    const { data: userClaim, error: claimError } = await supabase
      .from('player_claims')
      .select(`
        id,
        player_id,
        status,
        requested_at,
        participants!inner (
          id,
          name,
          email
        )
      `)
      .eq('league_id', league.id)
      .eq('claimer_email', user.email)
      .maybeSingle()

    if (claimError) {
      console.error('Error fetching user claim:', claimError)
      return NextResponse.json({ error: 'Failed to fetch claim status' }, { status: 500 })
    }

    // Transform the response
    const response = {
      hasClaim: !!userClaim,
      claim: userClaim ? {
        id: userClaim.id,
        player_id: userClaim.player_id,
        status: userClaim.status,
        requested_at: userClaim.requested_at,
        player: {
          id: userClaim.participants[0].id,
          name: userClaim.participants[0].name,
          email: userClaim.participants[0].email
        }
      } : null
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Error in GET /user-claims:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

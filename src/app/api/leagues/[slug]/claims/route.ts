import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { player_id } = await request.json()

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

    // Check if player exists in this league
    const { data: player, error: playerError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('id', player_id)
      .eq('league_id', league.id)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    // Check if player already has an email
    if (player.email) {
      return NextResponse.json({ error: 'Player already has an associated email' }, { status: 400 })
    }

    // Check if this email already has a claim in this league
    const { data: existingClaim } = await supabase
      .from('player_claims')
      .select('id')
      .eq('league_id', league.id)
      .eq('claimer_email', user.email)
      .single()

    if (existingClaim) {
      return NextResponse.json({ error: 'You already have a pending or approved claim in this league' }, { status: 400 })
    }

    // Check if this player already has a claim
    const { data: existingPlayerClaim } = await supabase
      .from('player_claims')
      .select('id, status')
      .eq('player_id', player_id)
      .single()

    if (existingPlayerClaim) {
      if (existingPlayerClaim.status === 'pending') {
        return NextResponse.json({ error: 'This player already has a pending claim request' }, { status: 400 })
      }
      if (existingPlayerClaim.status === 'approved') {
        return NextResponse.json({ error: 'This player has already been claimed' }, { status: 400 })
      }
    }

    // Create the claim request
    const { data: claim, error: claimError } = await supabase
      .from('player_claims')
      .insert({
        league_id: league.id,
        player_id: player_id,
        claimer_email: user.email!,
        status: 'pending'
      })
      .select()
      .single()

    if (claimError) {
      console.error('Error creating claim:', claimError)
      return NextResponse.json({ error: 'Failed to create claim request' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Claim request submitted successfully',
      claim: claim 
    })

  } catch (error) {
    console.error('Error in POST /claims:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()

    // Get current user and verify admin status
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

    // Get all claims for this league with player information
    const { data: claims, error: claimsError } = await supabase
      .from('player_claims')
      .select(`
        id,
        claimer_email,
        status,
        requested_at,
        reviewed_at,
        player_id,
        participants!inner (
          id,
          name,
          email
        )
      `)
      .eq('league_id', league.id)
      .order('requested_at', { ascending: false })

    if (claimsError) {
      console.error('Error fetching claims:', claimsError)
      return NextResponse.json({ error: 'Failed to fetch claims' }, { status: 500 })
    }

    // Transform the data to match frontend expectations
    const transformedClaims = claims?.map((claim: any) => ({
      id: claim.id,
      email: claim.claimer_email, // Map claimer_email to email
      status: claim.status,
      requested_at: claim.requested_at,
      reviewed_at: claim.reviewed_at,
      player: {
        id: claim.participants.id,
        name: claim.participants.name,
        email: claim.participants.email
      }
    })) || []

    return NextResponse.json({ claims: transformedClaims })

  } catch (error) {
    console.error('Error in GET /claims:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

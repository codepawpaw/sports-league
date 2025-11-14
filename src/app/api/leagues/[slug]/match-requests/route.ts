import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

// GET - List match requests
export async function GET(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    
    // Get league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Get user session to check permissions
    const { data: { session } } = await supabase.auth.getSession()
    
    let query = supabase
      .from('match_requests')
      .select(`
        *,
        requesting_player:participants!match_requests_requesting_player_id_fkey(id, name, email),
        requested_player:participants!match_requests_requested_player_id_fkey(id, name, email),
        reviewed_by_admin:league_admins!match_requests_reviewed_by_admin_id_fkey(id, email),
        season:seasons(id, name, slug)
      `)
      .eq('league_id', league.id)
      .order('requested_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: matchRequests, error } = await query

    if (error) {
      console.error('Error fetching match requests:', error)
      return NextResponse.json({ error: 'Failed to fetch match requests' }, { status: 500 })
    }

    // Check if user is admin to show all requests, otherwise filter to user's requests
    let isAdmin = false
    if (session?.user?.email) {
      const { data: adminData } = await supabase
        .from('league_admins')
        .select('id')
        .eq('league_id', league.id)
        .eq('email', session.user.email)
        .single()
      
      isAdmin = !!adminData
    }

    let filteredRequests = matchRequests || []
    
    // If not admin, only show requests involving the user
    if (!isAdmin && session?.user?.email) {
      filteredRequests = (matchRequests || []).filter(request => 
        request.requesting_player?.email === session.user.email ||
        request.requested_player?.email === session.user.email
      )
    }

    return NextResponse.json({ 
      matchRequests: filteredRequests,
      isAdmin 
    })

  } catch (error) {
    console.error('Error in match requests GET:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST - Create new match request
export async function POST(
  request: Request,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
  const body = await request.json()
  const { requestedPlayerId, message, preferredDate } = body

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    // Get league and active season
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const { data: activeSeason, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('league_id', league.id)
      .eq('is_active', true)
      .single()

    if (seasonError || !activeSeason) {
      return NextResponse.json({ error: 'No active season found' }, { status: 400 })
    }

    // Get requesting player (must be authenticated user)
    const { data: requestingPlayer, error: requestingPlayerError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('season_id', activeSeason.id)
      .eq('email', session.user.email)
      .single()

    if (requestingPlayerError || !requestingPlayer) {
      return NextResponse.json({ 
        error: 'You must be a participant in this league to request matches' 
      }, { status: 403 })
    }

    // Validate requested player exists
    const { data: requestedPlayer, error: requestedPlayerError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('id', requestedPlayerId)
      .eq('league_id', league.id)
      .eq('season_id', activeSeason.id)
      .single()

    if (requestedPlayerError || !requestedPlayer) {
      return NextResponse.json({ error: 'Requested player not found' }, { status: 404 })
    }

    // Check for existing pending request between these players
    const { data: existingRequest } = await supabase
      .from('match_requests')
      .select('id')
      .eq('league_id', league.id)
      .eq('season_id', activeSeason.id)
      .eq('status', 'pending')
      .or(`and(requesting_player_id.eq.${requestingPlayer.id},requested_player_id.eq.${requestedPlayerId}),and(requesting_player_id.eq.${requestedPlayerId},requested_player_id.eq.${requestingPlayer.id})`)
      .single()

    if (existingRequest) {
      return NextResponse.json({ 
        error: 'A pending match request already exists between these players' 
      }, { status: 409 })
    }

    // Create match request
    const { data: matchRequest, error: createError } = await supabase
      .from('match_requests')
      .insert({
        league_id: league.id,
        season_id: activeSeason.id,
        requesting_player_id: requestingPlayer.id,
        requested_player_id: requestedPlayerId,
        message: message || null,
        preferred_date: preferredDate ? new Date(preferredDate).toISOString() : null,
        status: 'pending'
      })
      .select(`
        *,
        requesting_player:participants!match_requests_requesting_player_id_fkey(id, name, email),
        requested_player:participants!match_requests_requested_player_id_fkey(id, name, email)
      `)
      .single()

    if (createError) {
      console.error('Error creating match request:', createError)
      return NextResponse.json({ error: 'Failed to create match request' }, { status: 500 })
    }

    return NextResponse.json({ matchRequest }, { status: 201 })

  } catch (error) {
    console.error('Error in match requests POST:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

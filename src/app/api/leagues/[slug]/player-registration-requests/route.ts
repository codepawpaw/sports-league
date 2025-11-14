import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

interface RegistrationRequest {
  id: string
  player_id: string
  claimer_email: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  player: {
    id: string
    name: string
  }
}

interface RegistrationRequestsResponse {
  requests: RegistrationRequest[]
  league: {
    id: string
    name: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

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

    // Get all registration requests for this league
    const { data: requests, error: requestsError } = await supabase
      .from('player_registration_requests')
      .select(`
        id,
        player_id,
        claimer_email,
        status,
        requested_at,
        reviewed_at,
        reviewed_by,
        player:participants(id, name)
      `)
      .eq('league_id', league.id)
      .order('requested_at', { ascending: false })

    if (requestsError) {
      console.error('Error fetching registration requests:', requestsError)
      return NextResponse.json({ error: 'Failed to fetch registration requests' }, { status: 500 })
    }

    const transformedRequests: RegistrationRequest[] = (requests || []).map((request: any) => {
      const playerData = Array.isArray(request.player) ? request.player[0] : request.player
      
      return {
        id: request.id,
        player_id: request.player_id,
        claimer_email: request.claimer_email,
        status: request.status,
        requested_at: request.requested_at,
        reviewed_at: request.reviewed_at,
        reviewed_by: request.reviewed_by,
        player: {
          id: playerData?.id || request.player_id,
          name: playerData?.name || 'Unknown Player'
        }
      }
    })

    const response: RegistrationRequestsResponse = {
      requests: transformedRequests,
      league: {
        id: league.id,
        name: league.name
      }
    }

    return NextResponse.json(response)

  } catch (error) {
    console.error('Registration requests API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { player_id } = await request.json()

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

    // Verify the player exists and is unregistered
    const { data: player, error: playerError } = await supabase
      .from('participants')
      .select('id, name, email')
      .eq('id', player_id)
      .eq('league_id', league.id)
      .single()

    if (playerError || !player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 })
    }

    if (player.email) {
      return NextResponse.json({ error: 'Player is already registered' }, { status: 400 })
    }

    // Check if user already has a pending or approved request for this league
    const { data: existingRequest } = await supabase
      .from('player_registration_requests')
      .select('id, status')
      .eq('league_id', league.id)
      .eq('claimer_email', user.email)
      .in('status', ['pending', 'approved'])
      .single()

    if (existingRequest) {
      const message = existingRequest.status === 'pending' 
        ? 'You already have a pending registration request for this league'
        : 'You already have an approved registration in this league'
      return NextResponse.json({ error: message }, { status: 400 })
    }

    // Check if this player already has a pending or approved request
    const { data: existingPlayerRequest } = await supabase
      .from('player_registration_requests')
      .select('id, status')
      .eq('league_id', league.id)
      .eq('player_id', player_id)
      .in('status', ['pending', 'approved'])
      .single()

    if (existingPlayerRequest) {
      return NextResponse.json({ error: 'This player already has a registration request' }, { status: 400 })
    }

    // Create the registration request
    const { data: newRequest, error: createError } = await supabase
      .from('player_registration_requests')
      .insert({
        league_id: league.id,
        player_id: player_id,
        claimer_email: user.email,
        status: 'pending'
      })
      .select()
      .single()

    if (createError) {
      console.error('Error creating registration request:', createError)
      return NextResponse.json({ error: 'Failed to create registration request' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Registration request created successfully',
      request: {
        id: newRequest.id,
        player_name: player.name,
        status: 'pending',
        requested_at: newRequest.requested_at
      }
    })

  } catch (error) {
    console.error('Create registration request API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

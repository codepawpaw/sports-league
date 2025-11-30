import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug } = params
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')

    // Get league first
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Build query for tournaments
    let query = supabase
      .from('tournaments')
      .select('*')
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })

    // Filter by status if provided
    if (status && ['upcoming', 'active', 'completed', 'cancelled'].includes(status)) {
      query = query.eq('status', status)
    }

    const { data: tournaments, error: tournamentsError } = await query

    if (tournamentsError) {
      console.error('Error fetching tournaments:', tournamentsError)
      return NextResponse.json(
        { error: 'Failed to fetch tournaments' },
        { status: 500 }
      )
    }

    return NextResponse.json({ tournaments })
  } catch (error) {
    console.error('Error in GET /api/leagues/[slug]/tournaments:', error)
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
    const supabase = createSupabaseServerClient()
    const { slug } = params

    // Check authentication
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get league and verify admin access
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    const { data: adminData } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email)
      .single()

    if (!adminData) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const { 
      name, 
      description, 
      tournament_type, 
      start_date, 
      end_date, 
      max_participants,
      auto_generate_matches,
      settings 
    } = await request.json()

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Tournament name is required' },
        { status: 400 }
      )
    }

    if (!tournament_type || !['round_robin', 'table_system', 'exhibition', 'single_elimination', 'double_elimination'].includes(tournament_type)) {
      return NextResponse.json(
        { error: 'Valid tournament type is required' },
        { status: 400 }
      )
    }

    // Generate slug from name
    const tournamentSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    if (!tournamentSlug) {
      return NextResponse.json(
        { error: 'Invalid tournament name' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const { data: existingTournament } = await supabase
      .from('tournaments')
      .select('id')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (existingTournament) {
      return NextResponse.json(
        { error: 'A tournament with this name already exists' },
        { status: 400 }
      )
    }

    // Create the new tournament
    const { data: newTournament, error: tournamentError } = await supabase
      .from('tournaments')
      .insert({
        league_id: league.id,
        name: name.trim(),
        slug: tournamentSlug,
        description: description?.trim() || null,
        tournament_type,
        start_date: start_date ? new Date(start_date).toISOString() : null,
        end_date: end_date ? new Date(end_date).toISOString() : null,
        max_participants: max_participants || null,
        auto_generate_matches: auto_generate_matches || false,
        settings: settings || {},
        status: 'upcoming'
      })
      .select()
      .single()

    if (tournamentError) {
      console.error('Error creating tournament:', tournamentError)
      return NextResponse.json(
        { error: 'Failed to create tournament' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      tournament: newTournament,
      message: 'Tournament created successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/leagues/[slug]/tournaments:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

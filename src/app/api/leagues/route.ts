import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    
    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    const { name, slug, description, setsPerMatch } = await request.json()

    // Validate required fields
    if (!name || !slug) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check if user already has a league they admin
    const { data: existingAdminLeague } = await supabase
      .from('league_admins')
      .select('id')
      .eq('email', session.user.email)
      .single()

    if (existingAdminLeague) {
      return NextResponse.json(
        { error: 'You can only create one league per account. You already have a league.' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const { data: existingLeague } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existingLeague) {
      return NextResponse.json(
        { error: 'League URL already exists' },
        { status: 400 }
      )
    }

    // Create league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .insert({
        name,
        slug,
        description: description || null,
        sets_per_match: setsPerMatch || 3,
      })
      .select()
      .single()

    if (leagueError) {
      console.error('Error creating league:', leagueError)
      return NextResponse.json(
        { error: 'Failed to create league' },
        { status: 500 }
      )
    }

    // Add authenticated user as admin
    const { error: adminError } = await supabase
      .from('league_admins')
      .insert({
        league_id: league.id,
        email: session.user.email,
      })

    if (adminError) {
      // If admin insert fails, clean up the league
      await supabase.from('leagues').delete().eq('id', league.id)
      console.error('Error adding admin:', adminError)
      return NextResponse.json(
        { error: 'Failed to add administrator' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      id: league.id,
      name: league.name,
      slug: league.slug,
      description: league.description,
      sets_per_match: league.sets_per_match,
    })
  } catch (error) {
    console.error('Error in POST /api/leagues:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const { searchParams } = new URL(request.url)
    const slug = searchParams.get('slug')

    if (slug) {
      // Get specific league by slug
      const { data: league, error } = await supabase
        .from('leagues')
        .select('*')
        .eq('slug', slug)
        .single()

      if (error || !league) {
        return NextResponse.json(
          { error: 'League not found' },
          { status: 404 }
        )
      }

      return NextResponse.json(league)
    } else {
      // Get all leagues
      const { data: leagues, error } = await supabase
        .from('leagues')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error fetching leagues:', error)
        return NextResponse.json(
          { error: 'Failed to fetch leagues' },
          { status: 500 }
        )
      }

      return NextResponse.json(leagues)
    }
  } catch (error) {
    console.error('Error in GET /api/leagues:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

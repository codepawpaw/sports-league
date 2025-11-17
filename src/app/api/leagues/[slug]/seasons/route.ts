import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug } = params

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

    // Get all seasons for the league
    const { data: seasons, error: seasonsError } = await supabase
      .from('seasons')
      .select('*')
      .eq('league_id', league.id)
      .order('created_at', { ascending: true })

    if (seasonsError) {
      console.error('Error fetching seasons:', seasonsError)
      return NextResponse.json(
        { error: 'Failed to fetch seasons' },
        { status: 500 }
      )
    }

    return NextResponse.json({ seasons })
  } catch (error) {
    console.error('Error in GET /api/leagues/[slug]/seasons:', error)
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

    const { name, description, startDate, makeActive, convertExisting } = await request.json()

    // Validate required fields
    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'Season name is required' },
        { status: 400 }
      )
    }

    // Generate slug from name
    const seasonSlug = name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()

    if (!seasonSlug) {
      return NextResponse.json(
        { error: 'Invalid season name' },
        { status: 400 }
      )
    }

    // Check if slug already exists
    const { data: existingSeason } = await supabase
      .from('seasons')
      .select('id')
      .eq('league_id', league.id)
      .eq('slug', seasonSlug)
      .single()

    if (existingSeason) {
      return NextResponse.json(
        { error: 'A season with this name already exists' },
        { status: 400 }
      )
    }

    // If makeActive is true, we need to deactivate current active season
    if (makeActive) {
      await supabase
        .from('seasons')
        .update({ is_active: false })
        .eq('league_id', league.id)
        .eq('is_active', true)
    }

    // Create the new season
    const { data: newSeason, error: seasonError } = await supabase
      .from('seasons')
      .insert({
        league_id: league.id,
        name: name.trim(),
        slug: seasonSlug,
        description: description?.trim() || null,
        start_date: startDate ? new Date(startDate).toISOString() : null,
        is_active: makeActive || false,
        is_finished: false
      })
      .select()
      .single()

    if (seasonError) {
      console.error('Error creating season:', seasonError)
      return NextResponse.json(
        { error: 'Failed to create season' },
        { status: 500 }
      )
    }

    // If convertExisting is true, copy participants from active season
    if (convertExisting && newSeason) {
      const { data: currentActiveSeason } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', league.id)
        .eq('is_active', true)
        .neq('id', newSeason.id)
        .single()

      if (currentActiveSeason) {
        // Get participants from current active season
        const { data: existingSeasonParticipants } = await supabase
          .from('season_participants')
          .select('participant_id')
          .eq('season_id', currentActiveSeason.id)

        if (existingSeasonParticipants && existingSeasonParticipants.length > 0) {
          // Add existing participants to new season
          const seasonParticipantInserts = existingSeasonParticipants.map(sp => ({
            season_id: newSeason.id,
            participant_id: sp.participant_id
          }))

          await supabase
            .from('season_participants')
            .insert(seasonParticipantInserts)
        }
      }
    }

    return NextResponse.json({
      season: newSeason,
      message: 'Season created successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/leagues/[slug]/seasons:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

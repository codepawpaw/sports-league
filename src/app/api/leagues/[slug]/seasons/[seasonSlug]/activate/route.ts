import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; seasonSlug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug, seasonSlug } = params

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

    // Get the season to activate
    const { data: season, error: seasonError } = await supabase
      .from('seasons')
      .select('*')
      .eq('league_id', league.id)
      .eq('slug', seasonSlug)
      .single()

    if (seasonError || !season) {
      return NextResponse.json(
        { error: 'Season not found' },
        { status: 404 }
      )
    }

    if (season.is_finished) {
      return NextResponse.json(
        { error: 'Cannot activate a finished season' },
        { status: 400 }
      )
    }

    if (season.is_active) {
      return NextResponse.json(
        { error: 'Season is already active' },
        { status: 400 }
      )
    }

    // Deactivate all other seasons in this league
    await supabase
      .from('seasons')
      .update({ is_active: false })
      .eq('league_id', league.id)

    // Activate this season
    const { data: activatedSeason, error: activateError } = await supabase
      .from('seasons')
      .update({ is_active: true })
      .eq('id', season.id)
      .select()
      .single()

    if (activateError) {
      console.error('Error activating season:', activateError)
      return NextResponse.json(
        { error: 'Failed to activate season' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      season: activatedSeason,
      message: 'Season activated successfully'
    })
  } catch (error) {
    console.error('Error in POST /api/leagues/[slug]/seasons/[seasonSlug]/activate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

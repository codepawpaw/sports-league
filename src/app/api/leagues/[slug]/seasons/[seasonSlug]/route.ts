import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

export async function PUT(
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

    // Get the season to update
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

    const { name, description, startDate, endDate } = await request.json()

    // Update season basic info
    const updateData: any = {}
    if (name) updateData.name = name.trim()
    if (description !== undefined) updateData.description = description?.trim() || null
    if (startDate !== undefined) updateData.start_date = startDate ? new Date(startDate).toISOString() : null
    if (endDate !== undefined) updateData.end_date = endDate ? new Date(endDate).toISOString() : null

    const { data: updatedSeason, error: updateError } = await supabase
      .from('seasons')
      .update(updateData)
      .eq('id', season.id)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating season:', updateError)
      return NextResponse.json(
        { error: 'Failed to update season' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      season: updatedSeason,
      message: 'Season updated successfully'
    })
  } catch (error) {
    console.error('Error in PUT /api/leagues/[slug]/seasons/[seasonSlug]:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

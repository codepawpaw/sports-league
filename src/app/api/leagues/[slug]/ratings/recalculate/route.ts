import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { recalculateAllRatings } from '@/lib/rating-updater'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params

    // Verify league exists
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Check if user is league admin
    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user from auth header (simplified - in production you'd validate the JWT)
    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)
    
    if (userError || !user) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 })
    }

    // Check if user is admin for this league
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Not authorized to manage this league' }, { status: 403 })
    }

    // Use the helper function to recalculate all ratings
    const ratingResult = await recalculateAllRatings(league.id)

    if (!ratingResult.success) {
      console.error('Rating recalculation failed:', ratingResult.error)
      return NextResponse.json({ 
        error: ratingResult.error || 'Failed to recalculate ratings' 
      }, { status: 500 })
    }

    // Get total matches count for response
    const { count: matchesCount } = await supabase
      .from('matches')
      .select('*', { count: 'exact', head: true })
      .eq('league_id', league.id)
      .eq('status', 'completed')

    return NextResponse.json({
      message: 'Ratings recalculated successfully',
      league: {
        id: league.id,
        name: league.name
      },
      updated_players: ratingResult.updated_players || 0,
      total_matches_processed: matchesCount || 0
    })

  } catch (error) {
    console.error('Rating recalculation error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

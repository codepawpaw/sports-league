import { createSupabaseServerClient } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
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

    // Get leagues where user is admin
    const { data: adminLeagues, error } = await supabase
      .from('league_admins')
      .select(`
        league_id,
        leagues:league_id (
          id,
          name,
          slug
        )
      `)
      .eq('email', session.user.email)

    if (error) {
      console.error('Error fetching user leagues:', error)
      return NextResponse.json(
        { error: 'Failed to fetch user leagues' },
        { status: 500 }
      )
    }

    // Transform the response to return just the leagues data
    const leagues = adminLeagues?.map((admin: any) => admin.leagues).filter(Boolean) || []

    return NextResponse.json(leagues)
  } catch (error) {
    console.error('Error in GET /api/user/leagues:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

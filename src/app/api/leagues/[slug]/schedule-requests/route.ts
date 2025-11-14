import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

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
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Get user's participant record
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ 
        schedule_requests: [],
        received_requests: [],
        sent_requests: []
      })
    }

    // Get all schedule requests for matches involving this user
    const { data: scheduleRequests, error: requestsError } = await supabase
      .from('match_schedule_requests')
      .select(`
        *,
        requester:participants!match_schedule_requests_requester_id_fkey(id, name),
        opponent:participants!match_schedule_requests_opponent_id_fkey(id, name),
        match:matches(
          id,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name),
          status,
          scheduled_at
        )
      `)
      .or(`requester_id.eq.${participant.id},opponent_id.eq.${participant.id}`)
      .order('requested_at', { ascending: false })

    if (requestsError) {
      console.error('Error fetching schedule requests:', requestsError)
      return NextResponse.json({ error: 'Failed to fetch schedule requests' }, { status: 500 })
    }

    // Split requests into received (where user is opponent) and sent (where user is requester)
    const receivedRequests = scheduleRequests?.filter(req => req.opponent_id === participant.id) || []
    const sentRequests = scheduleRequests?.filter(req => req.requester_id === participant.id) || []

    return NextResponse.json({
      schedule_requests: scheduleRequests || [],
      received_requests: receivedRequests,
      sent_requests: sentRequests
    })

  } catch (error) {
    console.error('Schedule requests API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

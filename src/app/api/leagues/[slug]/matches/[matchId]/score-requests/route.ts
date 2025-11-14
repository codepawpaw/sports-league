import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; matchId: string } }
) {
  try {
    const { slug, matchId } = params
    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { player1_score, player2_score, message } = body

    if (player1_score === undefined || player2_score === undefined) {
      return NextResponse.json({ error: 'Both player scores are required' }, { status: 400 })
    }

    // Convert to integers and validate
    const p1Score = parseInt(player1_score)
    const p2Score = parseInt(player2_score)

    if (isNaN(p1Score) || isNaN(p2Score)) {
      return NextResponse.json({ error: 'Scores must be valid numbers' }, { status: 400 })
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

    // Get match info and verify it belongs to the league
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .select('id, player1_id, player2_id, league_id, status')
      .eq('id', matchId)
      .eq('league_id', league.id)
      .single()

    if (matchError || !match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 })
    }

    // Verify match is scheduled (not completed or cancelled)
    if (match.status === 'completed' || match.status === 'cancelled') {
      return NextResponse.json({ error: 'Cannot set score for completed or cancelled matches' }, { status: 400 })
    }

    // Get user's participant record
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'You are not a participant in this league' }, { status: 403 })
    }

    // Verify user is one of the players in the match
    if (match.player1_id !== participant.id && match.player2_id !== participant.id) {
      return NextResponse.json({ error: 'You are not a player in this match' }, { status: 403 })
    }

    // Determine opponent
    const opponentId = match.player1_id === participant.id ? match.player2_id : match.player1_id

    // Remove ALL existing score requests for this match (regardless of status)
    // This ensures only 1 pending row per match
    const { error: deleteError } = await supabase
      .from('match_score_requests')
      .delete()
      .eq('match_id', matchId)

    if (deleteError) {
      console.error('Error deleting existing score requests:', deleteError)
      return NextResponse.json({ error: 'Failed to clean up existing score requests' }, { status: 500 })
    }

    // Create the score request
    const { data: scoreRequest, error: createError } = await supabase
      .from('match_score_requests')
      .insert({
        match_id: matchId,
        requester_id: participant.id,
        opponent_id: opponentId,
        player1_score: p1Score,
        player2_score: p2Score,
        message: message || null
      })
      .select(`
        *,
        requester:participants!match_score_requests_requester_id_fkey(id, name),
        opponent:participants!match_score_requests_opponent_id_fkey(id, name),
        match:matches(
          id,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        )
      `)
      .single()

    if (createError) {
      console.error('Error creating score request:', createError)
      return NextResponse.json({ error: 'Failed to create score request' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      score_request: scoreRequest 
    })

  } catch (error) {
    console.error('Score request API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

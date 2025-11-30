import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier } from '@/lib/googleChat'
import { convertLocalToUTC } from '@/lib/timezone'

export async function POST(
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

    // Get request body
    const body = await request.json()
    const { player1_id, player2_id, scheduled_at } = body

    if (!player1_id || !player2_id) {
      return NextResponse.json({ error: 'Both players are required' }, { status: 400 })
    }

    if (player1_id === player2_id) {
      return NextResponse.json({ error: 'Players must be different' }, { status: 400 })
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

    // Check if user is admin
    const { data: adminData } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminData) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }


    // Verify both players exist in this league
    const { data: players, error: playersError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('league_id', league.id)
      .in('id', [player1_id, player2_id])

    if (playersError || !players || players.length !== 2) {
      return NextResponse.json({ error: 'One or both players not found in this league' }, { status: 400 })
    }

    const player1 = players.find(p => p.id === player1_id)
    const player2 = players.find(p => p.id === player2_id)

    if (!player1 || !player2) {
      return NextResponse.json({ error: 'Player information not found' }, { status: 400 })
    }

    // Create the match with proper UTC conversion for scheduled_at
    const { data: match, error: matchError } = await supabase
      .from('matches')
      .insert({
        league_id: league.id,
        player1_id: player1_id,
        player2_id: player2_id,
        scheduled_at: scheduled_at ? convertLocalToUTC(scheduled_at) : null,
        status: 'scheduled'
      })
      .select()
      .single()

    if (matchError) {
      console.error('Error creating match:', matchError)
      return NextResponse.json({ error: 'Failed to create match' }, { status: 500 })
    }

    // Send Google Chat notification for new match
    try {
      const { data: chatIntegration, error: chatError } = await supabase
        .from('league_chat_integrations')
        .select('*')
        .eq('league_id', league.id)
        .single()

      if (!chatError && chatIntegration?.enabled && chatIntegration?.notify_new_matches) {
        // Get app URL from environment or construct it
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).origin}`
        
        await GoogleChatNotifier.notifyNewMatch(chatIntegration.webhook_url, {
          leagueName: league.name,
          player1Name: player1.name,
          player2Name: player2.name,
          scheduledAt: scheduled_at || undefined,
          leagueSlug: slug,
          appUrl: appUrl
        })
      }
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to send Google Chat notification:', error)
    }

    return NextResponse.json({
      success: true,
      match: match,
      message: 'Match created successfully'
    })

  } catch (error) {
    console.error('Match creation API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

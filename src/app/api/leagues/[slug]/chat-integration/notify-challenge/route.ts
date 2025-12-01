import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier } from '@/lib/googleChat'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const supabase = createSupabaseServerClient()

    // Get request body
    const body = await request.json()
    const {
      challengerName,
      challengedName,
      tournamentName,
      leagueName,
      challengeId,
      appUrl = 'https://sports-league-tau.vercel.app'
    } = body

    if (!challengerName || !challengedName || !tournamentName || !leagueName) {
      return NextResponse.json({ 
        error: 'Missing required notification data' 
      }, { status: 400 })
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

    // Get chat integration settings
    const { data: integration, error: integrationError } = await supabase
      .from('league_chat_integrations')
      .select('webhook_url, enabled, notify_challenge_requests')
      .eq('league_id', league.id)
      .eq('enabled', true)
      .eq('notify_challenge_requests', true)
      .single()

    if (integrationError || !integration) {
      // No integration configured or notifications disabled
      return NextResponse.json({ 
        success: true, 
        message: 'No challenge notification configuration found or disabled' 
      })
    }

    // Send notification via Google Chat
    await GoogleChatNotifier.notifyNewChallenge(
      integration.webhook_url,
      challengerName,
      challengedName,
      tournamentName,
      leagueName,
      slug,
      appUrl
    )

    return NextResponse.json({ 
      success: true, 
      message: 'Challenge notification sent successfully' 
    })

  } catch (error) {
    console.error('Challenge notification error:', error)
    return NextResponse.json(
      { error: 'Failed to send challenge notification' },
      { status: 500 }
    )
  }
}

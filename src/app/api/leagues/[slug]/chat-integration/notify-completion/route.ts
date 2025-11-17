import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier, MatchCompletionData } from '@/lib/googleChat'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const supabase = createSupabaseServerClient()

    // Get current user and verify admin access
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
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

    // Verify user is admin
    const { data: adminData, error: adminError } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
    }

    // Get notification data from request body
    const notificationData: MatchCompletionData = await request.json()

    // Validate notification data
    if (!notificationData.leagueName || !notificationData.player1Name || !notificationData.player2Name) {
      return NextResponse.json({ error: 'Missing required notification data' }, { status: 400 })
    }

    // Get chat integration settings
    const { data: chatIntegration, error: chatError } = await supabase
      .from('league_chat_integrations')
      .select('webhook_url, enabled, notify_match_completions')
      .eq('league_id', league.id)
      .eq('enabled', true)
      .eq('notify_match_completions', true)
      .single()

    if (chatError || !chatIntegration) {
      return NextResponse.json({ 
        error: 'Chat integration not configured or match completion notifications disabled' 
      }, { status: 404 })
    }

    // Send the notification
    const success = await GoogleChatNotifier.notifyMatchCompleted(
      chatIntegration.webhook_url, 
      notificationData
    )

    if (success) {
      return NextResponse.json({ 
        success: true, 
        message: 'Match completion notification sent successfully' 
      })
    } else {
      return NextResponse.json({ 
        error: 'Failed to send notification' 
      }, { status: 500 })
    }

  } catch (error) {
    console.error('Match completion notification API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

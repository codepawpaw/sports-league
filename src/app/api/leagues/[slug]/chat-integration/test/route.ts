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

    // Get current user
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

    // Get chat integration settings
    const { data: integration, error: integrationError } = await supabase
      .from('league_chat_integrations')
      .select('*')
      .eq('league_id', league.id)
      .single()

    if (integrationError) {
      return NextResponse.json({ error: 'Chat integration not configured' }, { status: 404 })
    }

    if (!integration.enabled) {
      return NextResponse.json({ error: 'Chat integration is disabled' }, { status: 400 })
    }

    // Send test notification
    const success = await GoogleChatNotifier.testNotification(
      integration.webhook_url,
      league.name
    )

    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to send test notification. Please check your webhook URL.' 
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Test notification sent successfully!'
    })

  } catch (error) {
    console.error('Chat integration test API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

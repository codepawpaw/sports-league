import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { GoogleChatNotifier } from '@/lib/googleChat'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const { announcement } = await request.json()

    if (!announcement || announcement.trim().length === 0) {
      return NextResponse.json(
        { error: 'Announcement text is required' },
        { status: 400 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })

    // Check if user is authenticated
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Check if user is admin of this league
    const { data: adminData, error: adminError } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (adminError || !adminData) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get chat integration settings
    const { data: chatIntegration, error: chatError } = await supabase
      .from('league_chat_integrations')
      .select('webhook_url, enabled')
      .eq('league_id', league.id)
      .eq('enabled', true)
      .single()

    if (chatError || !chatIntegration) {
      return NextResponse.json(
        { error: 'Google Chat integration not configured or disabled' },
        { status: 400 }
      )
    }

    // Send announcement to Google Chat
    const success = await GoogleChatNotifier.sendCustomAnnouncement(
      chatIntegration.webhook_url,
      league.name,
      announcement.trim(),
      slug,
      process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
    )

    if (success) {
      return NextResponse.json({
        message: 'Announcement sent successfully to Google Chat!'
      })
    } else {
      return NextResponse.json(
        { error: 'Failed to send announcement to Google Chat' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Error sending announcement:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

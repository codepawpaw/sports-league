import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier } from '@/lib/googleChat'

interface ChatIntegration {
  id: string
  league_id: string
  webhook_url: string
  enabled: boolean
  notify_new_matches: boolean
  notify_approved_schedules: boolean
  notify_schedule_requests: boolean
  notify_match_completions: boolean
  notify_challenge_requests: boolean
  created_at: string
  updated_at: string
}

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

    if (integrationError && integrationError.code !== 'PGRST116') {
      console.error('Error fetching chat integration:', integrationError)
      return NextResponse.json({ error: 'Failed to fetch chat integration settings' }, { status: 500 })
    }

    return NextResponse.json({
      integration: integration || null,
      league: league
    })

  } catch (error) {
    console.error('Chat integration GET API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const { 
      webhook_url, 
      enabled, 
      notify_new_matches, 
      notify_approved_schedules, 
      notify_schedule_requests,
      notify_match_completions,
      notify_challenge_requests,
      daily_summary_enabled,
      daily_summary_time,
      summary_include_streaks,
      summary_include_rankings,
      summary_include_schedule
    } = body

    if (!webhook_url || typeof webhook_url !== 'string') {
      return NextResponse.json({ error: 'Valid webhook URL is required' }, { status: 400 })
    }

    // Basic webhook URL validation
    if (!webhook_url.startsWith('https://chat.googleapis.com/v1/spaces/')) {
      return NextResponse.json({ error: 'Invalid Google Chat webhook URL format' }, { status: 400 })
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

    // Upsert chat integration settings
    const integrationData = {
      league_id: league.id,
      webhook_url: webhook_url.trim(),
      enabled: enabled !== undefined ? enabled : true,
      notify_new_matches: notify_new_matches !== undefined ? notify_new_matches : true,
      notify_approved_schedules: notify_approved_schedules !== undefined ? notify_approved_schedules : true,
      notify_schedule_requests: notify_schedule_requests !== undefined ? notify_schedule_requests : true,
      notify_match_completions: notify_match_completions !== undefined ? notify_match_completions : true,
      notify_challenge_requests: notify_challenge_requests !== undefined ? notify_challenge_requests : true,
      daily_summary_enabled: daily_summary_enabled !== undefined ? daily_summary_enabled : false,
      daily_summary_time: daily_summary_time || '09:00:00',
      summary_include_streaks: summary_include_streaks !== undefined ? summary_include_streaks : true,
      summary_include_rankings: summary_include_rankings !== undefined ? summary_include_rankings : true,
      summary_include_schedule: summary_include_schedule !== undefined ? summary_include_schedule : true
    }

    const { data: integration, error: integrationError } = await supabase
      .from('league_chat_integrations')
      .upsert(integrationData, {
        onConflict: 'league_id'
      })
      .select()
      .single()

    if (integrationError) {
      console.error('Error saving chat integration:', integrationError)
      return NextResponse.json({ error: 'Failed to save chat integration settings' }, { status: 500 })
    }

    return NextResponse.json({
      integration,
      message: 'Chat integration settings saved successfully'
    })

  } catch (error) {
    console.error('Chat integration POST API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(
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

    // Delete chat integration settings
    const { error: deleteError } = await supabase
      .from('league_chat_integrations')
      .delete()
      .eq('league_id', league.id)

    if (deleteError) {
      console.error('Error deleting chat integration:', deleteError)
      return NextResponse.json({ error: 'Failed to delete chat integration settings' }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      message: 'Chat integration settings removed successfully'
    })

  } catch (error) {
    console.error('Chat integration DELETE API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

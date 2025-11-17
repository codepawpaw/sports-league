import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { GoogleChatNotifier } from '@/lib/googleChat'

interface AutoDrawConfig {
  clearExisting: boolean
  autoSchedule: boolean
  startDate?: string
  startTime?: string
  intervalDays?: number
  daysOfWeek?: number[] // 0=Sunday, 1=Monday, etc.
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const slug = params.slug

    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get league and verify admin access
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('*')
      .eq('slug', slug)
      .single()

    if (!leagueData) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    const { data: adminData } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', leagueData.id)
      .eq('email', session.user.email)
      .single()

    if (!adminData) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    const config: AutoDrawConfig = await request.json()

    // Get active season for this league
    const { data: activeSeason } = await supabase
      .from('seasons')
      .select('id, name')
      .eq('league_id', leagueData.id)
      .eq('is_active', true)
      .single()

    if (!activeSeason) {
      return NextResponse.json(
        { error: 'No active season found. Please create and activate a season first.' },
        { status: 400 }
      )
    }

    // Get all participants for this league
    const { data: participants } = await supabase
      .from('participants')
      .select('id, name')
      .eq('league_id', leagueData.id)
      .order('name')

    if (!participants || participants.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 participants are required for auto draw' },
        { status: 400 }
      )
    }

    // Get existing matches to avoid duplicates
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('player1_id, player2_id')
      .eq('league_id', leagueData.id)

    // Clear existing matches if requested
    if (config.clearExisting) {
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('league_id', leagueData.id)

      if (deleteError) {
        console.error('Error clearing matches:', deleteError)
        return NextResponse.json(
          { error: 'Failed to clear existing matches' },
          { status: 500 }
        )
      }
    }

    // Generate round-robin matches excluding existing ones
    const existingPairs = config.clearExisting ? [] : (existingMatches || [])
    const matches = generateRoundRobinMatches(participants, existingPairs)
    
    // Check if there are any new matches to create
    if (matches.length === 0) {
      return NextResponse.json({
        success: true,
        matchesCreated: 0,
        message: 'No new matches to create. All possible head-to-head matches already exist.',
        existingMatches: existingPairs.length
      })
    }
    
    // Apply scheduling if requested
    const scheduledMatches = config.autoSchedule 
      ? scheduleMatches(matches, config)
      : matches.map(match => ({ ...match, scheduled_at: null }))

    // Insert matches into database
    const matchInserts = scheduledMatches.map(match => ({
      league_id: leagueData.id,
      season_id: activeSeason.id,
      player1_id: match.player1_id,
      player2_id: match.player2_id,
      scheduled_at: match.scheduled_at,
      status: 'scheduled'
    }))

    const { data: insertedMatches, error: insertError } = await supabase
      .from('matches')
      .insert(matchInserts)
      .select()

    if (insertError) {
      console.error('Error inserting matches:', insertError)
      return NextResponse.json(
        { error: 'Failed to create matches' },
        { status: 500 }
      )
    }

    // Send Google Chat notifications for new matches created
    try {
      const { data: chatIntegration, error: chatError } = await supabase
        .from('league_chat_integrations')
        .select('*')
        .eq('league_id', leagueData.id)
        .single()

      if (!chatError && chatIntegration?.enabled && chatIntegration?.notify_new_matches && scheduledMatches.length > 0) {
        // Get app URL from environment or construct it
        const appUrl = process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).origin}`
        
        // Send notification for each new match
        const notifications = scheduledMatches.map(match => 
          GoogleChatNotifier.notifyNewMatch(chatIntegration.webhook_url, {
            leagueName: leagueData.name,
            seasonName: activeSeason.name,
            player1Name: match.player1_name,
            player2Name: match.player2_name,
            scheduledAt: match.scheduled_at || undefined,
            leagueSlug: slug,
            appUrl: appUrl
          })
        )

        // Send notifications (don't wait for all to complete)
        Promise.allSettled(notifications).then(results => {
          const failed = results.filter(r => r.status === 'rejected').length
          if (failed > 0) {
            console.error(`Failed to send ${failed}/${results.length} Google Chat notifications`)
          }
        })
      }
    } catch (error) {
      // Log error but don't fail the request
      console.error('Failed to send Google Chat notifications:', error)
    }

    return NextResponse.json({
      success: true,
      matchesCreated: insertedMatches?.length || 0,
      existingMatches: existingPairs.length,
      matches: scheduledMatches
    })

  } catch (error) {
    console.error('Error in auto draw:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function generateRoundRobinMatches(
  participants: Array<{ id: string; name: string }>,
  existingMatches: Array<{ player1_id: string; player2_id: string }> = []
) {
  const matches: Array<{ player1_id: string; player2_id: string; player1_name: string; player2_name: string }> = []
  
  // Create a set of existing match pairs for quick lookup
  const existingPairs = new Set<string>()
  existingMatches.forEach(match => {
    // Add both directions to handle player1/player2 order variations
    existingPairs.add(`${match.player1_id}-${match.player2_id}`)
    existingPairs.add(`${match.player2_id}-${match.player1_id}`)
  })
  
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      const player1Id = participants[i].id
      const player2Id = participants[j].id
      const pairKey = `${player1Id}-${player2Id}`
      
      // Skip if this match already exists
      if (!existingPairs.has(pairKey)) {
        matches.push({
          player1_id: player1Id,
          player2_id: player2Id,
          player1_name: participants[i].name,
          player2_name: participants[j].name
        })
      }
    }
  }
  
  return matches
}

function scheduleMatches(
  matches: Array<{ player1_id: string; player2_id: string; player1_name: string; player2_name: string }>,
  config: AutoDrawConfig
) {
  if (!config.startDate || !config.startTime) {
    return matches.map(match => ({ ...match, scheduled_at: null }))
  }

  const startDateTime = new Date(`${config.startDate}T${config.startTime}`)
  const intervalDays = config.intervalDays || 1
  const allowedDays = config.daysOfWeek && config.daysOfWeek.length > 0 
    ? config.daysOfWeek 
    : [0, 1, 2, 3, 4, 5, 6] // All days if none specified

  let currentDate = new Date(startDateTime)
  
  return matches.map((match, index) => {
    // Find next allowed day
    while (!allowedDays.includes(currentDate.getDay())) {
      currentDate.setDate(currentDate.getDate() + 1)
    }
    
    const scheduled_at = new Date(currentDate).toISOString()
    
    // Advance to next match date
    currentDate.setDate(currentDate.getDate() + intervalDays)
    
    return {
      ...match,
      scheduled_at
    }
  })
}

// Preview endpoint to show what matches would be created without actually creating them
export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const slug = params.slug
    const { searchParams } = new URL(request.url)

    // Get authenticated user
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // Get league and verify admin access
    const { data: leagueData } = await supabase
      .from('leagues')
      .select('*')
      .eq('slug', slug)
      .single()

    if (!leagueData) {
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    const { data: adminData } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', leagueData.id)
      .eq('email', session.user.email)
      .single()

    if (!adminData) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    // Get all participants for this league
    const { data: participants } = await supabase
      .from('participants')
      .select('id, name')
      .eq('league_id', leagueData.id)
      .order('name')

    if (!participants || participants.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 participants are required for auto draw' },
        { status: 400 }
      )
    }

    // Parse preview config from query params
    const config: AutoDrawConfig = {
      clearExisting: searchParams.get('clearExisting') === 'true',
      autoSchedule: searchParams.get('autoSchedule') === 'true',
      startDate: searchParams.get('startDate') || undefined,
      startTime: searchParams.get('startTime') || undefined,
      intervalDays: searchParams.get('intervalDays') ? parseInt(searchParams.get('intervalDays')!) : undefined,
      daysOfWeek: searchParams.get('daysOfWeek') ? 
        searchParams.get('daysOfWeek')!.split(',').map(d => parseInt(d)) : undefined
    }

    // Get existing matches for preview
    const { data: existingMatches } = await supabase
      .from('matches')
      .select('player1_id, player2_id')
      .eq('league_id', leagueData.id)

    // Generate preview matches excluding existing ones
    const existingPairs = config.clearExisting ? [] : (existingMatches || [])
    const matches = generateRoundRobinMatches(participants, existingPairs)
    const scheduledMatches = config.autoSchedule 
      ? scheduleMatches(matches, config)
      : matches.map(match => ({ ...match, scheduled_at: null }))

    return NextResponse.json({
      totalMatches: matches.length,
      newMatches: matches.length,
      existingMatches: existingPairs.length,
      participants: participants.length,
      matches: scheduledMatches,
      estimatedDuration: config.autoSchedule && config.intervalDays 
        ? `${matches.length * config.intervalDays} days`
        : null
    })

  } catch (error) {
    console.error('Error in auto draw preview:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

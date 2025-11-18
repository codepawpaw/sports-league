import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier, DailySummaryData } from '@/lib/googleChat'

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Get current time in WIB (GMT+7)
    const now = new Date()
    const wibOffset = 7 * 60 * 60 * 1000 // GMT+7
    const nowWIB = new Date(now.getTime() + wibOffset)
    const currentTimeWIB = nowWIB.getHours().toString().padStart(2, '0') + ':' + 
                           nowWIB.getMinutes().toString().padStart(2, '0')

    // Find leagues that need daily summaries sent
    const { data: integrations, error: integrationsError } = await supabase
      .from('league_chat_integrations')
      .select(`
        id,
        league_id,
        webhook_url,
        daily_summary_enabled,
        daily_summary_time,
        summary_include_streaks,
        summary_include_rankings,
        summary_include_schedule,
        last_summary_sent,
        leagues!inner(id, name, slug)
      `)
      .eq('enabled', true)
      .eq('daily_summary_enabled', true)

    if (integrationsError) {
      console.error('Error fetching integrations:', integrationsError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    if (!integrations || integrations.length === 0) {
      return NextResponse.json({ 
        message: 'No leagues with daily summary enabled found',
        processed: 0
      })
    }

    let processed = 0
    let errors: string[] = []

    for (const integration of integrations) {
      try {
        // Check if it's time to send the summary
        const summaryTime = integration.daily_summary_time || '09:00:00'
        const summaryTimeFormatted = summaryTime.substring(0, 5) // HH:MM format

        // Check if current time matches the configured time (within 1 hour window)
        const currentHour = nowWIB.getHours()
        const summaryHour = parseInt(summaryTime.substring(0, 2))
        
        // Only send if we're in the correct hour and haven't sent today yet
        if (currentHour !== summaryHour) {
          continue
        }

        // Check if we already sent today
        const today = nowWIB.toISOString().substring(0, 10) // YYYY-MM-DD format
        const lastSent = integration.last_summary_sent ? 
          new Date(integration.last_summary_sent).toISOString().substring(0, 10) : null

        if (lastSent === today) {
          continue // Already sent today
        }

        const league = Array.isArray(integration.leagues) ? 
          integration.leagues[0] : integration.leagues

        if (!league) {
          errors.push(`League not found for integration ${integration.id}`)
          continue
        }

        // Get current active season
        const { data: activeSeason } = await supabase
          .from('seasons')
          .select('id')
          .eq('league_id', league.id)
          .eq('is_active', true)
          .single()

        // Fetch participants data for rankings and winning streaks
        let participantsData = null
        if (activeSeason && (integration.summary_include_rankings || integration.summary_include_streaks)) {
          const { data } = await supabase
            .from('participants')
            .select('*')
            .eq('league_id', league.id)
            .order('points', { ascending: false })
            .order('set_diff', { ascending: false })

          participantsData = data
        }

        // Get winning streak monster
        let winningStreakMonster = undefined
        if (integration.summary_include_streaks && participantsData) {
          const streakChampion = participantsData
            .filter(player => player.winning_streak >= 3)
            .sort((a, b) => b.winning_streak - a.winning_streak)[0]

          if (streakChampion) {
            const totalMatches = streakChampion.wins + streakChampion.losses
            const winRate = totalMatches > 0 ? Math.round((streakChampion.wins / totalMatches) * 100) : 0

            winningStreakMonster = {
              name: streakChampion.name,
              streak: streakChampion.winning_streak,
              wins: streakChampion.wins,
              losses: streakChampion.losses,
              winRate: winRate
            }
          }
        }

        // Get top 3 rankings
        let topRankings = undefined
        if (integration.summary_include_rankings && participantsData) {
          topRankings = participantsData.slice(0, 3).map((player, index) => ({
            rank: index + 1,
            name: player.name,
            rating: player.current_rating || 1200,
            wins: player.wins,
            losses: player.losses,
            points: player.points
          }))
        }

        // Get today's matches (WIB timezone)
        let todayMatches = undefined
        if (integration.summary_include_schedule) {
          // Get start and end of day in WIB
          const startOfDay = new Date(nowWIB.getFullYear(), nowWIB.getMonth(), nowWIB.getDate())
          const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000)

          // Adjust back to UTC for database query
          const startOfDayUTC = new Date(startOfDay.getTime() - wibOffset)
          const endOfDayUTC = new Date(endOfDay.getTime() - wibOffset)

          const { data: matches } = await supabase
            .from('matches')
            .select(`
              id,
              scheduled_at,
              status,
              player1:participants!matches_player1_id_fkey(name),
              player2:participants!matches_player2_id_fkey(name)
            `)
            .eq('league_id', league.id)
            .in('status', ['scheduled', 'in_progress'])
            .gte('scheduled_at', startOfDayUTC.toISOString())
            .lt('scheduled_at', endOfDayUTC.toISOString())
            .order('scheduled_at', { ascending: true })

          if (matches && matches.length > 0) {
            todayMatches = matches.map(match => {
              const player1Data = Array.isArray(match.player1) ? match.player1[0] : match.player1
              const player2Data = Array.isArray(match.player2) ? match.player2[0] : match.player2

              return {
                player1Name: player1Data.name,
                player2Name: player2Data.name,
                scheduledAt: match.scheduled_at,
                status: match.status
              }
            })
          }
        }

        // Prepare notification data
        const summaryData: DailySummaryData = {
          leagueName: league.name,
          leagueSlug: league.slug,
          appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com',
          winningStreakMonster,
          topRankings,
          todayMatches,
          includeStreaks: integration.summary_include_streaks,
          includeRankings: integration.summary_include_rankings,
          includeSchedule: integration.summary_include_schedule
        }

        // Send notification
        const success = await GoogleChatNotifier.notifyDailySummary(
          integration.webhook_url,
          summaryData
        )

        if (success) {
          // Update last summary sent timestamp
          await supabase
            .from('league_chat_integrations')
            .update({ 
              last_summary_sent: now.toISOString() 
            })
            .eq('id', integration.id)

          processed++
          console.log(`Daily summary sent for league: ${league.name}`)
        } else {
          errors.push(`Failed to send notification for league: ${league.name}`)
        }

      } catch (error) {
        console.error(`Error processing league ${integration.league_id}:`, error)
        errors.push(`Error processing league ${integration.league_id}: ${error}`)
      }
    }

    return NextResponse.json({
      success: true,
      message: `Processed ${processed} daily summaries`,
      processed,
      errors,
      timestamp: now.toISOString(),
      currentTimeWIB
    })

  } catch (error) {
    console.error('Daily summaries cron job error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error },
      { status: 500 }
    )
  }
}

// Allow this endpoint to be called by cron services
export async function HEAD(request: NextRequest) {
  return new NextResponse(null, { status: 200 })
}

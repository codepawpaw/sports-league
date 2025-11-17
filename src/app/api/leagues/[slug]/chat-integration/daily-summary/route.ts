import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier, DailySummaryData } from '@/lib/googleChat'

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const { slug } = params
    const supabase = createSupabaseServerClient()

    // Verify authentication and admin access
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name, slug')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Verify admin access
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
    const { data: chatIntegration, error: chatError } = await supabase
      .from('league_chat_integrations')
      .select('*')
      .eq('league_id', league.id)
      .eq('enabled', true)
      .single()

    if (chatError || !chatIntegration) {
      return NextResponse.json({ error: 'Google Chat integration not configured or disabled' }, { status: 400 })
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
    if (activeSeason && (chatIntegration.summary_include_rankings || chatIntegration.summary_include_streaks)) {
      const { data } = await supabase
        .from('participants')
        .select('*')
        .eq('league_id', league.id)
        .order('points', { ascending: false })
        .order('current_rating', { ascending: false })

      participantsData = data
    }

    // Get winning streak monster
    let winningStreakMonster = undefined
    if (chatIntegration.summary_include_streaks && participantsData) {
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
    if (chatIntegration.summary_include_rankings && participantsData) {
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
    if (chatIntegration.summary_include_schedule) {
      // Get today in WIB timezone
      const today = new Date()
      const wibOffset = 7 * 60 * 60 * 1000 // GMT+7
      const todayWIB = new Date(today.getTime() + wibOffset)
      
      // Get start and end of day in WIB
      const startOfDay = new Date(todayWIB.getFullYear(), todayWIB.getMonth(), todayWIB.getDate())
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
      appUrl: process.env.NEXT_PUBLIC_APP_URL || `${request.nextUrl.origin}`,
      winningStreakMonster,
      topRankings,
      todayMatches,
      includeStreaks: chatIntegration.summary_include_streaks,
      includeRankings: chatIntegration.summary_include_rankings,
      includeSchedule: chatIntegration.summary_include_schedule
    }

    // Send notification using new method with pre-fetched data
    const success = await GoogleChatNotifier.notifyDailySummaryWithData(
      chatIntegration.webhook_url,
      summaryData
    )

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to send notification to Google Chat' },
        { status: 500 }
      )
    }

    // Update last summary sent timestamp
    const { error: updateError } = await supabase
      .from('league_chat_integrations')
      .update({ 
        last_summary_sent: new Date().toISOString() 
      })
      .eq('id', chatIntegration.id)

    if (updateError) {
      console.error('Failed to update last_summary_sent:', updateError)
      // Don't fail the request if timestamp update fails
    }

    return NextResponse.json({
      success: true,
      message: 'Daily summary sent successfully',
      data: {
        sentAt: new Date().toISOString(),
        includeStreaks: summaryData.includeStreaks,
        includeRankings: summaryData.includeRankings,
        includeSchedule: summaryData.includeSchedule,
        winningStreakMonster: !!summaryData.winningStreakMonster,
        topRankingsCount: summaryData.topRankings?.length || 0,
        todayMatchesCount: summaryData.todayMatches?.length || 0
      }
    })

  } catch (error) {
    console.error('Daily summary API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

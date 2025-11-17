import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { DailySummaryData } from '@/lib/googleChat'

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

    // Prepare preview data
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

    // Generate preview structure (similar to what would be sent to Google Chat)
    const currentDate = new Date().toLocaleDateString('en-US', {
      timeZone: 'Asia/Jakarta',
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    })

    const preview = {
      title: '📊 Daily League Summary',
      subtitle: `${league.name} | ${currentDate}`,
      sections: [] as Array<{
        title: string
        content: string
        type: 'streak' | 'rankings' | 'schedule'
      }>
    }

    // Build sections for preview
    if (summaryData.includeStreaks) {
      if (summaryData.winningStreakMonster) {
        const monster = summaryData.winningStreakMonster
        preview.sections.push({
          title: '🔥 Winning Streak Monster',
          content: `${monster.name}\n${monster.streak} wins in a row!\n${monster.wins}W-${monster.losses}L (${monster.winRate}% win rate)`,
          type: 'streak'
        })
      } else {
        preview.sections.push({
          title: '🔥 Winning Streak Monster',
          content: 'No players currently have a winning streak of 3 or more.',
          type: 'streak'
        })
      }
    }

    if (summaryData.includeRankings) {
      if (summaryData.topRankings && summaryData.topRankings.length > 0) {
        const rankingsText = summaryData.topRankings.map(player => {
          const rankEmoji = player.rank === 1 ? '👑' : player.rank === 2 ? '🥈' : '🥉'
          return `${rankEmoji} #${player.rank} ${player.name} - ${player.rating} ELO\n${player.wins}W-${player.losses}L, ${player.points} pts`
        }).join('\n\n')

        preview.sections.push({
          title: '🏆 Current Top Rankings',
          content: rankingsText,
          type: 'rankings'
        })
      } else {
        preview.sections.push({
          title: '🏆 Current Top Rankings',
          content: 'No rankings available yet.',
          type: 'rankings'
        })
      }
    }

    if (summaryData.includeSchedule) {
      if (summaryData.todayMatches && summaryData.todayMatches.length > 0) {
        const scheduleText = summaryData.todayMatches.map(match => {
          const time = new Date(match.scheduledAt).toLocaleTimeString('en-US', {
            timeZone: 'Asia/Jakarta',
            hour: '2-digit',
            minute: '2-digit'
          })
          return `🏓 ${match.player1Name} vs ${match.player2Name}\n⏰ ${time} WIB`
        }).join('\n\n')

        preview.sections.push({
          title: '📅 Today\'s Match Schedule',
          content: scheduleText,
          type: 'schedule'
        })
      } else {
        preview.sections.push({
          title: '📅 Today\'s Match Schedule',
          content: 'No matches scheduled for today.',
          type: 'schedule'
        })
      }
    }

    return NextResponse.json({
      success: true,
      preview: preview,
      data: {
        includeStreaks: summaryData.includeStreaks,
        includeRankings: summaryData.includeRankings,
        includeSchedule: summaryData.includeSchedule,
        winningStreakMonster: !!summaryData.winningStreakMonster,
        topRankingsCount: summaryData.topRankings?.length || 0,
        todayMatchesCount: summaryData.todayMatches?.length || 0
      }
    })

  } catch (error) {
    console.error('Daily summary preview API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

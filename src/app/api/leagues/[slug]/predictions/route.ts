import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Force dynamic behavior to prevent caching
export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabase = createClient(supabaseUrl, supabaseKey)

interface PlayerPrediction {
  id: string
  name: string
  currentPoints: number
  currentPosition: number
  matchesRemaining: number
  maxPossiblePoints: number
  winProbability: number
  keyFactors: string[]
  winningStreak: number
  winPercentage: number
  setDifferential: number
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const timestamp = new Date().toISOString()
  const requestId = Math.random().toString(36).substring(7)
  
  console.log(`[${timestamp}] [${requestId}] GET /api/leagues/${params.slug}/predictions - Starting request`)
  
  try {
    const { slug } = params

    // Fetch league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      console.log(`[${timestamp}] [${requestId}] League not found for slug: ${slug}`)
      return NextResponse.json(
        { error: 'League not found' },
        { status: 404 }
      )
    }

    // Get active season
    const { data: activeSeason, error: seasonError } = await supabase
      .from('seasons')
      .select('id')
      .eq('league_id', league.id)
      .eq('is_active', true)
      .single()

    if (seasonError || !activeSeason) {
      console.log(`[${timestamp}] [${requestId}] No active season found`)
      return NextResponse.json(
        { error: 'No active season found' },
        { status: 404 }
      )
    }

    // Get current standings (reuse the logic from players API)
    const standingsResponse = await fetch(`${request.nextUrl.origin}/api/leagues/${slug}/players`, {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache'
      }
    })

    if (!standingsResponse.ok) {
      throw new Error('Failed to fetch current standings')
    }

    const standingsData = await standingsResponse.json()
    const players = standingsData.players || []

    if (players.length < 2) {
      return NextResponse.json({
        predictions: [],
        message: 'Not enough players for predictions'
      })
    }

    // Get all upcoming matches for the active season
    const { data: upcomingMatches, error: matchesError } = await supabase
      .from('matches')
      .select(`
        id,
        player1_id,
        player2_id,
        status,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .eq('league_id', league.id)
      .eq('season_id', activeSeason.id)
      .in('status', ['scheduled', 'in_progress'])

    if (matchesError) {
      throw new Error('Failed to fetch upcoming matches')
    }

    const matches = upcomingMatches || []

    // Calculate predictions for each player
    const predictions: PlayerPrediction[] = players.map((player: any, index: number) => {
      const currentPosition = index + 1
      const currentPoints = player.points
      const totalMatches = player.wins + player.losses
      const winPercentage = totalMatches > 0 ? (player.wins / totalMatches) * 100 : 0
      
      // Count remaining matches for this player
      const playerMatches = matches.filter(m => 
        m.player1_id === player.id || m.player2_id === player.id
      )
      const matchesRemaining = playerMatches.length
      const maxPossiblePoints = currentPoints + (matchesRemaining * 2)

      // Calculate opponent strength and win probability for each remaining match
      let totalWinProbability = 0
      const keyFactors: string[] = []

      if (matchesRemaining === 0) {
        // No matches remaining - prediction based purely on current standing
        const currentStandingScore = Math.max(0, 100 - (currentPosition - 1) * 10)
        const formScore = Math.min(player.winning_streak * 5, 25)
        totalWinProbability = Math.min(95, currentStandingScore * 0.4 + formScore * 0.25)
        
        if (currentPosition === 1) {
          keyFactors.push('Currently leading')
        }
        keyFactors.push('All matches completed')
      } else {
        // Calculate win probability for each remaining match
        let expectedPointsFromMatches = 0
        let strongOpponents = 0
        let weakOpponents = 0

        playerMatches.forEach(match => {
          const opponentId = match.player1_id === player.id ? match.player2_id : match.player1_id
          const opponent = players.find((p: any) => p.id === opponentId)
          
          if (opponent) {
            const opponentPosition = players.findIndex((p: any) => p.id === opponent.id) + 1
            const positionDiff = opponentPosition - currentPosition
            
            // Win probability based on position difference
            let matchWinProb = 0.5 // Base 50%
            if (positionDiff > 0) {
              // Opponent is lower ranked (easier)
              matchWinProb = Math.min(0.85, 0.5 + (positionDiff * 0.05))
              if (positionDiff >= 3) weakOpponents++
            } else {
              // Opponent is higher ranked (harder)
              matchWinProb = Math.max(0.15, 0.5 + (positionDiff * 0.05))
              if (positionDiff <= -3) strongOpponents++
            }
            
            expectedPointsFromMatches += matchWinProb * 2
          }
        })

        // Calculate overall win probability
        const currentStandingScore = Math.max(0, 100 - (currentPosition - 1) * 10) // Max 100 for 1st place
        const remainingMatchesScore = (expectedPointsFromMatches / (matchesRemaining * 2)) * 100
        const formScore = Math.min(player.winning_streak * 5, 25)
        
        totalWinProbability = Math.min(95, Math.max(5, 
          currentStandingScore * 0.4 + 
          remainingMatchesScore * 0.35 + 
          formScore * 0.25
        ))

        // Add key factors
        if (currentPosition === 1) {
          keyFactors.push('Leading the league')
        } else if (currentPosition <= 3) {
          keyFactors.push('Top 3 position')
        }

        if (matchesRemaining === 1) {
          keyFactors.push('1 match remaining')
        } else {
          keyFactors.push(`${matchesRemaining} matches remaining`)
        }

        if (weakOpponents > strongOpponents) {
          keyFactors.push('Favorable schedule')
        } else if (strongOpponents > weakOpponents) {
          keyFactors.push('Challenging schedule')
        }

        if (player.winning_streak >= 3) {
          keyFactors.push(`${player.winning_streak}-match winning streak`)
        }

        if (winPercentage >= 80) {
          keyFactors.push('Strong win rate')
        }
      }

      return {
        id: player.id,
        name: player.name,
        currentPoints,
        currentPosition,
        matchesRemaining,
        maxPossiblePoints,
        winProbability: Math.round(totalWinProbability * 10) / 10,
        keyFactors: keyFactors.slice(0, 3), // Limit to top 3 factors
        winningStreak: player.winning_streak,
        winPercentage: Math.round(winPercentage * 10) / 10,
        setDifferential: player.set_diff
      }
    })

    // Sort by win probability and take top 2
    const topPredictions = predictions
      .sort((a, b) => b.winProbability - a.winProbability)
      .slice(0, 2)

    console.log(`[${timestamp}] [${requestId}] Generated predictions for top 2 players`)

    const response = NextResponse.json({
      predictions: topPredictions,
      totalPlayers: players.length,
      generated_at: timestamp,
      request_id: requestId
    })

    // Set cache-control headers
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    return response

  } catch (error) {
    console.error(`[${timestamp}] [${requestId}] Error in predictions API:`, error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

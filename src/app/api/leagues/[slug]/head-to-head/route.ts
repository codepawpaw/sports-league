import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'

interface CommonOpponent {
  id: string
  name: string
  player1_record: { wins: number; losses: number }
  player2_record: { wins: number; losses: number }
}

interface HeadToHeadData {
  player1: {
    id: string
    name: string
    current_rating: number
    is_provisional: boolean
    matches_played: number
  }
  player2: {
    id: string
    name: string
    current_rating: number
    is_provisional: boolean
    matches_played: number
  }
  direct_matches: {
    player1_wins: number
    player2_wins: number
    total_matches: number
  }
  common_opponents: CommonOpponent[]
  probability: {
    player1_chance: number
    player2_chance: number
    confidence: 'high' | 'medium' | 'low'
    basis: 'direct_matches' | 'rating_with_matches' | 'rating_based' | 'common_opponents' | 'insufficient_data'
    rating_difference: number
    factors_used: string[]
  }
  rating_analysis: {
    rating_difference: number
    expected_probability: number
    rating_confidence: 'established' | 'developing' | 'provisional'
  }
}

interface Player {
  id: string
  name: string
}

interface DirectMatch {
  player1_id: string
  player2_id: string
  player1_score: number
  player2_score: number
}

interface MatchWithPlayers {
  player1_id: string
  player2_id: string
  player1_score: number
  player2_score: number
  player1: {
    id: string
    name: string
  }[]
  player2: {
    id: string
    name: string
  }[]
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const searchParams = request.nextUrl.searchParams
    const player1Id = searchParams.get('player1_id')
    const player2Id = searchParams.get('player2_id')

    if (!player1Id || !player2Id) {
      return NextResponse.json(
        { error: 'Both player1_id and player2_id are required' },
        { status: 400 }
      )
    }

    if (player1Id === player2Id) {
      return NextResponse.json(
        { error: 'Cannot compare a player with themselves' },
        { status: 400 }
      )
    }

    const supabase = createSupabaseServerClient()

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Get player info with ratings
    const { data: players, error: playersError } = await supabase
      .from('participants')
      .select(`
        id, 
        name,
        player_ratings!player_ratings_player_id_fkey(
          current_rating,
          matches_played,
          is_provisional
        )
      `)
      .eq('league_id', league.id)
      .in('id', [player1Id, player2Id])

    if (playersError || !players || players.length !== 2) {
      return NextResponse.json({ error: 'One or both players not found' }, { status: 404 })
    }

    const player1Data = players.find((p: any) => p.id === player1Id)!
    const player2Data = players.find((p: any) => p.id === player2Id)!

    // Extract rating information
    const player1Rating = player1Data.player_ratings?.[0]
    const player2Rating = player2Data.player_ratings?.[0]

    const player1 = {
      id: player1Data.id,
      name: player1Data.name,
      current_rating: player1Rating?.current_rating || 1200,
      is_provisional: player1Rating?.is_provisional ?? true,
      matches_played: player1Rating?.matches_played || 0
    }

    const player2 = {
      id: player2Data.id,
      name: player2Data.name,
      current_rating: player2Rating?.current_rating || 1200,
      is_provisional: player2Rating?.is_provisional ?? true,
      matches_played: player2Rating?.matches_played || 0
    }

    // Get direct matches between the two players
    const { data: directMatches, error: directMatchesError } = await supabase
      .from('matches')
      .select('player1_id, player2_id, player1_score, player2_score')
      .eq('league_id', league.id)
      .eq('status', 'completed')
      .or(`and(player1_id.eq.${player1Id},player2_id.eq.${player2Id}),and(player1_id.eq.${player2Id},player2_id.eq.${player1Id})`)

    if (directMatchesError) {
      console.error('Error fetching direct matches:', directMatchesError)
    }

    // Calculate direct match record
    let player1DirectWins = 0
    let player2DirectWins = 0

    if (directMatches) {
      directMatches.forEach((match: DirectMatch) => {
        const isPlayer1First = match.player1_id === player1Id
        const player1Score = isPlayer1First ? match.player1_score : match.player2_score
        const player2Score = isPlayer1First ? match.player2_score : match.player1_score

        if (player1Score > player2Score) {
          player1DirectWins++
        } else {
          player2DirectWins++
        }
      })
    }

    // Get all matches for both players to find common opponents
    const { data: allMatches, error: allMatchesError } = await supabase
      .from('matches')
      .select(`
        player1_id,
        player2_id,
        player1_score,
        player2_score,
        player1:participants!matches_player1_id_fkey(id, name),
        player2:participants!matches_player2_id_fkey(id, name)
      `)
      .eq('league_id', league.id)
      .eq('status', 'completed')
      .or(`player1_id.eq.${player1Id},player2_id.eq.${player1Id},player1_id.eq.${player2Id},player2_id.eq.${player2Id}`)

    if (allMatchesError) {
      console.error('Error fetching all matches:', allMatchesError)
      return NextResponse.json({ error: 'Failed to fetch match data' }, { status: 500 })
    }

    // Find common opponents
    const player1Opponents = new Set<string>()
    const player2Opponents = new Set<string>()
    const player1Records: Record<string, { wins: number; losses: number; name: string }> = {}
    const player2Records: Record<string, { wins: number; losses: number; name: string }> = {}

    if (allMatches) {
      allMatches.forEach((match: MatchWithPlayers) => {
        const isPlayer1InMatch = match.player1_id === player1Id || match.player2_id === player1Id
        const isPlayer2InMatch = match.player1_id === player2Id || match.player2_id === player2Id

        if (isPlayer1InMatch) {
          const opponentId = match.player1_id === player1Id ? match.player2_id : match.player1_id
          const opponentName = match.player1_id === player1Id ? match.player2[0]?.name : match.player1[0]?.name
          const player1Score = match.player1_id === player1Id ? match.player1_score : match.player2_score
          const opponentScore = match.player1_id === player1Id ? match.player2_score : match.player1_score

          // Skip if opponent is player2 (these are direct matches) or if we don't have opponent name
          if (opponentId === player2Id || !opponentName) return

          player1Opponents.add(opponentId)
          if (!player1Records[opponentId]) {
            player1Records[opponentId] = { wins: 0, losses: 0, name: opponentName }
          }

          if (player1Score > opponentScore) {
            player1Records[opponentId].wins++
          } else {
            player1Records[opponentId].losses++
          }
        }

        if (isPlayer2InMatch) {
          const opponentId = match.player1_id === player2Id ? match.player2_id : match.player1_id
          const opponentName = match.player1_id === player2Id ? match.player2[0]?.name : match.player1[0]?.name
          const player2Score = match.player1_id === player2Id ? match.player1_score : match.player2_score
          const opponentScore = match.player1_id === player2Id ? match.player2_score : match.player1_score

          // Skip if opponent is player1 (these are direct matches) or if we don't have opponent name
          if (opponentId === player1Id || !opponentName) return

          player2Opponents.add(opponentId)
          if (!player2Records[opponentId]) {
            player2Records[opponentId] = { wins: 0, losses: 0, name: opponentName }
          }

          if (player2Score > opponentScore) {
            player2Records[opponentId].wins++
          } else {
            player2Records[opponentId].losses++
          }
        }
      })
    }

    // Find common opponents
    const commonOpponentIds = Array.from(player1Opponents).filter(id => player2Opponents.has(id))
    const commonOpponents: CommonOpponent[] = commonOpponentIds.map(id => ({
      id,
      name: player1Records[id].name,
      player1_record: {
        wins: player1Records[id].wins,
        losses: player1Records[id].losses
      },
      player2_record: {
        wins: player2Records[id].wins,
        losses: player2Records[id].losses
      }
    }))

    // Enhanced rating-based probability calculation
    const ratingDifference = player1.current_rating - player2.current_rating
    
    // Calculate ELO-based expected probability
    const expectedPlayer1Probability = 1 / (1 + Math.pow(10, -ratingDifference / 400))
    const expectedPlayer1Percentage = Math.round(expectedPlayer1Probability * 100)
    const expectedPlayer2Percentage = 100 - expectedPlayer1Percentage

    // Determine rating confidence
    let ratingConfidence: 'established' | 'developing' | 'provisional' = 'provisional'
    if (!player1.is_provisional && !player2.is_provisional) {
      if (player1.matches_played >= 15 && player2.matches_played >= 15) {
        ratingConfidence = 'established'
      } else if (player1.matches_played >= 8 && player2.matches_played >= 8) {
        ratingConfidence = 'developing'
      }
    } else if (!player1.is_provisional || !player2.is_provisional) {
      if ((player1.matches_played + player2.matches_played) >= 15) {
        ratingConfidence = 'developing'
      }
    }

    // Initialize calculation variables
    let player1Chance = expectedPlayer1Percentage
    let player2Chance = expectedPlayer2Percentage
    let confidence: 'high' | 'medium' | 'low' 
    let basis: 'direct_matches' | 'rating_with_matches' | 'rating_based' | 'common_opponents' | 'insufficient_data' = 'rating_based'
    const factorsUsed: string[] = ['ratings']

    const totalDirectMatches = player1DirectWins + player2DirectWins

    // Enhanced multi-factor analysis
    if (totalDirectMatches >= 5) {
      // Strong direct match history - blend with ratings
      const directMatchProbability = player1DirectWins / totalDirectMatches
      const directMatchPercentage = Math.round(directMatchProbability * 100)
      
      // Weight: 70% direct matches, 30% rating for high match count
      player1Chance = Math.round(0.7 * directMatchPercentage + 0.3 * expectedPlayer1Percentage)
      player2Chance = 100 - player1Chance
      
      confidence = 'high'
      basis = 'rating_with_matches'
      factorsUsed.push('direct_matches')
      
      console.log(`High confidence blend: ${player1.name} ${player1Chance}% (direct: ${directMatchPercentage}%, rating: ${expectedPlayer1Percentage}%)`)
    } else if (totalDirectMatches >= 3) {
      // Moderate direct match history - blend with ratings
      const directMatchProbability = player1DirectWins / totalDirectMatches
      const directMatchPercentage = Math.round(directMatchProbability * 100)
      
      // Weight: 60% direct matches, 40% rating for moderate match count
      player1Chance = Math.round(0.6 * directMatchPercentage + 0.4 * expectedPlayer1Percentage)
      player2Chance = 100 - player1Chance
      
      confidence = ratingConfidence === 'established' ? 'high' : 'medium'
      basis = 'rating_with_matches'
      factorsUsed.push('direct_matches')
      
      console.log(`Medium confidence blend: ${player1.name} ${player1Chance}% (direct: ${directMatchPercentage}%, rating: ${expectedPlayer1Percentage}%)`)
    } else if (commonOpponents.length >= 2) {
      // Use common opponents analysis with rating adjustment
      let validComparisons = 0
      let player1AdvantageSum = 0

      commonOpponents.forEach(opponent => {
        const p1Games = opponent.player1_record.wins + opponent.player1_record.losses
        const p2Games = opponent.player2_record.wins + opponent.player2_record.losses

        if (p1Games > 0 && p2Games > 0) {
          const player1WinRate = opponent.player1_record.wins / p1Games
          const player2WinRate = opponent.player2_record.wins / p2Games
          const performanceDiff = player1WinRate - player2WinRate
          
          const weight = Math.min(p1Games, p2Games)
          player1AdvantageSum += performanceDiff * weight
          validComparisons += weight
        }
      })

      if (validComparisons > 0) {
        const avgAdvantage = player1AdvantageSum / validComparisons
        const scaledAdvantage = Math.max(-1.5, Math.min(1.5, avgAdvantage * 2))
        const commonOpponentsProbability = 1 / (1 + Math.exp(-scaledAdvantage))
        const commonOpponentsPercentage = Math.round(commonOpponentsProbability * 100)
        
        // Blend common opponents with rating (50-50 for established ratings, 30-70 for developing/provisional)
        const ratingWeight = ratingConfidence === 'established' ? 0.5 : 0.7
        const commonOpponentsWeight = 1 - ratingWeight
        
        player1Chance = Math.round(ratingWeight * expectedPlayer1Percentage + commonOpponentsWeight * commonOpponentsPercentage)
        player2Chance = 100 - player1Chance
        
        confidence = ratingConfidence === 'established' ? 'medium' : 'low'
        basis = 'rating_with_matches'
        factorsUsed.push('common_opponents')
        
        console.log(`Common opponents blend: ${player1.name} ${player1Chance}% (rating: ${expectedPlayer1Percentage}%, common: ${commonOpponentsPercentage}%)`)
      }
    }

 

    confidence = 'medium'

    const result: HeadToHeadData = {
      player1,
      player2,
      direct_matches: {
        player1_wins: player1DirectWins,
        player2_wins: player2DirectWins,
        total_matches: totalDirectMatches
      },
      common_opponents: commonOpponents,
      probability: {
        player1_chance: player1Chance,
        player2_chance: player2Chance,
        confidence,
        basis,
        rating_difference: ratingDifference,
        factors_used: factorsUsed
      },
      rating_analysis: {
        rating_difference: ratingDifference,
        expected_probability: expectedPlayer1Percentage,
        rating_confidence: ratingConfidence
      }
    }

    return NextResponse.json(result)

  } catch (error) {
    console.error('Head-to-head API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

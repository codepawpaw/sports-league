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
  }
  player2: {
    id: string
    name: string
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
    basis: 'direct_matches' | 'common_opponents' | 'insufficient_data'
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

    // Get player info
    const { data: players, error: playersError } = await supabase
      .from('participants')
      .select('id, name')
      .eq('league_id', league.id)
      .in('id', [player1Id, player2Id])

    if (playersError || !players || players.length !== 2) {
      return NextResponse.json({ error: 'One or both players not found' }, { status: 404 })
    }

    const player1 = players.find((p: Player) => p.id === player1Id)!
    const player2 = players.find((p: Player) => p.id === player2Id)!

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

    // Calculate probability
    let player1Chance = 50
    let player2Chance = 50
    let confidence: 'high' | 'medium' | 'low' = 'low'
    let basis: 'direct_matches' | 'common_opponents' | 'insufficient_data' = 'insufficient_data'

    const totalDirectMatches = player1DirectWins + player2DirectWins

    if (totalDirectMatches >= 3) {
      // Use direct matches if we have enough data
      player1Chance = Math.round((player1DirectWins / totalDirectMatches) * 100)
      player2Chance = 100 - player1Chance
      confidence = totalDirectMatches >= 5 ? 'high' : 'medium'
      basis = 'direct_matches'
    } else if (commonOpponents.length > 0) {
      // Use common opponents method
      let player1TotalWins = 0
      let player1TotalGames = 0
      let player2TotalWins = 0
      let player2TotalGames = 0

      commonOpponents.forEach(opponent => {
        const p1Games = opponent.player1_record.wins + opponent.player1_record.losses
        const p2Games = opponent.player2_record.wins + opponent.player2_record.losses

        player1TotalWins += opponent.player1_record.wins
        player1TotalGames += p1Games
        player2TotalWins += opponent.player2_record.wins
        player2TotalGames += p2Games
      })

      if (player1TotalGames > 0 && player2TotalGames > 0) {
        const player1WinRate = player1TotalWins / player1TotalGames
        const player2WinRate = player2TotalWins / player2TotalGames

        if (player1WinRate + player2WinRate > 0) {
          player1Chance = Math.round((player1WinRate / (player1WinRate + player2WinRate)) * 100)
          player2Chance = 100 - player1Chance
          confidence = commonOpponents.length >= 3 ? 'medium' : 'low'
          basis = 'common_opponents'
        }
      }
    }

    const result: HeadToHeadData = {
      player1: {
        id: player1.id,
        name: player1.name
      },
      player2: {
        id: player2.id,
        name: player2.name
      },
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
        basis
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

export interface MatchResult {
  id: string
  player1_id: string
  player2_id: string
  player1_score: number
  player2_score: number
  completed_at: string
}

export interface PlayerRating {
  player_id: string
  current_rating: number
  matches_played: number
  is_provisional: boolean
}

export interface RatingCalculationResult {
  player_id: string
  old_rating: number
  new_rating: number
  rating_change: number
  matches_played: number
  is_provisional: boolean
}

// USATT Point Exchange Table
const POINT_EXCHANGE_TABLE = [
  { min: 0, max: 12, expected: 8, upset: 8 },
  { min: 13, max: 37, expected: 7, upset: 10 },
  { min: 38, max: 62, expected: 6, upset: 13 },
  { min: 63, max: 87, expected: 5, upset: 16 },
  { min: 88, max: 112, expected: 4, upset: 20 },
  { min: 113, max: 137, expected: 3, upset: 25 },
  { min: 138, max: 162, expected: 2, upset: 30 },
  { min: 163, max: 187, expected: 2, upset: 35 },
  { min: 188, max: 212, expected: 1, upset: 40 },
  { min: 213, max: 237, expected: 1, upset: 45 },
  { min: 238, max: Infinity, expected: 0, upset: 50 }
]

export class USATTRatingCalculator {
  /**
   * Calculate points to exchange based on rating difference
   */
  private getPointExchange(ratingDiff: number, isUpset: boolean): number {
    const absRatingDiff = Math.abs(ratingDiff)
    
    for (const rule of POINT_EXCHANGE_TABLE) {
      if (absRatingDiff >= rule.min && absRatingDiff <= rule.max) {
        return isUpset ? rule.upset : rule.expected
      }
    }
    
    return isUpset ? 50 : 0
  }

  /**
   * Pass 1: Calculate ratings for players with initial ratings
   */
  private calculatePass1(matches: MatchResult[], playerRatings: Map<string, PlayerRating>): Map<string, number> {
    const pass1Ratings = new Map<string, number>()
    
    // Initialize with current ratings for rated players
    playerRatings.forEach((rating, playerId) => {
      if (rating.matches_played > 0) {
        pass1Ratings.set(playerId, rating.current_rating)
      }
    })

    // Process each match
    for (const match of matches) {
      const player1Rating = pass1Ratings.get(match.player1_id)
      const player2Rating = pass1Ratings.get(match.player2_id)
      
      // Skip matches with unrated players
      if (!player1Rating || !player2Rating) continue

      const player1Won = match.player1_score > match.player2_score
      const ratingDiff = player1Rating - player2Rating
      const isUpset = (player1Won && ratingDiff < 0) || (!player1Won && ratingDiff > 0)
      
      const pointsToExchange = this.getPointExchange(ratingDiff, isUpset)
      
      if (player1Won) {
        pass1Ratings.set(match.player1_id, player1Rating + pointsToExchange)
        pass1Ratings.set(match.player2_id, player2Rating - pointsToExchange)
      } else {
        pass1Ratings.set(match.player1_id, player1Rating - pointsToExchange)
        pass1Ratings.set(match.player2_id, player2Rating + pointsToExchange)
      }
    }

    return pass1Ratings
  }

  /**
   * Pass 2: Calculate initial ratings for unrated players
   */
  private calculatePass2(matches: MatchResult[], playerRatings: Map<string, PlayerRating>, pass1Ratings: Map<string, number>): Map<string, number> {
    const pass2Ratings = new Map<string, number>()
    const pass2Adjustments = new Map<string, number>()

    // Calculate Pass 2 Adjustment for rated players
    playerRatings.forEach((initialRating, playerId) => {
      if (initialRating.matches_played > 0) {
        const pass1Rating = pass1Ratings.get(playerId) || initialRating.current_rating
        const pointsGained = pass1Rating - initialRating.current_rating

        if (pointsGained < 50) {
          pass2Adjustments.set(playerId, initialRating.current_rating)
        } else if (pointsGained >= 50 && pointsGained <= 74) {
          pass2Adjustments.set(playerId, pass1Rating)
        } else {
          // For 75+ points gained, use best win/worst loss average (simplified)
          pass2Adjustments.set(playerId, pass1Rating)
        }
        pass2Ratings.set(playerId, pass1Rating)
      }
    })

    // Calculate Pass 2 Rating for unrated players
    playerRatings.forEach((rating, playerId) => {
      if (rating.matches_played === 0) {
        const playerMatches = matches.filter(m => m.player1_id === playerId || m.player2_id === playerId)
        
        if (playerMatches.length === 0) {
          pass2Ratings.set(playerId, 1200)
          return
        }

        let opponentRatings: number[] = []
        let wins = 0
        let losses = 0

        for (const match of playerMatches) {
          const isPlayer1 = match.player1_id === playerId
          const opponentId = isPlayer1 ? match.player2_id : match.player1_id
          const opponentRating = pass2Adjustments.get(opponentId)
          
          if (opponentRating) {
            opponentRatings.push(opponentRating)
            const playerWon = isPlayer1 ? match.player1_score > match.player2_score : match.player2_score > match.player1_score
            if (playerWon) wins++
            else losses++
          }
        }

        if (opponentRatings.length === 0) {
          pass2Ratings.set(playerId, 1200)
        } else if (wins > 0 && losses > 0) {
          // Average of best win and worst loss
          const bestWin = Math.max(...opponentRatings)
          const worstLoss = Math.min(...opponentRatings)
          pass2Ratings.set(playerId, Math.floor((bestWin + worstLoss) / 2))
        } else if (wins > 0 && losses === 0) {
          // All wins - use best win plus bonuses
          const bestWin = Math.max(...opponentRatings)
          pass2Ratings.set(playerId, bestWin + 10) // Simplified bonus
        } else {
          // All losses - use worst loss minus penalties
          const worstLoss = Math.min(...opponentRatings)
          pass2Ratings.set(playerId, Math.max(worstLoss - 10, 100)) // Simplified penalty with floor
        }
      }
    })

    return pass2Ratings
  }

  /**
   * Pass 3: Refine ratings with additional constraints
   */
  private calculatePass3(matches: MatchResult[], playerRatings: Map<string, PlayerRating>, pass2Ratings: Map<string, number>): Map<string, number> {
    const pass3Ratings = new Map<string, number>(pass2Ratings)

    // Apply point exchange table with Pass 2 ratings
    for (const match of matches) {
      const player1Rating = pass3Ratings.get(match.player1_id) || 1200
      const player2Rating = pass3Ratings.get(match.player2_id) || 1200
      
      const player1Won = match.player1_score > match.player2_score
      const ratingDiff = player1Rating - player2Rating
      const isUpset = (player1Won && ratingDiff < 0) || (!player1Won && ratingDiff > 0)
      
      const pointsToExchange = this.getPointExchange(ratingDiff, isUpset)
      
      if (player1Won) {
        pass3Ratings.set(match.player1_id, player1Rating + pointsToExchange)
        pass3Ratings.set(match.player2_id, player2Rating - pointsToExchange)
      } else {
        pass3Ratings.set(match.player1_id, player1Rating - pointsToExchange)
        pass3Ratings.set(match.player2_id, player2Rating + pointsToExchange)
      }
    }

    // Ensure ratings don't go below initial ratings for existing players
    playerRatings.forEach((initialRating, playerId) => {
      if (initialRating.matches_played > 0) {
        const currentRating = pass3Ratings.get(playerId) || initialRating.current_rating
        if (currentRating < initialRating.current_rating) {
          pass3Ratings.set(playerId, initialRating.current_rating)
        }
      }
    })

    return pass3Ratings
  }

  /**
   * Pass 4: Final rating calculation
   */
  private calculatePass4(matches: MatchResult[], playerRatings: Map<string, PlayerRating>, pass3Ratings: Map<string, number>): Map<string, number> {
    const finalRatings = new Map<string, number>(pass3Ratings)

    // Final point exchange calculation
    for (const match of matches) {
      const player1Rating = finalRatings.get(match.player1_id) || 1200
      const player2Rating = finalRatings.get(match.player2_id) || 1200
      
      const player1Won = match.player1_score > match.player2_score
      const ratingDiff = player1Rating - player2Rating
      const isUpset = (player1Won && ratingDiff < 0) || (!player1Won && ratingDiff > 0)
      
      const pointsToExchange = this.getPointExchange(ratingDiff, isUpset)
      
      if (player1Won) {
        finalRatings.set(match.player1_id, player1Rating + pointsToExchange)
        finalRatings.set(match.player2_id, player2Rating - pointsToExchange)
      } else {
        finalRatings.set(match.player1_id, player1Rating - pointsToExchange)
        finalRatings.set(match.player2_id, player2Rating + pointsToExchange)
      }
    }

    return finalRatings
  }

  /**
   * Calculate ratings for a single match
   */
  public calculateMatchRatings(
    match: MatchResult,
    player1CurrentRating: number,
    player2CurrentRating: number
  ): { player1NewRating: number; player2NewRating: number; pointsExchanged: number } {
    const player1Won = match.player1_score > match.player2_score
    const ratingDiff = player1CurrentRating - player2CurrentRating
    const isUpset = (player1Won && ratingDiff < 0) || (!player1Won && ratingDiff > 0)
    
    const pointsToExchange = this.getPointExchange(ratingDiff, isUpset)
    
    if (player1Won) {
      return {
        player1NewRating: player1CurrentRating + pointsToExchange,
        player2NewRating: player2CurrentRating - pointsToExchange,
        pointsExchanged: pointsToExchange
      }
    } else {
      return {
        player1NewRating: player1CurrentRating - pointsToExchange,
        player2NewRating: player2CurrentRating + pointsToExchange,
        pointsExchanged: pointsToExchange
      }
    }
  }

  /**
   * Calculate all ratings for a league using the full USATT 4-pass algorithm
   */
  public calculateLeagueRatings(
    matches: MatchResult[],
    playerRatings: Map<string, PlayerRating>
  ): RatingCalculationResult[] {
    // Sort matches by completion date
    const sortedMatches = matches.sort((a, b) => 
      new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime()
    )

    // Execute the 4-pass algorithm
    const pass1Ratings = this.calculatePass1(sortedMatches, playerRatings)
    const pass2Ratings = this.calculatePass2(sortedMatches, playerRatings, pass1Ratings)
    const pass3Ratings = this.calculatePass3(sortedMatches, playerRatings, pass2Ratings)
    const finalRatings = this.calculatePass4(sortedMatches, playerRatings, pass3Ratings)

    // Calculate matches played for each player
    const matchCounts = new Map<string, number>()
    for (const match of sortedMatches) {
      matchCounts.set(match.player1_id, (matchCounts.get(match.player1_id) || 0) + 1)
      matchCounts.set(match.player2_id, (matchCounts.get(match.player2_id) || 0) + 1)
    }

    // Build results
    const results: RatingCalculationResult[] = []
    
    playerRatings.forEach((rating, playerId) => {
      const oldRating = rating.current_rating
      const newRating = finalRatings.get(playerId) || oldRating
      const totalMatches = matchCounts.get(playerId) || 0
      
      results.push({
        player_id: playerId,
        old_rating: oldRating,
        new_rating: newRating,
        rating_change: newRating - oldRating,
        matches_played: totalMatches,
        is_provisional: totalMatches < 2
      })
    })

    return results
  }
}

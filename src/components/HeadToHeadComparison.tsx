'use client'

import { useState, useEffect } from 'react'

interface Participant {
  id: string
  name: string
}

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

interface HeadToHeadComparisonProps {
  participants: Participant[]
  slug: string
}

export default function HeadToHeadComparison({ participants, slug }: HeadToHeadComparisonProps) {
  const [player1Id, setPlayer1Id] = useState<string>('')
  const [player2Id, setPlayer2Id] = useState<string>('')
  const [headToHeadData, setHeadToHeadData] = useState<HeadToHeadData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showDetails, setShowDetails] = useState(false)

  const fetchHeadToHead = async () => {
    if (!player1Id || !player2Id || player1Id === player2Id) {
      setHeadToHeadData(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/leagues/${slug}/head-to-head?player1_id=${player1Id}&player2_id=${player2Id}`
      )

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch head-to-head data')
      }

      const data = await response.json()
      setHeadToHeadData(data)
    } catch (err) {
      console.error('Error fetching head-to-head data:', err)
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHeadToHead()
  }, [player1Id, player2Id])

  const getConfidenceText = (confidence: string) => {
    return confidence.charAt(0).toUpperCase() + confidence.slice(1) + ' Confidence'
  }

  const getBasisText = (basis: string) => {
    switch (basis) {
      case 'direct_matches': return 'Based on direct matches'
      case 'rating_with_matches': return 'Based on ratings and match history'
      case 'rating_based': return 'Based on player ratings'
      case 'common_opponents': return 'Based on common opponents'
      case 'insufficient_data': return 'Insufficient data'
      default: return 'Unknown'
    }
  }

  const getRatingText = (isProvisional: boolean) => {
    return isProvisional ? 'Provisional' : 'Established'
  }

  const getRatingConfidenceText = (confidence: string) => {
    switch (confidence) {
      case 'established': return 'Established ratings'
      case 'developing': return 'Developing ratings'
      case 'provisional': return 'Provisional ratings'
      default: return 'Unknown rating status'
    }
  }

  const getFactorsText = (factors: string[]) => {
    const factorNames: Record<string, string> = {
      'ratings': 'Player Ratings',
      'direct_matches': 'Direct Matches',
      'common_opponents': 'Common Opponents'
    }
    return factors.map(factor => factorNames[factor] || factor).join(' + ')
  }

  return (
    <div className="bg-white">
      {/* Header */}
      <div className="border-b border-black px-6 py-8 sm:px-8 lg:px-12">
        <h2 className="text-2xl sm:text-3xl font-bold text-black mb-2">Head-to-Head Analysis</h2>
        <p className="text-black text-sm sm:text-base opacity-70">
          Compare two players and see winning probabilities based on match history
        </p>
      </div>

      <div className="px-6 py-8 sm:px-8 lg:px-12">
        {/* Player Selection */}
        <div className="space-y-6 mb-12">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="block text-sm font-semibold text-black">
                Player 1
              </label>
              <select
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                className="w-full px-4 py-3 border-2 border-black rounded-none focus:outline-none focus:ring-0 bg-white text-black text-sm sm:text-base"
              >
                <option value="">Select Player 1</option>
                {participants.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-semibold text-black">
                Player 2
              </label>
              <select
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                className="w-full px-4 py-3 border-2 border-black rounded-none focus:outline-none focus:ring-0 bg-white text-black text-sm sm:text-base"
              >
                <option value="">Select Player 2</option>
                {participants.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-16">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-black text-lg">Analyzing matchup...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="border-2 border-red-500 bg-white p-6 mb-8">
            <p className="text-red-500 font-medium">{error}</p>
          </div>
        )}

        {/* Results */}
        {headToHeadData && !loading && (
          <div className="space-y-12">
            {/* Winning Probability */}
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8">
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 sm:mb-0">Winning Probability</h3>
                <div className="text-sm font-semibold text-black">
                  {getConfidenceText(headToHeadData.probability.confidence)}
                </div>
              </div>

              {/* Probability Display */}
              <div className="grid grid-cols-2 gap-8 mb-8">
                <div className="text-center">
                  <div className="text-4xl sm:text-5xl font-bold text-black mb-2">
                    {headToHeadData.probability.player1_chance}%
                  </div>
                  <div className="text-black font-medium text-sm sm:text-base">
                    {headToHeadData.player1.name}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-4xl sm:text-5xl font-bold text-black mb-2">
                    {headToHeadData.probability.player2_chance}%
                  </div>
                  <div className="text-black font-medium text-sm sm:text-base">
                    {headToHeadData.player2.name}
                  </div>
                </div>
              </div>

              {/* Probability Bar */}
              <div className="relative h-4 bg-white border-2 border-black overflow-hidden">
                <div
                  className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                  style={{ width: `${headToHeadData.probability.player1_chance}%` }}
                ></div>
                <div
                  className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${headToHeadData.probability.player2_chance}%` }}
                ></div>
              </div>

              <div className="text-center mt-6">
                <p className="text-black text-sm font-medium mb-1">
                  {getBasisText(headToHeadData.probability.basis)}
                </p>
                {headToHeadData.probability.factors_used.length > 0 && (
                  <p className="text-black text-xs opacity-70">
                    Factors: {getFactorsText(headToHeadData.probability.factors_used)}
                  </p>
                )}
              </div>
            </div>

            {/* Player Ratings */}
            <div>
              <h3 className="text-xl sm:text-2xl font-bold text-black mb-8">Player Ratings</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="text-center border-2 border-black p-8">
                  <div className="mb-4">
                    <div className="text-4xl sm:text-5xl font-bold text-black mb-1">
                      {headToHeadData.player1.current_rating}
                    </div>
                    <div className="text-sm text-black opacity-70">
                      {getRatingText(headToHeadData.player1.is_provisional)}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-black">{headToHeadData.player1.name}</div>
                  <div className="text-sm text-black opacity-70">{headToHeadData.player1.matches_played} matches played</div>
                </div>
                
                <div className="text-center border-2 border-black p-8">
                  <div className="mb-4">
                    <div className="text-4xl sm:text-5xl font-bold text-black mb-1">
                      {headToHeadData.player2.current_rating}
                    </div>
                    <div className="text-sm text-black opacity-70">
                      {getRatingText(headToHeadData.player2.is_provisional)}
                    </div>
                  </div>
                  <div className="text-lg font-semibold text-black">{headToHeadData.player2.name}</div>
                  <div className="text-sm text-black opacity-70">{headToHeadData.player2.matches_played} matches played</div>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-black text-center">
                <div className="text-black text-sm">
                  Rating Difference: <span className="font-semibold">
                    {Math.abs(headToHeadData.rating_analysis.rating_difference)} points
                  </span>
                  {headToHeadData.rating_analysis.rating_difference !== 0 && (
                    <span className="ml-1">
                      ({headToHeadData.rating_analysis.rating_difference > 0 
                        ? `${headToHeadData.player1.name} higher`
                        : `${headToHeadData.player2.name} higher`})
                    </span>
                  )}
                </div>
                <div className="text-black text-xs opacity-70 mt-1">
                  {getRatingConfidenceText(headToHeadData.rating_analysis.rating_confidence)}
                </div>
              </div>
            </div>

            {/* Direct Matches */}
            {headToHeadData.direct_matches.total_matches > 0 && (
              <div>
                <h3 className="text-xl sm:text-2xl font-bold text-black mb-8">Direct Match Record</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center border-2 border-black p-6">
                    <div className="text-2xl sm:text-3xl font-bold text-green-500 mb-2">
                      {headToHeadData.direct_matches.player1_wins}
                    </div>
                    <div className="text-sm font-medium text-black">
                      {headToHeadData.player1.name} wins
                    </div>
                  </div>
                  <div className="text-center border-2 border-black p-6">
                    <div className="text-2xl sm:text-3xl font-bold text-black mb-2">
                      {headToHeadData.direct_matches.total_matches}
                    </div>
                    <div className="text-sm font-medium text-black">
                      Total matches
                    </div>
                  </div>
                  <div className="text-center border-2 border-black p-6">
                    <div className="text-2xl sm:text-3xl font-bold text-red-500 mb-2">
                      {headToHeadData.direct_matches.player2_wins}
                    </div>
                    <div className="text-sm font-medium text-black">
                      {headToHeadData.player2.name} wins
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Common Opponents */}
            {headToHeadData.common_opponents.length > 0 && (
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                  <h3 className="text-xl sm:text-2xl font-bold text-black mb-2 sm:mb-0">
                    Common Opponents ({headToHeadData.common_opponents.length})
                  </h3>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-sm font-medium text-black border-2 border-black px-4 py-2 hover:bg-black hover:text-white transition-colors"
                  >
                    {showDetails ? 'Hide' : 'Show'} Details
                  </button>
                </div>

                {showDetails && (
                  <div className="overflow-x-auto border-2 border-black">
                    <table className="w-full">
                      <thead className="border-b border-black bg-white">
                        <tr>
                          <th className="text-left py-4 px-6 font-semibold text-black">Opponent</th>
                          <th className="text-center py-4 px-6 font-semibold text-black">{headToHeadData.player1.name}</th>
                          <th className="text-center py-4 px-6 font-semibold text-black">{headToHeadData.player2.name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {headToHeadData.common_opponents.map((opponent, index) => (
                          <tr key={opponent.id} className={index < headToHeadData.common_opponents.length - 1 ? 'border-b border-black' : ''}>
                            <td className="py-4 px-6 font-medium text-black">
                              {opponent.name}
                            </td>
                            <td className="py-4 px-6 text-center text-black">
                              <span className="text-green-500 font-semibold">
                                {opponent.player1_record.wins}W
                              </span>
                              <span className="text-black mx-2">-</span>
                              <span className="text-red-500 font-semibold">
                                {opponent.player1_record.losses}L
                              </span>
                            </td>
                            <td className="py-4 px-6 text-center text-black">
                              <span className="text-green-500 font-semibold">
                                {opponent.player2_record.wins}W
                              </span>
                              <span className="text-black mx-2">-</span>
                              <span className="text-red-500 font-semibold">
                                {opponent.player2_record.losses}L
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Rating Analysis Details */}
            {(headToHeadData.probability.basis === 'rating_based' || 
              headToHeadData.probability.basis === 'rating_with_matches') && (
              <div className="border-2 border-black p-6">
                <h4 className="text-lg font-bold text-black mb-4">Analysis Details</h4>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-black font-medium">Rating-based prediction:</span>
                    <span className="ml-2 text-black">
                      {headToHeadData.rating_analysis.expected_probability}% - {100 - headToHeadData.rating_analysis.expected_probability}%
                    </span>
                  </div>
                  <div>
                    <span className="text-black font-medium">Rating difference impact:</span>
                    <span className="ml-2 text-black">
                      {Math.abs(headToHeadData.rating_analysis.rating_difference)} point{Math.abs(headToHeadData.rating_analysis.rating_difference) !== 1 ? 's' : ''} 
                      {headToHeadData.rating_analysis.rating_difference > 0 ? ' advantage' : headToHeadData.rating_analysis.rating_difference < 0 ? ' disadvantage' : ''}
                    </span>
                  </div>
                </div>
                
                {headToHeadData.probability.basis === 'rating_with_matches' && 
                 headToHeadData.direct_matches.total_matches > 0 && (
                  <div className="mt-4 pt-4 border-t border-black">
                    <div className="text-sm text-black">
                      <div className="font-medium mb-2">Analysis Method:</div>
                      <div>
                        Combined rating prediction ({headToHeadData.rating_analysis.expected_probability}%) with 
                        direct match history ({Math.round((headToHeadData.direct_matches.player1_wins / headToHeadData.direct_matches.total_matches) * 100)}%) 
                        for enhanced accuracy
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* No Data Message */}
            {headToHeadData.direct_matches.total_matches === 0 && 
             headToHeadData.common_opponents.length === 0 && (
              <div className="text-center py-16 border-2 border-black">
                <h4 className="text-xl font-bold text-black mb-2">No Data Available</h4>
                <p className="text-black opacity-70">
                  These players have no direct matches or common opponents yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!player1Id || !player2Id || player1Id === player2Id ? (
          <div className="text-center py-16">
            <h3 className="text-2xl font-bold text-black mb-4">Select Players to Compare</h3>
            <p className="text-black opacity-70">
              Choose two different players from the dropdowns above to see their head-to-head analysis.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

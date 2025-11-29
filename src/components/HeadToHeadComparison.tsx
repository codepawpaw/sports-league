'use client'

import { useState, useEffect } from 'react'
import { ChevronDown, ArrowLeftRight, Trophy, Users, BarChart3 } from 'lucide-react'

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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-yellow-600'
      case 'low': return 'text-red-600'
      default: return 'text-gray-600'
    }
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

  const getRatingColor = (isProvisional: boolean) => {
    return isProvisional ? 'text-orange-600' : 'text-green-600'
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
    <div className="card">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center">
          <ArrowLeftRight className="h-6 w-6 text-black mr-2" />
          <h2 className="text-xl font-bold text-black">Head-to-Head Analysis</h2>
        </div>
        <p className="text-gray-600 mt-2">
          Compare two players and see winning probabilities based on match history
        </p>
      </div>

      <div className="p-6">
        {/* Player Selection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Player 1
            </label>
            <div className="relative">
              <select
                value={player1Id}
                onChange={(e) => setPlayer1Id(e.target.value)}
                className="input-field appearance-none pr-10"
              >
                <option value="">Select Player 1</option>
                {participants.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Player 2
            </label>
            <div className="relative">
              <select
                value={player2Id}
                onChange={(e) => setPlayer2Id(e.target.value)}
                className="input-field appearance-none pr-10"
              >
                <option value="">Select Player 2</option>
                {participants.map(participant => (
                  <option key={participant.id} value={participant.id}>
                    {participant.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-3.5 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-8">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Analyzing matchup...</p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Results */}
        {headToHeadData && !loading && (
          <div className="space-y-6">
            {/* Player Ratings */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <div className="flex items-center mb-4">
                <BarChart3 className="h-5 w-5 text-black mr-2" />
                <h3 className="text-lg font-semibold text-black">Player Ratings</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="text-center">
                  <div className="mb-2">
                    <div className={`text-3xl font-bold ${getRatingColor(headToHeadData.player1.is_provisional)}`}>
                      {headToHeadData.player1.current_rating}
                    </div>
                    <div className="text-sm text-gray-500">
                      {headToHeadData.player1.is_provisional && '(Provisional)'}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700">{headToHeadData.player1.name}</div>
                  <div className="text-xs text-gray-500">{headToHeadData.player1.matches_played} matches played</div>
                </div>
                
                <div className="text-center">
                  <div className="mb-2">
                    <div className={`text-3xl font-bold ${getRatingColor(headToHeadData.player2.is_provisional)}`}>
                      {headToHeadData.player2.current_rating}
                    </div>
                    <div className="text-sm text-gray-500">
                      {headToHeadData.player2.is_provisional && '(Provisional)'}
                    </div>
                  </div>
                  <div className="text-sm font-medium text-gray-700">{headToHeadData.player2.name}</div>
                  <div className="text-xs text-gray-500">{headToHeadData.player2.matches_played} matches played</div>
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-gray-200 text-center">
                <div className="text-sm text-gray-600">
                  Rating Difference: <span className="font-medium">
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
                <div className="text-xs text-gray-500 mt-1">
                  {getRatingConfidenceText(headToHeadData.rating_analysis.rating_confidence)}
                </div>
              </div>
            </div>

            {/* Probability Visualization */}
            <div className="bg-gray-50 rounded-lg p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-black">Winning Probability</h3>
                <span className={`text-sm font-medium ${getConfidenceColor(headToHeadData.probability.confidence)}`}>
                  {headToHeadData.probability.confidence.charAt(0).toUpperCase() + 
                   headToHeadData.probability.confidence.slice(1)} Confidence
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-black mb-1">
                    {headToHeadData.probability.player1_chance}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {headToHeadData.player1.name}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-black mb-1">
                    {headToHeadData.probability.player2_chance}%
                  </div>
                  <div className="text-sm text-gray-600">
                    {headToHeadData.player2.name}
                  </div>
                </div>
              </div>

              {/* Probability Bar */}
              <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden mb-2">
                <div
                  className="absolute left-0 top-0 h-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${headToHeadData.probability.player1_chance}%` }}
                ></div>
                <div
                  className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-500"
                  style={{ width: `${headToHeadData.probability.player2_chance}%` }}
                ></div>
              </div>

              <div className="text-center mb-4">
                <p className="text-sm text-gray-600">
                  {getBasisText(headToHeadData.probability.basis)}
                </p>
                {headToHeadData.probability.factors_used.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Factors: {getFactorsText(headToHeadData.probability.factors_used)}
                  </p>
                )}
              </div>

              {/* Rating Analysis Details */}
              {(headToHeadData.probability.basis === 'rating_based' || 
                headToHeadData.probability.basis === 'rating_with_matches') && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Rating-based prediction:</span>
                      <span className="ml-2 font-medium">
                        {headToHeadData.rating_analysis.expected_probability}% - {100 - headToHeadData.rating_analysis.expected_probability}%
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Rating difference impact:</span>
                      <span className="ml-2 font-medium">
                        {Math.abs(headToHeadData.rating_analysis.rating_difference)} point{Math.abs(headToHeadData.rating_analysis.rating_difference) !== 1 ? 's' : ''} 
                        {headToHeadData.rating_analysis.rating_difference > 0 ? ' advantage' : headToHeadData.rating_analysis.rating_difference < 0 ? ' disadvantage' : ''}
                      </span>
                    </div>
                  </div>
                  
                  {headToHeadData.probability.basis === 'rating_with_matches' && 
                   headToHeadData.direct_matches.total_matches > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      <div className="bg-gray-100 rounded p-2">
                        <div className="font-medium mb-1">Analysis Method:</div>
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
            </div>

            {/* Direct Matches */}
            {headToHeadData.direct_matches.total_matches > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center">
                  <div className="text-lg font-bold text-blue-600">
                    {headToHeadData.direct_matches.player1_wins}
                  </div>
                  <div className="text-sm text-gray-600">
                    {headToHeadData.player1.name} wins
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-gray-600">
                    {headToHeadData.direct_matches.total_matches}
                  </div>
                  <div className="text-sm text-gray-600">
                    Total matches
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-600">
                    {headToHeadData.direct_matches.player2_wins}
                  </div>
                  <div className="text-sm text-gray-600">
                    {headToHeadData.player2.name} wins
                  </div>
                </div>
              </div>
            )}

            {/* Common Opponents */}
            {headToHeadData.common_opponents.length > 0 && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <Users className="h-5 w-5 text-black mr-2" />
                    <h3 className="text-lg font-semibold text-black">
                      Common Opponents ({headToHeadData.common_opponents.length})
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowDetails(!showDetails)}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    {showDetails ? 'Hide' : 'Show'} Details
                  </button>
                </div>

                {showDetails && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr>
                          <th className="text-left py-2 px-3 border-b">Opponent</th>
                          <th className="text-center py-2 px-3 border-b">{headToHeadData.player1.name}</th>
                          <th className="text-center py-2 px-3 border-b">{headToHeadData.player2.name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {headToHeadData.common_opponents.map(opponent => (
                          <tr key={opponent.id}>
                            <td className="py-2 px-3 border-b font-medium">
                              {opponent.name}
                            </td>
                            <td className="py-2 px-3 border-b text-center">
                              <span className="text-green-600 font-medium">
                                {opponent.player1_record.wins}W
                              </span>
                              <span className="text-gray-400 mx-1">-</span>
                              <span className="text-red-600 font-medium">
                                {opponent.player1_record.losses}L
                              </span>
                            </td>
                            <td className="py-2 px-3 border-b text-center">
                              <span className="text-green-600 font-medium">
                                {opponent.player2_record.wins}W
                              </span>
                              <span className="text-gray-400 mx-1">-</span>
                              <span className="text-red-600 font-medium">
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

            {/* No Data Message */}
            {headToHeadData.direct_matches.total_matches === 0 && 
             headToHeadData.common_opponents.length === 0 && (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <BarChart3 className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No sufficient data for comparison</p>
                <p className="text-sm text-gray-500">
                  These players have no direct matches or common opponents yet.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Initial State */}
        {!player1Id || !player2Id || player1Id === player2Id ? (
          <div className="text-center py-8">
            <ArrowLeftRight className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">Select two different players to compare</p>
            <p className="text-sm text-gray-500">
              Choose players from the dropdowns above to see their head-to-head analysis.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}

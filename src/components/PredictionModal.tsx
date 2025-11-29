'use client'

import { useState, useEffect } from 'react'

interface Player {
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

interface PredictionModalProps {
  isOpen: boolean
  onClose: () => void
  player1: Player
  player2: Player
  slug: string
}

export default function PredictionModal({ isOpen, onClose, player1, player2, slug }: PredictionModalProps) {
  const [headToHeadData, setHeadToHeadData] = useState<HeadToHeadData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && player1?.id && player2?.id) {
      fetchHeadToHead()
    }
  }, [isOpen, player1?.id, player2?.id])

  const fetchHeadToHead = async () => {
    if (!player1?.id || !player2?.id || player1.id === player2.id) {
      setHeadToHeadData(null)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const response = await fetch(
        `/api/leagues/${slug}/head-to-head?player1_id=${player1.id}&player2_id=${player2.id}`
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

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white border-4 border-black max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="border-b-2 border-black px-6 py-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-black">Head-to-Head Analysis</h2>
            <p className="text-black opacity-70 text-sm mt-1">
              {player1.name} vs {player2.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-black text-2xl font-bold hover:text-red-500 transition-colors px-2 py-1"
          >
            ✕
          </button>
        </div>

        <div className="p-6">
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
            <div className="space-y-8">
              {/* Winning Probability */}
              <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
                  <h3 className="text-xl font-bold text-black mb-2 sm:mb-0">Winning Probability</h3>
                  <div className="text-sm font-semibold text-black">
                    {getConfidenceText(headToHeadData.probability.confidence)}
                  </div>
                </div>

                {/* Probability Display */}
                <div className="grid grid-cols-2 gap-6 mb-6">
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-bold text-black mb-2">
                      {headToHeadData.probability.player1_chance}%
                    </div>
                    <div className="text-black font-medium">
                      {headToHeadData.player1.name}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl sm:text-4xl font-bold text-black mb-2">
                      {headToHeadData.probability.player2_chance}%
                    </div>
                    <div className="text-black font-medium">
                      {headToHeadData.player2.name}
                    </div>
                  </div>
                </div>

                {/* Probability Bar */}
                <div className="relative h-4 bg-white border-2 border-black overflow-hidden mb-4">
                  <div
                    className="absolute left-0 top-0 h-full bg-green-500 transition-all duration-500"
                    style={{ width: `${headToHeadData.probability.player1_chance}%` }}
                  ></div>
                  <div
                    className="absolute right-0 top-0 h-full bg-red-500 transition-all duration-500"
                    style={{ width: `${headToHeadData.probability.player2_chance}%` }}
                  ></div>
                </div>

                <div className="text-center">
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
                <h3 className="text-xl font-bold text-black mb-6">Player Ratings</h3>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="text-center border-2 border-black p-6">
                    <div className="mb-3">
                      <div className="text-3xl sm:text-4xl font-bold text-black mb-1">
                        {headToHeadData.player1.current_rating}
                      </div>
                      <div className="text-sm text-black opacity-70">
                        {getRatingText(headToHeadData.player1.is_provisional)}
                      </div>
                    </div>
                    <div className="text-lg font-semibold text-black">{headToHeadData.player1.name}</div>
                    <div className="text-sm text-black opacity-70">{headToHeadData.player1.matches_played} matches played</div>
                  </div>
                  
                  <div className="text-center border-2 border-black p-6">
                    <div className="mb-3">
                      <div className="text-3xl sm:text-4xl font-bold text-black mb-1">
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
                
                <div className="mt-4 pt-4 border-t-2 border-black text-center">
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
                  <h3 className="text-xl font-bold text-black mb-6">Direct Match Record</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="text-center border-2 border-black p-4">
                      <div className="text-2xl font-bold text-green-500 mb-1">
                        {headToHeadData.direct_matches.player1_wins}
                      </div>
                      <div className="text-sm font-medium text-black">
                        {headToHeadData.player1.name} wins
                      </div>
                    </div>
                    <div className="text-center border-2 border-black p-4">
                      <div className="text-2xl font-bold text-black mb-1">
                        {headToHeadData.direct_matches.total_matches}
                      </div>
                      <div className="text-sm font-medium text-black">
                        Total matches
                      </div>
                    </div>
                    <div className="text-center border-2 border-black p-4">
                      <div className="text-2xl font-bold text-red-500 mb-1">
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
                  <h3 className="text-xl font-bold text-black mb-6">
                    Common Opponents ({headToHeadData.common_opponents.length})
                  </h3>

                  <div className="overflow-x-auto border-2 border-black">
                    <table className="w-full">
                      <thead className="border-b-2 border-black bg-white">
                        <tr>
                          <th className="text-left py-3 px-4 font-semibold text-black">Opponent</th>
                          <th className="text-center py-3 px-4 font-semibold text-black">{headToHeadData.player1.name}</th>
                          <th className="text-center py-3 px-4 font-semibold text-black">{headToHeadData.player2.name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {headToHeadData.common_opponents.map((opponent, index) => (
                          <tr key={opponent.id} className={index < headToHeadData.common_opponents.length - 1 ? 'border-b border-black' : ''}>
                            <td className="py-3 px-4 font-medium text-black">
                              {opponent.name}
                            </td>
                            <td className="py-3 px-4 text-center text-black">
                              <span className="text-green-500 font-semibold">
                                {opponent.player1_record.wins}W
                              </span>
                              <span className="text-black mx-2">-</span>
                              <span className="text-red-500 font-semibold">
                                {opponent.player1_record.losses}L
                              </span>
                            </td>
                            <td className="py-3 px-4 text-center text-black">
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
                </div>
              )}

              {/* Rating Analysis Details */}
              {(headToHeadData.probability.basis === 'rating_based' || 
                headToHeadData.probability.basis === 'rating_with_matches') && (
                <div className="border-2 border-black p-4">
                  <h4 className="text-lg font-bold text-black mb-3">Analysis Details</h4>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm">
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
                    <div className="mt-3 pt-3 border-t border-black">
                      <div className="text-sm text-black">
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

              {/* No Data Message */}
              {headToHeadData.direct_matches.total_matches === 0 && 
               headToHeadData.common_opponents.length === 0 && (
                <div className="text-center py-12 border-2 border-black">
                  <h4 className="text-xl font-bold text-black mb-2">No Data Available</h4>
                  <p className="text-black opacity-70">
                    These players have no direct matches or common opponents yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

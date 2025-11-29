'use client'

import { useState, useEffect } from 'react'
import { X } from 'lucide-react'

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
  const [showDetails, setShowDetails] = useState(false)

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
      <div className="bg-gray-50 rounded-lg border-2 border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-black">Head-to-Head Analysis</h2>
            <p className="text-gray-600 text-sm mt-1">
              {player1.name} vs {player2.name}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 space-y-4">
          {/* Loading State */}
          {loading && (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mb-4"></div>
              <p className="text-gray-600 text-lg">Analyzing matchup...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-white rounded-lg border-2 border-red-200 p-4">
              <p className="text-red-600 font-medium">{error}</p>
            </div>
          )}

          {/* Results */}
          {headToHeadData && !loading && (
            <div className="space-y-4">
              {/* Winning Probability Card */}
              <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="font-bold text-sm tracking-wide">WINNING PROBABILITY</h3>
                    <div className="text-xs font-medium opacity-75">
                      {getConfidenceText(headToHeadData.probability.confidence)}
                    </div>
                  </div>
                </div>

                <div className="p-4">
                  {/* Probability Display */}
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-green-600 mb-1">
                        {headToHeadData.probability.player1_chance}%
                      </div>
                      <div className="text-black font-medium text-sm">
                        {headToHeadData.player1.name}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl sm:text-3xl font-bold text-red-600 mb-1">
                        {headToHeadData.probability.player2_chance}%
                      </div>
                      <div className="text-black font-medium text-sm">
                        {headToHeadData.player2.name}
                      </div>
                    </div>
                  </div>

                  {/* Probability Bar */}
                  <div className="relative h-3 bg-gray-100 rounded-full overflow-hidden mb-4">
                    <div
                      className="absolute left-0 top-0 h-full bg-green-600 transition-all duration-500 rounded-full"
                      style={{ width: `${headToHeadData.probability.player1_chance}%` }}
                    ></div>
                    <div
                      className="absolute right-0 top-0 h-full bg-red-600 transition-all duration-500 rounded-full"
                      style={{ width: `${headToHeadData.probability.player2_chance}%` }}
                    ></div>
                  </div>

                  <div className="text-center">
                    <p className="text-gray-700 text-sm font-medium mb-1">
                      {getBasisText(headToHeadData.probability.basis)}
                    </p>
                    {headToHeadData.probability.factors_used.length > 0 && (
                      <p className="text-gray-500 text-xs">
                        Factors: {getFactorsText(headToHeadData.probability.factors_used)}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Player Ratings Card */}
              <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2">
                  <h3 className="font-bold text-sm tracking-wide">PLAYER RATINGS</h3>
                </div>

                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                    <div className="text-center bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-green-100 text-green-700 mx-auto mb-2">
                        {headToHeadData.player1.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-black mb-1">
                        {headToHeadData.player1.current_rating}
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {getRatingText(headToHeadData.player1.is_provisional)}
                      </div>
                      <div className="text-sm font-medium text-black mb-1">{headToHeadData.player1.name}</div>
                      <div className="text-xs text-gray-500">{headToHeadData.player1.matches_played} matches played</div>
                    </div>
                    
                    <div className="text-center bg-gray-50 rounded-lg p-4 border border-gray-100">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-red-100 text-red-700 mx-auto mb-2">
                        {headToHeadData.player2.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="text-xl sm:text-2xl font-bold text-black mb-1">
                        {headToHeadData.player2.current_rating}
                      </div>
                      <div className="text-xs text-gray-500 mb-1">
                        {getRatingText(headToHeadData.player2.is_provisional)}
                      </div>
                      <div className="text-sm font-medium text-black mb-1">{headToHeadData.player2.name}</div>
                      <div className="text-xs text-gray-500">{headToHeadData.player2.matches_played} matches played</div>
                    </div>
                  </div>
                  
                  <div className="text-center pt-3 border-t border-gray-100">
                    <div className="text-gray-700 text-sm">
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
                    <div className="text-gray-500 text-xs mt-1">
                      {getRatingConfidenceText(headToHeadData.rating_analysis.rating_confidence)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Direct Matches Card */}
              {headToHeadData.direct_matches.total_matches > 0 && (
                <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                  <div className="bg-gray-800 text-white px-4 py-2">
                    <h3 className="font-bold text-sm tracking-wide">DIRECT MATCH RECORD</h3>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-3 gap-3">
                      <div className="text-center bg-green-50 rounded-lg p-3 border border-green-100">
                        <div className="text-lg sm:text-xl font-bold text-green-600 mb-1">
                          {headToHeadData.direct_matches.player1_wins}
                        </div>
                        <div className="text-xs font-medium text-gray-700">
                          {headToHeadData.player1.name} wins
                        </div>
                      </div>
                      <div className="text-center bg-gray-50 rounded-lg p-3 border border-gray-100">
                        <div className="text-lg sm:text-xl font-bold text-black mb-1">
                          {headToHeadData.direct_matches.total_matches}
                        </div>
                        <div className="text-xs font-medium text-gray-700">
                          Total matches
                        </div>
                      </div>
                      <div className="text-center bg-red-50 rounded-lg p-3 border border-red-100">
                        <div className="text-lg sm:text-xl font-bold text-red-600 mb-1">
                          {headToHeadData.direct_matches.player2_wins}
                        </div>
                        <div className="text-xs font-medium text-gray-700">
                          {headToHeadData.player2.name} wins
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Common Opponents Card */}
              {headToHeadData.common_opponents.length > 0 && (
                <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                  <div className="bg-gray-800 text-white px-4 py-2">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                      <h3 className="font-bold text-sm tracking-wide">
                        COMMON OPPONENTS ({headToHeadData.common_opponents.length})
                      </h3>
                      <button
                        onClick={() => setShowDetails(!showDetails)}
                        className="text-xs font-medium text-white bg-gray-700 hover:bg-gray-600 px-3 py-1 rounded-md transition-colors mt-2 sm:mt-0"
                      >
                        {showDetails ? 'Hide' : 'Show'} Details
                      </button>
                    </div>
                  </div>

                  {showDetails && (
                    <div className="p-0">
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                              <th className="text-left py-2 px-3 font-medium text-gray-700 text-sm">Opponent</th>
                              <th className="text-center py-2 px-3 font-medium text-gray-700 text-sm">{headToHeadData.player1.name}</th>
                              <th className="text-center py-2 px-3 font-medium text-gray-700 text-sm">{headToHeadData.player2.name}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {headToHeadData.common_opponents.map((opponent, index) => (
                              <tr key={opponent.id} className={index < headToHeadData.common_opponents.length - 1 ? 'border-b border-gray-100' : ''}>
                                <td className="py-2 px-3 font-medium text-black text-sm">
                                  {opponent.name}
                                </td>
                                <td className="py-2 px-3 text-center text-sm">
                                  <span className="text-green-600 font-medium">
                                    {opponent.player1_record.wins}W
                                  </span>
                                  <span className="text-gray-400 mx-1">-</span>
                                  <span className="text-red-600 font-medium">
                                    {opponent.player1_record.losses}L
                                  </span>
                                </td>
                                <td className="py-2 px-3 text-center text-sm">
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
                    </div>
                  )}
                </div>
              )}

              {/* Rating Analysis Details Card */}
              {(headToHeadData.probability.basis === 'rating_based' || 
                headToHeadData.probability.basis === 'rating_with_matches') && (
                <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                  <div className="bg-gray-800 text-white px-4 py-2">
                    <h3 className="font-bold text-sm tracking-wide">ANALYSIS DETAILS</h3>
                  </div>

                  <div className="p-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm mb-3">
                      <div className="bg-gray-50 p-3 rounded-md">
                        <span className="text-gray-700 font-medium">Rating-based prediction:</span>
                        <div className="text-black font-semibold">
                          {headToHeadData.rating_analysis.expected_probability}% - {100 - headToHeadData.rating_analysis.expected_probability}%
                        </div>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-md">
                        <span className="text-gray-700 font-medium">Rating difference impact:</span>
                        <div className="text-black font-semibold">
                          {Math.abs(headToHeadData.rating_analysis.rating_difference)} point{Math.abs(headToHeadData.rating_analysis.rating_difference) !== 1 ? 's' : ''} 
                          {headToHeadData.rating_analysis.rating_difference > 0 ? ' advantage' : headToHeadData.rating_analysis.rating_difference < 0 ? ' disadvantage' : ''}
                        </div>
                      </div>
                    </div>
                    
                    {headToHeadData.probability.basis === 'rating_with_matches' && 
                     headToHeadData.direct_matches.total_matches > 0 && (
                      <div className="pt-3 border-t border-gray-100">
                        <div className="text-sm text-gray-700">
                          <div className="font-medium mb-2">Analysis Method:</div>
                          <div className="bg-blue-50 p-3 rounded-md border border-blue-100">
                            Combined rating prediction ({headToHeadData.rating_analysis.expected_probability}%) with 
                            direct match history ({Math.round((headToHeadData.direct_matches.player1_wins / headToHeadData.direct_matches.total_matches) * 100)}%) 
                            for enhanced accuracy
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* No Data Message */}
              {headToHeadData.direct_matches.total_matches === 0 && 
               headToHeadData.common_opponents.length === 0 && (
                <div className="text-center py-8 bg-white rounded-lg border-2 border-gray-200">
                  <div className="text-3xl mb-3">📊</div>
                  <h4 className="text-lg font-bold text-black mb-2">No Match Data Available</h4>
                  <p className="text-gray-600 text-sm">
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

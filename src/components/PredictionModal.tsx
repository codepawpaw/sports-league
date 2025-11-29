'use client'

import { useState, useEffect } from 'react'
import { X, BarChart3, Users, ArrowLeftRight } from 'lucide-react'

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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'high': return 'text-green-600'
      case 'medium': return 'text-green-500'
      case 'low': return 'text-green-400'
      default: return 'text-gray-600'
    }
  }

  const getBasisText = (basis: string) => {
    switch (basis) {
      case 'direct_matches': return 'Based on direct matches'
      case 'rating_with_matches': return 'Based on ratings and match history'
      case 'rating_based': return 'Based on player ratings'
      case 'common_opponents': return 'Based on common opponents'
      default: return ''
    }
  }

  const getRatingColor = (isProvisional: boolean) => {
    return isProvisional ? 'text-green-400' : 'text-green-600'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <ArrowLeftRight className="h-6 w-6 text-black mr-2" />
            <h2 className="text-xl font-bold text-black">Head-to-Head Analysis</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-black transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="p-6">
          {/* Match Header */}
          <div className="text-center mb-6">
            <h3 className="text-lg font-semibold text-black">
              {player1.name} vs {player2.name}
            </h3>
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
                </div>
              </div>

              {/* Probability Visualization */}
              <div className="bg-green-50 rounded-lg p-6">
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
                    className="absolute left-0 top-0 h-full bg-green-600 transition-all duration-500"
                    style={{ width: `${headToHeadData.probability.player1_chance}%` }}
                  ></div>
                  <div
                    className="absolute right-0 top-0 h-full bg-black transition-all duration-500"
                    style={{ width: `${headToHeadData.probability.player2_chance}%` }}
                  ></div>
                </div>

                <div className="text-center mb-4">
                  <p className="text-sm text-gray-600">
                    {getBasisText(headToHeadData.probability.basis)}
                  </p>
                </div>
              </div>

              {/* Direct Matches */}
              {headToHeadData.direct_matches.total_matches > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-lg font-bold text-green-600">
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
                    <div className="text-lg font-bold text-black">
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
                  <div className="flex items-center mb-4">
                    <Users className="h-5 w-5 text-black mr-2" />
                    <h3 className="text-lg font-semibold text-black">
                      Common Opponents ({headToHeadData.common_opponents.length})
                    </h3>
                  </div>

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
                              <span className="text-black font-medium">
                                {opponent.player1_record.losses}L
                              </span>
                            </td>
                            <td className="py-2 px-3 border-b text-center">
                              <span className="text-green-600 font-medium">
                                {opponent.player2_record.wins}W
                              </span>
                              <span className="text-gray-400 mx-1">-</span>
                              <span className="text-black font-medium">
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
        </div>
      </div>
    </div>
  )
}

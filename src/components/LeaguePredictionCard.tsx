'use client'

import { useEffect, useState } from 'react'
import { Trophy, TrendingUp, Target, ChevronDown, ChevronUp, BarChart3 } from 'lucide-react'

interface PlayerPrediction {
  id: string
  name: string
  currentPoints: number
  currentPosition: number
  matchesRemaining: number
  maxPossiblePoints: number
  readinessScore: number
  keyFactors: string[]
  winningStreak: number
  winPercentage: number
  setDifferential: number
}

interface PredictionData {
  predictions: PlayerPrediction[]
  totalPlayers: number
}

interface Tournament {
  id: string
  name: string
  slug: string
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
  tournament_type?: string
}

export default function LeaguePredictionCard({ 
  slug, 
  selectedTournament 
}: { 
  slug: string
  selectedTournament: Tournament | null
}) {
  const [predictions, setPredictions] = useState<PredictionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFormula, setShowFormula] = useState(false)

  useEffect(() => {
    if (selectedTournament) {
      fetchPredictions()
    } else {
      setPredictions(null)
      setLoading(false)
    }
  }, [slug, selectedTournament])

  const fetchPredictions = async () => {
    if (!selectedTournament) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/leagues/${slug}/predictions?tournamentId=${selectedTournament.id}`, {
        method: 'GET',
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })

      if (!response.ok) {
        throw new Error('Failed to fetch predictions')
      }

      const data = await response.json()
      setPredictions(data)
    } catch (err) {
      console.error('Error fetching predictions:', err)
      setError('Failed to load predictions')
    } finally {
      setLoading(false)
    }
  }

  if (!selectedTournament) {
    return null // Don't show component if no tournament is selected
  }

  // Hide Championship Readiness Score for non-round robin tournaments
  if (selectedTournament.tournament_type !== 'round_robin') {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
          <span className="ml-3 text-gray-600">Loading championship predictions...</span>
        </div>
      </div>
    )
  }

  if (error || !predictions || predictions.predictions.length === 0) {
    return null // Don't show anything if there's an error or no predictions
  }

  const [firstCandidate, secondCandidate] = predictions.predictions

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
      {/* Header */}
      <div className="flex items-center mb-6">
        <h2 className="text-xl font-bold text-black">Championship Readiness Score</h2>
      </div>

      {/* Top 2 Candidates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* First Candidate */}
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-green-800 font-bold text-sm">1</span>
              </div>
              <div>
                <h3 className="font-bold text-black text-lg">{firstCandidate.name}</h3>
                <p className="text-gray-600 text-sm">#{firstCandidate.currentPosition} • {firstCandidate.currentPoints} points</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-600">{firstCandidate.readinessScore}%</div>
              <div className="text-xs text-gray-500">readiness score</div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div 
              className="bg-green-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(firstCandidate.readinessScore, 5)}%` }}
            ></div>
          </div>

          {/* Key Factors */}
          <div className="space-y-1">
            {firstCandidate.keyFactors.map((factor, index) => (
              <div key={index} className="flex items-center text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2"></div>
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Second Candidate */}
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center mr-3">
                <span className="text-gray-600 font-bold text-sm">2</span>
              </div>
              <div>
                <h3 className="font-bold text-black text-lg">{secondCandidate.name}</h3>
                <p className="text-gray-600 text-sm">#{secondCandidate.currentPosition} • {secondCandidate.currentPoints} points</p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-black">{secondCandidate.readinessScore}%</div>
              <div className="text-xs text-gray-500">readiness score</div>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
            <div 
              className="bg-gray-500 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.max(secondCandidate.readinessScore, 5)}%` }}
            ></div>
          </div>

          {/* Key Factors */}
          <div className="space-y-1">
            {secondCandidate.keyFactors.map((factor, index) => (
              <div key={index} className="flex items-center text-sm text-gray-600">
                <div className="w-1.5 h-1.5 bg-gray-500 rounded-full mr-2"></div>
                <span>{factor}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Formula Explanation */}
      <div className="mt-6 pt-4 border-t border-gray-100">
        <button 
          onClick={() => setShowFormula(!showFormula)}
          className="flex items-center justify-between w-full text-left text-sm text-gray-600 hover:text-black transition-colors"
        >
          <div className="flex items-center">
            <span className="font-medium">How is the readiness score calculated?</span>
          </div>
          {showFormula ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        
        {showFormula && (
          <div className="mt-3 p-3 bg-gray-50 rounded-lg text-sm">
            <p className="text-gray-700 mb-3">
              The Championship Readiness Score is calculated using three key components:
            </p>
            <div className="space-y-2">
              <div className="flex items-start">
                <div className="w-3 h-3 bg-blue-500 rounded-full mt-1 mr-3 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-800">Current Position (40%)</span>
                  <p className="text-gray-600">Higher score for better league standing</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-3 h-3 bg-orange-500 rounded-full mt-1 mr-3 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-800">Match Outlook (35%)</span>
                  <p className="text-gray-600">Expected performance against remaining opponents</p>
                </div>
              </div>
              <div className="flex items-start">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-1 mr-3 flex-shrink-0"></div>
                <div>
                  <span className="font-medium text-gray-800">Recent Form (25%)</span>
                  <p className="text-gray-600">Bonus for winning streaks and recent performance</p>
                </div>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-3">
              Note: These are readiness scores, not probabilities. Scores above 100% total are possible.
            </p>
          </div>
        )}
      </div>

      {/* Footer Stats */}
      <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center text-sm text-gray-500">
          <Target className="h-4 w-4 mr-1" />
          <span>Based on current standings, remaining matches, and recent form</span>
        </div>
        <div className="flex items-center text-sm text-gray-500">
          <TrendingUp className="h-4 w-4 mr-1" />
          <span>{predictions.totalPlayers} total players</span>
        </div>
      </div>
    </div>
  )
}

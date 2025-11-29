'use client'

import { useState } from 'react'
import { Clock, Calendar, Trophy } from 'lucide-react'
import PredictionModal from './PredictionModal'

interface Match {
  id: string
  player1: { id: string; name: string }
  player2: { id: string; name: string }
  player1_score: number | null
  player2_score: number | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
}

interface MatchTabsProps {
  upcomingMatches: Match[]
  slug: string
}

export default function MatchTabs({ upcomingMatches, slug }: MatchTabsProps) {
  const [predictionModalOpen, setPredictionModalOpen] = useState(false)
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState<{
    player1: { id: string; name: string }
    player2: { id: string; name: string }
  } | null>(null)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const handlePredictionClick = (match: Match) => {
    setSelectedMatchPlayers({
      player1: match.player1,
      player2: match.player2
    })
    setPredictionModalOpen(true)
  }

  const getMatchStatusColor = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'text-green-600'
      case 'in_progress':
        return 'text-green-500'
      default:
        return 'text-gray-600'
    }
  }

  const getWinner = (match: Match) => {
    if (match.player1_score === null || match.player2_score === null) return null
    return match.player1_score > match.player2_score ? match.player1 : match.player2
  }

  return (
    <div className="card mb-8">
      {/* Header */}
      <div className="border-b border-gray-200">
        <div className="px-3 md:px-6 py-3 md:py-4 border-b-2 border-green-600 bg-green-50">
          <div className="flex items-center justify-center md:justify-start gap-1 md:gap-2">
            <Clock className="h-4 w-4 text-green-600" />
            <span className="text-sm md:text-base font-medium text-green-600">Upcoming Matches</span>
            <span className="bg-green-200 text-green-700 px-2 py-1 rounded-full text-xs font-medium">
              {upcomingMatches.length}
            </span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="space-y-3">
          {upcomingMatches.length > 0 ? (
            upcomingMatches.map((match) => (
              <div key={match.id} className="p-4 hover:bg-gray-50 rounded-lg border border-transparent hover:border-gray-200 transition-colors">
                {/* Desktop Layout */}
                <div className="hidden md:flex items-center justify-between">
                  {/* Match Info */}
                  <div className="flex items-center space-x-6">
                    <div className="flex items-center space-x-4">
                      {/* Player 1 */}
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                          <span className="text-green-600 font-medium text-sm">
                            {match.player1.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-black">{match.player1.name}</span>
                      </div>
                      
                      {/* VS */}
                      <div className="text-gray-400 font-medium text-sm">VS</div>
                      
                      {/* Player 2 */}
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                          <span className="text-gray-600 font-medium text-sm">
                            {match.player2.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="font-medium text-black">{match.player2.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Status and Actions */}
                  <div className="flex items-center space-x-4">
                    <div className="text-right">
                      <div className={`text-sm font-medium ${getMatchStatusColor(match.status)}`}>
                        {match.status === 'scheduled' ? 'Scheduled' : 'In Progress'}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(match.scheduled_at)}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handlePredictionClick(match)}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
                    >
                      Prediction
                    </button>
                  </div>
                </div>

                {/* Mobile Layout */}
                <div className="md:hidden space-y-3">
                  {/* Players Section */}
                  <div className="space-y-2">
                    {/* Player 1 */}
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 font-medium text-base">
                          {match.player1.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-black text-base truncate">{match.player1.name}</span>
                    </div>
                    
                    {/* VS indicator */}
                    <div className="text-center">
                      <span className="text-gray-400 font-medium text-sm">VS</span>
                    </div>
                    
                    {/* Player 2 */}
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-gray-600 font-medium text-base">
                          {match.player2.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="font-medium text-black text-base truncate">{match.player2.name}</span>
                    </div>
                  </div>

                  {/* Status and Action Section */}
                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex flex-col">
                      <div className={`text-sm font-medium ${getMatchStatusColor(match.status)}`}>
                        {match.status === 'scheduled' ? 'Scheduled' : 'In Progress'}
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                        <Calendar className="h-3 w-3" />
                        {formatDate(match.scheduled_at)}
                      </div>
                    </div>
                    
                    <button
                      onClick={() => handlePredictionClick(match)}
                      className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-md text-sm font-medium transition-colors flex-shrink-0"
                    >
                      Predict
                    </button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 mb-2">No upcoming matches</p>
              <p className="text-sm text-gray-500">
                Check back later for upcoming scheduled matches.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Prediction Modal */}
      {selectedMatchPlayers && (
        <PredictionModal
          isOpen={predictionModalOpen}
          onClose={() => {
            setPredictionModalOpen(false)
            setSelectedMatchPlayers(null)
          }}
          player1={selectedMatchPlayers.player1}
          player2={selectedMatchPlayers.player2}
          slug={slug}
        />
      )}
    </div>
  )
}

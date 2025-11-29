'use client'

import { useState } from 'react'
import { Calendar, Clock, Trophy } from 'lucide-react'
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

interface UpcomingMatchesCarouselProps {
  upcomingMatches: Match[]
  slug: string
}

export default function UpcomingMatchesCarousel({ upcomingMatches, slug }: UpcomingMatchesCarouselProps) {
  const [predictionModalOpen, setPredictionModalOpen] = useState(false)
  const [selectedMatchPlayers, setSelectedMatchPlayers] = useState<{
    player1: { id: string; name: string }
    player2: { id: string; name: string }
  } | null>(null)

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleTimeString('en-US', {
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
        return 'text-yellow-600'
      default:
        return 'text-gray-600'
    }
  }

  const getMatchStatusText = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'Scheduled'
      case 'in_progress':
        return 'In Progress'
      default:
        return 'Unknown'
    }
  }

  if (upcomingMatches.length === 0) {
    return (
      <div className="bg-gray-50 border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          {/* Header */}
          <div className="flex items-center mb-4">
            <div className="bg-green-600 text-white px-3 py-1 text-sm font-bold tracking-wide">
              UPCOMING
            </div>
          </div>

          <div className="text-center py-8">
            <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 mb-2">No upcoming matches</p>
            <p className="text-sm text-gray-500">
              Check back later for upcoming scheduled matches.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className="bg-green-600 text-white px-3 py-1 text-sm font-bold tracking-wide">
            UPCOMING
          </div>
        </div>

        {/* Horizontal Scrollable Container */}
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollBehavior: 'smooth' }}>
            {upcomingMatches.map((match) => {
              return (
                <div 
                  key={match.id} 
                  className="flex-shrink-0 w-48 sm:w-56 bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-green-300 hover:shadow-md transition-all duration-200"
                >
                  {/* Date Header */}
                  <div className="bg-green-600 text-white px-3 py-1 text-xs font-medium flex items-center justify-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(match.scheduled_at)}
                  </div>

                  {/* Match Content */}
                  <div className="p-3 space-y-3">
                    {/* Player 1 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-green-100 text-green-700">
                          {match.player1.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium truncate text-black">
                          {match.player1.name.length > 12 
                            ? match.player1.name.substring(0, 12) + '...' 
                            : match.player1.name}
                        </span>
                      </div>
                    </div>

                    {/* VS Divider */}
                    <div className="text-center">
                      <span className="text-gray-400 font-medium text-xs">VS</span>
                    </div>

                    {/* Player 2 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-gray-100 text-gray-600">
                          {match.player2.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-sm font-medium truncate text-black">
                          {match.player2.name.length > 12 
                            ? match.player2.name.substring(0, 12) + '...' 
                            : match.player2.name}
                        </span>
                      </div>
                    </div>

                    {/* Match Status and Time */}
                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className={`font-medium ${getMatchStatusColor(match.status)}`}>
                          {getMatchStatusText(match.status)}
                        </span>
                        <span className="text-gray-500">
                          {formatTime(match.scheduled_at)}
                        </span>
                      </div>
                      
                      {/* Prediction Button */}
                      <button
                        onClick={() => handlePredictionClick(match)}
                        className="w-full bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 hover:border-green-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors flex items-center justify-center gap-1"
                      >
                        <Trophy className="h-3 w-3" />
                        Predict
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Scroll indicators for better UX */}
          <div className="absolute top-1/2 -translate-y-1/2 left-0 w-4 h-full bg-gradient-to-r from-gray-50 to-transparent pointer-events-none opacity-50 sm:opacity-0"></div>
          <div className="absolute top-1/2 -translate-y-1/2 right-0 w-4 h-full bg-gradient-to-l from-gray-50 to-transparent pointer-events-none opacity-50 sm:opacity-0"></div>
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

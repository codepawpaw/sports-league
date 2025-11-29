'use client'

import { Calendar, Trophy } from 'lucide-react'

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

interface CompletedMatchesCarouselProps {
  recentMatches: Match[]
}

export default function CompletedMatchesCarousel({ recentMatches }: CompletedMatchesCarouselProps) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const getWinner = (match: Match) => {
    if (match.player1_score === null || match.player2_score === null) return null
    return match.player1_score > match.player2_score ? match.player1 : match.player2
  }

  if (recentMatches.length === 0) {
    return null
  }

  return (
    <div className="bg-gray-50 border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        {/* Header */}
        <div className="flex items-center mb-4">
          <div className="bg-black text-white px-3 py-1 text-sm font-bold tracking-wide">
            COMPLETED
          </div>
        </div>

        {/* Horizontal Scrollable Container */}
        <div className="relative">
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollBehavior: 'smooth' }}>
            {recentMatches.map((match) => {
              const winner = getWinner(match)
              return (
                <div 
                  key={match.id} 
                  className="flex-shrink-0 w-48 sm:w-56 bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-green-300 hover:shadow-md transition-all duration-200"
                >
                  {/* Date Header */}
                  <div className="bg-gray-800 text-white px-3 py-1 text-xs font-medium flex items-center justify-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDate(match.completed_at)}
                  </div>

                  {/* Match Content */}
                  <div className="p-3 space-y-3">
                    {/* Player 1 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          winner?.id === match.player1.id 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {match.player1.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-sm font-medium truncate ${
                          winner?.id === match.player1.id ? 'text-black' : 'text-gray-600'
                        }`}>
                          {match.player1.name.length > 12 
                            ? match.player1.name.substring(0, 12) + '...' 
                            : match.player1.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <span className={`text-lg font-bold ${
                          winner?.id === match.player1.id ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {match.player1_score}
                        </span>
                        {winner?.id === match.player1.id && (
                          <Trophy className="h-3 w-3 text-green-600" />
                        )}
                      </div>
                    </div>

                    {/* Player 2 */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 flex-1 min-w-0">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                          winner?.id === match.player2.id 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-gray-100 text-gray-600'
                        }`}>
                          {match.player2.name.charAt(0).toUpperCase()}
                        </div>
                        <span className={`text-sm font-medium truncate ${
                          winner?.id === match.player2.id ? 'text-black' : 'text-gray-600'
                        }`}>
                          {match.player2.name.length > 12 
                            ? match.player2.name.substring(0, 12) + '...' 
                            : match.player2.name}
                        </span>
                      </div>
                      <div className="flex items-center space-x-1 flex-shrink-0">
                        <span className={`text-lg font-bold ${
                          winner?.id === match.player2.id ? 'text-green-600' : 'text-gray-400'
                        }`}>
                          {match.player2_score}
                        </span>
                        {winner?.id === match.player2.id && (
                          <Trophy className="h-3 w-3 text-green-600" />
                        )}
                      </div>
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
    </div>
  )
}

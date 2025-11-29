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
  recentMatches: Match[]
  slug: string
}

export default function MatchTabs({ upcomingMatches, recentMatches, slug }: MatchTabsProps) {
  const [activeTab, setActiveTab] = useState<'incoming' | 'completed'>('incoming')
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
      {/* Tab Headers */}
      <div className="border-b border-gray-200">
        <div className="flex">
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition-colors flex-1 md:flex-none ${
              activeTab === 'incoming'
                ? 'border-green-600 text-green-600 bg-green-50'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center md:justify-start gap-1 md:gap-2">
              <Clock className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Incoming Match</span>
              <span className="sm:hidden">Incoming</span>
              <span className="bg-gray-200 text-gray-700 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs">
                {upcomingMatches.length}
              </span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('completed')}
            className={`px-3 md:px-6 py-3 md:py-4 text-xs md:text-sm font-medium border-b-2 transition-colors flex-1 md:flex-none ${
              activeTab === 'completed'
                ? 'border-green-600 text-green-600 bg-green-50'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-center md:justify-start gap-1 md:gap-2">
              <Trophy className="h-3 w-3 md:h-4 md:w-4" />
              <span className="hidden sm:inline">Completed Match</span>
              <span className="sm:hidden">Completed</span>
              <span className="bg-gray-200 text-gray-700 px-1.5 md:px-2 py-0.5 md:py-1 rounded-full text-xs">
                {recentMatches.length}
              </span>
            </div>
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'incoming' && (
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
                <p className="text-gray-600 mb-2">No incoming matches</p>
                <p className="text-sm text-gray-500">
                  Check back later for upcoming scheduled matches.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'completed' && (
          <div className="grid gap-4 sm:gap-6">
            {recentMatches.length > 0 ? (
              recentMatches.map((match) => {
                const winner = getWinner(match)
                return (
                  <div 
                    key={match.id} 
                    className="group relative bg-white border-2 border-gray-100 rounded-xl p-4 sm:p-6 hover:border-green-100 hover:shadow-lg transition-all duration-300 ease-in-out transform hover:-translate-y-1"
                  >
                    {/* Winner Badge - Desktop */}
                    <div className="hidden sm:block absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-green-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-md">
                        {winner?.name} Wins
                      </div>
                    </div>

                    {/* Desktop Layout */}
                    <div className="hidden md:flex items-center justify-between pt-4">
                      {/* Left Player */}
                      <div className="flex flex-col items-center space-y-3 flex-1">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                          winner?.id === match.player1.id 
                            ? 'bg-green-100 border-2 border-green-600 scale-110' 
                            : 'bg-white border-2 border-gray-300 grayscale opacity-75'
                        }`}>
                          <span className={`font-bold text-xl ${
                            winner?.id === match.player1.id ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {match.player1.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-center">
                          <h3 className={`font-semibold text-lg leading-tight ${
                            winner?.id === match.player1.id ? 'text-black' : 'text-gray-500'
                          }`}>
                            {match.player1.name}
                          </h3>
                          {winner?.id === match.player1.id && (
                            <div className="flex items-center justify-center mt-1">
                              <Trophy className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Score Section */}
                      <div className="flex flex-col items-center space-y-4 px-8">
                        <div className="flex items-center space-x-6">
                          <span className={`text-4xl font-black tracking-tight ${
                            winner?.id === match.player1.id ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {match.player1_score}
                          </span>
                          <div className="text-gray-300 text-2xl font-light">—</div>
                          <span className={`text-4xl font-black tracking-tight ${
                            winner?.id === match.player2.id ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {match.player2_score}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">{formatDate(match.completed_at)}</span>
                        </div>
                      </div>
                      
                      {/* Right Player */}
                      <div className="flex flex-col items-center space-y-3 flex-1">
                        <div className={`w-16 h-16 rounded-full flex items-center justify-center shadow-md transition-all duration-300 ${
                          winner?.id === match.player2.id 
                            ? 'bg-green-100 border-2 border-green-600 scale-110' 
                            : 'bg-white border-2 border-gray-300 grayscale opacity-75'
                        }`}>
                          <span className={`font-bold text-xl ${
                            winner?.id === match.player2.id ? 'text-green-600' : 'text-gray-500'
                          }`}>
                            {match.player2.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="text-center">
                          <h3 className={`font-semibold text-lg leading-tight ${
                            winner?.id === match.player2.id ? 'text-black' : 'text-gray-500'
                          }`}>
                            {match.player2.name}
                          </h3>
                          {winner?.id === match.player2.id && (
                            <div className="flex items-center justify-center mt-1">
                              <Trophy className="h-5 w-5 text-green-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mobile Layout */}
                    <div className="md:hidden space-y-4">
                      {/* Winner Badge - Mobile */}
                      <div className="text-center">
                        <div className="inline-flex items-center bg-green-600 text-white px-4 py-1 rounded-full text-sm font-semibold">
                          <Trophy className="h-4 w-4 mr-1" />
                          {winner?.name} Wins
                        </div>
                      </div>

                      {/* Score Display */}
                      <div className="text-center">
                        <div className="flex items-center justify-center space-x-6 mb-3">
                          <span className={`text-3xl font-black ${
                            winner?.id === match.player1.id ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {match.player1_score}
                          </span>
                          <div className="text-gray-300 text-xl">—</div>
                          <span className={`text-3xl font-black ${
                            winner?.id === match.player2.id ? 'text-green-600' : 'text-gray-400'
                          }`}>
                            {match.player2_score}
                          </span>
                        </div>
                      </div>

                      {/* Players */}
                      <div className="space-y-3">
                        <div className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                            winner?.id === match.player1.id ? 'bg-green-100 border-2 border-green-600' : 'bg-white border-2 border-gray-300'
                          }`}>
                            <span className={`font-bold text-base ${
                              winner?.id === match.player1.id ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {match.player1.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <span className={`font-semibold text-base ${
                              winner?.id === match.player1.id ? 'text-black' : 'text-gray-600'
                            }`}>
                              {match.player1.name}
                            </span>
                          </div>
                          {winner?.id === match.player1.id && (
                            <Trophy className="h-5 w-5 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                        
                        <div className="flex items-center space-x-4 p-3 rounded-lg bg-gray-50">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 shadow-sm ${
                            winner?.id === match.player2.id ? 'bg-green-100 border-2 border-green-600' : 'bg-white border-2 border-gray-300'
                          }`}>
                            <span className={`font-bold text-base ${
                              winner?.id === match.player2.id ? 'text-green-600' : 'text-gray-500'
                            }`}>
                              {match.player2.name.charAt(0).toUpperCase()}
                            </span>
                          </div>
                          <div className="flex-1">
                            <span className={`font-semibold text-base ${
                              winner?.id === match.player2.id ? 'text-black' : 'text-gray-600'
                            }`}>
                              {match.player2.name}
                            </span>
                          </div>
                          {winner?.id === match.player2.id && (
                            <Trophy className="h-5 w-5 text-green-600 flex-shrink-0" />
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="flex justify-center pt-2">
                        <div className="text-xs text-gray-500 flex items-center gap-2 bg-gray-100 px-3 py-1 rounded-full">
                          <Calendar className="h-3 w-3" />
                          <span className="font-medium">{formatDate(match.completed_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            ) : (
              <div className="text-center py-12">
                <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">No completed matches</p>
                <p className="text-sm text-gray-500">
                  Completed matches will appear here once games are finished.
                </p>
              </div>
            )}
          </div>
        )}
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

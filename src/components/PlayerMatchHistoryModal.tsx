'use client'

import { useEffect, useState } from 'react'

interface PlayerMatch {
  id: string
  opponent: {
    id: string
    name: string
  }
  player_score: number
  opponent_score: number
  result: 'win' | 'loss'
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
}

interface Player {
  id: string
  name: string
}

interface PlayerMatchHistoryData {
  player: Player
  matches: PlayerMatch[]
}

interface PlayerMatchHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  player: Player | null
  slug: string
}

export default function PlayerMatchHistoryModal({ 
  isOpen, 
  onClose, 
  player, 
  slug 
}: PlayerMatchHistoryModalProps) {
  const [data, setData] = useState<PlayerMatchHistoryData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen && player) {
      fetchPlayerMatches()
    } else {
      setData(null)
      setError(null)
    }
  }, [isOpen, player])

  const fetchPlayerMatches = async () => {
    if (!player) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/leagues/${slug}/players/${player.id}/matches`)
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to fetch match history')
      }

      const matchData = await response.json()
      setData(matchData)
    } catch (err) {
      console.error('Error fetching player matches:', err)
      setError(err instanceof Error ? err.message : 'Failed to load match history')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusText = (status: string) => {
    const displayText = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled'
    }

    const textColor = status === 'cancelled' ? 'text-red-600' : 'text-black'

    return (
      <span className={`text-xs font-medium ${textColor}`}>
        {displayText[status as keyof typeof displayText] || status}
      </span>
    )
  }

  const getMatchStats = () => {
    if (!data?.matches) return { wins: 0, losses: 0, total: 0 }
    
    const completed = data.matches.filter(m => m.status === 'completed')
    const wins = completed.filter(m => m.result === 'win').length
    const losses = completed.filter(m => m.result === 'loss').length
    
    return { wins, losses, total: completed.length }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-xl">
        {/* Header */}
        <div className="bg-gray-800 text-white px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold">
                {player?.name} - Match History
              </h2>
              {data && (
                <p className="text-sm text-gray-300 mt-1">
                  <span className="text-green-400 font-medium">{getMatchStats().wins} wins</span>, <span className="text-red-400 font-medium">{getMatchStats().losses} losses</span> from {getMatchStats().total} completed matches
                </p>
              )}
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-gray-700 px-4 py-2 rounded-lg transition-colors font-medium"
            >
              Close
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)] bg-gray-50">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="spinner mr-4"></div>
              <p className="text-gray-600">Loading match history...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchPlayerMatches}
                className="bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-gray-300 px-6 py-3 rounded-lg font-medium transition-all duration-200"
              >
                Try Again
              </button>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-3">
              {data.matches.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-gray-800 mb-2">No matches found</h3>
                  <p className="text-gray-600">{data.player.name} hasn't played any matches yet.</p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                  {data.matches.map((match) => {
                    const isWin = match.result === 'win';
                    const isCompleted = match.status === 'completed';
                    
                    return (
                      <div 
                        key={match.id} 
                        className="bg-white rounded-lg border-2 border-gray-200 hover:border-green-300 hover:shadow-md transition-all duration-200 overflow-hidden"
                      >
                        {/* Match Header */}
                        <div className={`px-4 py-2 text-xs font-medium text-center ${
                          isCompleted 
                            ? (isWin ? 'bg-green-600 text-white' : 'bg-red-500 text-white')
                            : 'bg-gray-200 text-gray-700'
                        }`}>
                          {isCompleted 
                            ? (isWin ? 'WIN' : 'LOSS')
                            : getStatusText(match.status)
                          }
                        </div>

                        {/* Match Content */}
                        <div className="p-4 space-y-3">
                          {/* Opponent */}
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-bold text-gray-600 flex-shrink-0">
                              {match.opponent.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="text-sm font-medium text-gray-900 truncate">
                                vs {match.opponent.name}
                              </h3>
                            </div>
                          </div>

                          {/* Score Display for Completed Matches */}
                          {isCompleted && (
                            <div className="flex items-center justify-center py-2">
                              <div className="flex items-center space-x-3">
                                <span className={`text-lg font-bold ${isWin ? 'text-green-600' : 'text-gray-600'}`}>
                                  {match.player_score}
                                </span>
                                <span className="text-gray-400 text-sm">-</span>
                                <span className={`text-lg font-bold ${!isWin ? 'text-green-600' : 'text-gray-600'}`}>
                                  {match.opponent_score}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Date */}
                          <div className="text-xs text-gray-500 text-center border-t border-gray-100 pt-2">
                            {match.completed_at ? (
                              formatDate(match.completed_at)
                            ) : match.scheduled_at ? (
                              `Scheduled ${formatDateTime(match.scheduled_at)}`
                            ) : (
                              'No date scheduled'
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

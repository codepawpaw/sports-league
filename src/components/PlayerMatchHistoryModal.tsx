'use client'

import { useEffect, useState } from 'react'
import { X, Trophy, Calendar, Clock } from 'lucide-react'

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

  const getStatusBadge = (status: string) => {
    const badges = {
      scheduled: 'bg-blue-100 text-blue-800',
      in_progress: 'bg-yellow-100 text-yellow-800',
      completed: 'bg-green-100 text-green-800',
      cancelled: 'bg-red-100 text-red-800'
    }
    
    const displayText = {
      scheduled: 'Scheduled',
      in_progress: 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled'
    }

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${badges[status as keyof typeof badges] || badges.scheduled}`}>
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
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Trophy className="h-6 w-6 text-black mr-3" />
            <div>
              <h2 className="text-xl font-bold text-black">
                {player?.name} - Match History
              </h2>
              {data && (
                <p className="text-sm text-gray-600 mt-1">
                  {getMatchStats().wins} wins, {getMatchStats().losses} losses from {getMatchStats().total} completed matches
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
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
                className="btn-outline"
              >
                Try Again
              </button>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4">
              {data.matches.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-600 mb-2">No matches found</h3>
                  <p className="text-gray-500">{data.player.name} hasn't played any matches yet.</p>
                </div>
              ) : (
                data.matches.map((match) => (
                  <div key={match.id} className="card p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-4 mb-2">
                          <h3 className="font-semibold text-black">
                            vs {match.opponent.name}
                          </h3>
                          {getStatusBadge(match.status)}
                        </div>
                        
                        {match.status === 'completed' && (
                          <div className="flex items-center gap-4 mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-lg font-bold text-black">
                                {match.player_score} - {match.opponent_score}
                              </span>
                              <span className={`font-medium ${match.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                                ({match.result === 'win' ? 'Win' : 'Loss'})
                              </span>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center text-sm text-gray-500">
                          {match.completed_at ? (
                            <>
                              <Calendar className="h-4 w-4 mr-1" />
                              Completed {formatDate(match.completed_at)}
                            </>
                          ) : match.scheduled_at ? (
                            <>
                              <Clock className="h-4 w-4 mr-1" />
                              Scheduled {formatDateTime(match.scheduled_at)}
                            </>
                          ) : (
                            <span className="text-gray-400">No date scheduled</span>
                          )}
                        </div>
                      </div>

                      {match.status === 'completed' && (
                        <div className="flex-shrink-0 ml-4">
                          <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
                            match.result === 'win' 
                              ? 'bg-green-100 text-green-600' 
                              : 'bg-red-100 text-red-600'
                          }`}>
                            {match.result === 'win' ? '✓' : '✗'}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

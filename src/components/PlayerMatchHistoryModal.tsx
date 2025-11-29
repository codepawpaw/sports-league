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
      <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-black">
          <div>
            <h2 className="text-2xl font-bold text-black">
              {player?.name} - Match History
            </h2>
            {data && (
              <p className="text-sm text-black mt-2">
                <span className="text-green-600 font-medium">{getMatchStats().wins} wins</span>, <span className="text-red-600 font-medium">{getMatchStats().losses} losses</span> from {getMatchStats().total} completed matches
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="text-black hover:bg-black hover:text-white px-4 py-2 border border-black rounded transition-colors font-medium"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="spinner mr-4"></div>
              <p className="text-black">Loading match history...</p>
            </div>
          )}

          {error && (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button
                onClick={fetchPlayerMatches}
                className="text-black border border-black px-6 py-3 rounded-lg font-medium hover:bg-black hover:text-white transition-colors duration-200"
              >
                Try Again
              </button>
            </div>
          )}

          {data && !loading && (
            <div className="space-y-4">
              {data.matches.length === 0 ? (
                <div className="text-center py-12">
                  <h3 className="text-lg font-medium text-black mb-2">No matches found</h3>
                  <p className="text-black">{data.player.name} hasn't played any matches yet.</p>
                </div>
              ) : (
                data.matches.map((match) => (
                  <div key={match.id} className="bg-white border border-black p-6 rounded-lg">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mb-3">
                          <h3 className="text-lg font-bold text-black">
                            vs {match.opponent.name}
                          </h3>
                          {getStatusText(match.status)}
                        </div>
                        
                        {match.status === 'completed' && (
                          <div className="mb-3">
                            <span className="text-2xl font-bold text-black mr-3">
                              {match.player_score} - {match.opponent_score}
                            </span>
                            <span className={`text-lg font-bold ${match.result === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                              {match.result === 'win' ? 'WIN' : 'LOSS'}
                            </span>
                          </div>
                        )}

                        <div className="text-sm text-black">
                          {match.completed_at ? (
                            <span>Completed {formatDate(match.completed_at)}</span>
                          ) : match.scheduled_at ? (
                            <span>Scheduled {formatDateTime(match.scheduled_at)}</span>
                          ) : (
                            <span>No date scheduled</span>
                          )}
                        </div>
                      </div>
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

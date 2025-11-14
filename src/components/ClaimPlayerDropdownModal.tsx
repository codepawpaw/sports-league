'use client'

import { useState, useEffect } from 'react'
import { X, UserPlus, Search, LogIn } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Player {
  id: string
  name: string
  email: string | null
}

interface ClaimPlayerDropdownModalProps {
  isOpen: boolean
  onClose: () => void
  slug: string
  currentUserEmail: string | null
}

export default function ClaimPlayerDropdownModal({
  isOpen,
  onClose,
  slug,
  currentUserEmail
}: ClaimPlayerDropdownModalProps) {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const router = useRouter()

  useEffect(() => {
    if (isOpen) {
      fetchPlayers()
    }
  }, [isOpen, slug])

  const fetchPlayers = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/leagues/${slug}/players`)
      if (!response.ok) {
        throw new Error('Failed to fetch players')
      }
      const data = await response.json()
      // Filter out players that already have an email (are already claimed)
      const availablePlayers = data.players.filter((player: Player) => !player.email)
      setPlayers(availablePlayers)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  const filteredPlayers = players.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const handlePlayerSelect = (player: Player) => {
    setSelectedPlayer(player)
  }

  const handleClaimPlayer = async () => {
    if (!selectedPlayer) return
    
    if (!currentUserEmail) {
      // Redirect to auth page if not logged in
      router.push(`/${slug}/auth`)
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/leagues/${slug}/claims`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: selectedPlayer.id
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit claim')
      }

      // Close modal and show success
      onClose()
      // You might want to show a success message here or refresh the page
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAuthRedirect = () => {
    router.push(`/${slug}/auth`)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-black">Claim a Player</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {!currentUserEmail ? (
            // Not logged in state
            <div className="text-center space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <LogIn className="h-12 w-12 text-blue-600 mx-auto mb-3" />
                <p className="text-blue-900 font-medium mb-2">Sign in Required</p>
                <p className="text-sm text-blue-700 mb-4">
                  You need to sign in with Google to claim a player in this league.
                </p>
                <button
                  onClick={handleAuthRedirect}
                  className="bg-black text-white px-6 py-2 rounded-md hover:bg-gray-800 transition-colors"
                >
                  Sign In with Google
                </button>
              </div>
            </div>
          ) : (
            // Logged in state
            <div className="space-y-4">
              {/* Search */}
              <div className="relative">
                <Search className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search players..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-sm text-red-800">{error}</p>
                </div>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-2 border-gray-300 border-t-black"></div>
                </div>
              ) : filteredPlayers.length === 0 ? (
                <div className="text-center py-8">
                  <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-gray-600">
                    {players.length === 0 
                      ? 'No available players to claim' 
                      : 'No players found matching your search'
                    }
                  </p>
                </div>
              ) : (
                <>
                  {/* Player List */}
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {filteredPlayers.map((player) => (
                      <div
                        key={player.id}
                        onClick={() => handlePlayerSelect(player)}
                        className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                          selectedPlayer?.id === player.id
                            ? 'border-black bg-gray-50'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        <div className="font-medium text-black">{player.name}</div>
                        <div className="text-sm text-gray-600">Available to claim</div>
                      </div>
                    ))}
                  </div>

                  {/* Selected Player Info */}
                  {selectedPlayer && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm text-blue-700 mb-2">
                        <strong>Selected:</strong> {selectedPlayer.name}
                      </p>
                      <p className="text-xs text-blue-600">
                        Your email ({currentUserEmail}) will be associated with this player.
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-4 border-t border-gray-200">
                    <button
                      onClick={onClose}
                      disabled={isSubmitting}
                      className="flex-1 bg-gray-100 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleClaimPlayer}
                      disabled={isSubmitting || !selectedPlayer}
                      className="flex-1 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                    >
                      {isSubmitting ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                      ) : (
                        'Claim Player'
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

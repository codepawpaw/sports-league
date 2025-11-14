'use client'

import { useState, useEffect } from 'react'
import { X, User, Loader2 } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'

interface UnregisteredPlayer {
  id: string
  name: string
}

interface RegisterAsPlayerModalProps {
  isOpen: boolean
  onClose: () => void
  slug: string
  onSuccess: () => void
}

export default function RegisterAsPlayerModal({ isOpen, onClose, slug, onSuccess }: RegisterAsPlayerModalProps) {
  const [unregisteredPlayers, setUnregisteredPlayers] = useState<UnregisteredPlayer[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [loading, setLoading] = useState(false)
  const [fetchingPlayers, setFetchingPlayers] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createSupabaseComponentClient()

  useEffect(() => {
    if (isOpen) {
      fetchUnregisteredPlayers()
      setSelectedPlayerId('')
      setError(null)
    }
  }, [isOpen])

  const fetchUnregisteredPlayers = async () => {
    setFetchingPlayers(true)
    try {
      const response = await fetch(`/api/leagues/${slug}/unregistered-players`)
      const data = await response.json()

      if (response.ok) {
        setUnregisteredPlayers(data.players)
      } else {
        setError(data.error || 'Failed to fetch unregistered players')
      }
    } catch (error) {
      console.error('Error fetching unregistered players:', error)
      setError('Failed to load unregistered players')
    } finally {
      setFetchingPlayers(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedPlayerId) {
      setError('Please select a player')
      return
    }

    setLoading(true)
    setError(null)

    try {
      // Check if user is authenticated
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        // Redirect to auth page with return URL
        const returnUrl = encodeURIComponent(`/${slug}/players`)
        window.location.href = `/${slug}/auth?returnTo=${returnUrl}`
        return
      }

      const response = await fetch(`/api/leagues/${slug}/player-registration-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player_id: selectedPlayerId
        })
      })

      const data = await response.json()

      if (response.ok) {
        onSuccess()
        onClose()
        // Show success message
        alert(`Registration request submitted successfully! Your request to register as "${data.request.player_name}" is now pending admin approval.`)
      } else {
        setError(data.error || 'Failed to submit registration request')
      }
    } catch (error) {
      console.error('Error submitting registration request:', error)
      setError('Failed to submit registration request')
    } finally {
      setLoading(false)
    }
  }

  const handlePlayerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPlayerId(e.target.value)
    setError(null)
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <User className="h-6 w-6 text-black mr-2" />
              <h2 className="text-xl font-bold text-black">Register as Player</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6">
            <p className="text-gray-600 text-sm mb-4">
              Select a player from the list below to request registration. An admin will need to approve your request before you can see your matches.
            </p>

            {fetchingPlayers ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-600">Loading players...</span>
              </div>
            ) : unregisteredPlayers.length === 0 ? (
              <div className="text-center py-8">
                <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No unregistered players available</p>
                <p className="text-gray-400 text-sm mt-1">All players in this league are already registered</p>
              </div>
            ) : (
              <div>
                <label htmlFor="player-select" className="block text-sm font-medium text-gray-700 mb-2">
                  Select Player *
                </label>
                <select
                  id="player-select"
                  value={selectedPlayerId}
                  onChange={handlePlayerChange}
                  className="w-full input-field"
                  required
                >
                  <option value="">Choose a player...</option>
                  {unregisteredPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {error && (
            <div className="mb-6 p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          )}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-outline"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
              disabled={loading || fetchingPlayers || unregisteredPlayers.length === 0}
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { X, Send, Clock } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'

interface Participant {
  id: string
  name: string
  email: string | null
}

interface MatchRequestModalProps {
  isOpen: boolean
  onClose: () => void
  slug: string
  currentUserEmail: string | null
  onRequestCreated?: () => void
}

export default function MatchRequestModal({ 
  isOpen, 
  onClose, 
  slug, 
  currentUserEmail,
  onRequestCreated 
}: MatchRequestModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([])
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [message, setMessage] = useState('')
  const [preferredDate, setPreferredDate] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const supabase = createSupabaseComponentClient()

  useEffect(() => {
    if (isOpen) {
      fetchParticipants()
    }
  }, [isOpen])

  const fetchParticipants = async () => {
    try {
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .select('id')
        .eq('slug', slug)
        .single()

      if (leagueError || !league) {
        setError('League not found')
        return
      }

      const { data: activeSeason, error: seasonError } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', league.id)
        .eq('is_active', true)
        .single()

      if (seasonError || !activeSeason) {
        setError('No active season found')
        return
      }

      const { data: participantsData, error: participantsError } = await supabase
        .from('participants')
        .select('id, name, email')
        .eq('league_id', league.id)
        .eq('season_id', activeSeason.id)
        .order('name')

      if (participantsError) {
        setError('Failed to load participants')
        return
      }

      // Filter out current user from the list
      const filteredParticipants = (participantsData || []).filter(
        p => p.email !== currentUserEmail
      )
      
      setParticipants(filteredParticipants)
    } catch (error) {
      console.error('Error fetching participants:', error)
      setError('Failed to load participants')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedPlayerId) {
      setError('Please select an opponent')
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/leagues/${slug}/match-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          requestedPlayerId: selectedPlayerId,
          message: message.trim() || null,
          preferredDate: preferredDate || null
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.error || 'Failed to send match request')
        return
      }

      // Reset form
      setSelectedPlayerId('')
      setMessage('')
      setPreferredDate('')
      
      // Close modal and notify parent
      onClose()
      onRequestCreated?.()

    } catch (error) {
      console.error('Error creating match request:', error)
      setError('Failed to send match request')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    if (!submitting) {
      setSelectedPlayerId('')
      setMessage('')
      setPreferredDate('')
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-black">Request a Match</h2>
          <button
            onClick={handleClose}
            disabled={submitting}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded text-red-700 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select Opponent *
            </label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              required
              disabled={submitting}
            >
              <option value="">Choose a player...</option>
              {participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
            {participants.length === 0 && !error && (
              <p className="text-sm text-gray-500 mt-1">
                No other participants found in this league
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Preferred Match Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={preferredDate}
              onChange={(e) => setPreferredDate(e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              disabled={submitting}
              min={new Date().toISOString().slice(0, 16)}
            />
            <p className="text-xs text-gray-500 mt-1">
              Choose when you'd like to play this match
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Message (Optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a message to your opponent..."
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-black focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
              rows={3}
              maxLength={500}
              disabled={submitting}
            />
            <p className="text-xs text-gray-500 mt-1">
              {message.length}/500 characters
            </p>
          </div>

          <div className="bg-gray-50 p-4 rounded-lg border">
            <h4 className="font-medium text-black mb-2">What happens next?</h4>
            <ol className="text-sm text-gray-600 space-y-1">
              <li>1. Your match request will be sent to your opponent</li>
              <li>2. Your opponent can approve or reject the request</li>
              <li>3. If approved, the admin will review and schedule the match</li>
              <li>4. Both players will see the upcoming match</li>
            </ol>
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={handleClose}
              disabled={submitting}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedPlayerId}
              className="flex-1 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {submitting ? (
                <>
                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Send Request
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

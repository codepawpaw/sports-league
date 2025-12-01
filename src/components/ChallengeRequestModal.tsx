'use client'

import { useState } from 'react'
import { X, Check, AlertTriangle, Sword, Clock, User } from 'lucide-react'

interface Challenge {
  id: string
  challenger_participant: {
    id: string
    name: string
  }
  message: string | null
  created_at: string
}

interface ChallengeRequestModalProps {
  isOpen: boolean
  onClose: () => void
  challenge: Challenge | null
  slug: string
  tournamentSlug: string
  onSuccess: () => void
}

export default function ChallengeRequestModal({
  isOpen,
  onClose,
  challenge,
  slug,
  tournamentSlug,
  onSuccess
}: ChallengeRequestModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleResponse = async (action: 'accept' | 'reject') => {
    if (!challenge) return

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/leagues/${slug}/tournaments/${tournamentSlug}/challenges/${challenge.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${action} challenge`)
      }

      onSuccess()
      onClose()
    } catch (err) {
      console.error(`Error ${action}ing challenge:`, err)
      setError(err instanceof Error ? err.message : `Failed to ${action} challenge`)
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  if (!isOpen || !challenge) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div className="fixed inset-0 bg-gray-900 bg-opacity-50 transition-opacity" />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-orange-500"
              onClick={onClose}
              disabled={loading}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-orange-100 sm:mx-0 sm:h-10 sm:w-10">
              <Sword className="h-6 w-6 text-orange-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Challenge Received!
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  You have received a challenge request for this exhibition tournament.
                </p>
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center">
                <AlertTriangle className="h-4 w-4 text-red-600 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            {/* Challenge Details */}
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center mb-3">
                <User className="h-4 w-4 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Challenger:</span>
                <span className="ml-2 text-sm font-semibold text-gray-900">
                  {challenge.challenger_participant.name}
                </span>
              </div>

              <div className="flex items-center mb-3">
                <Clock className="h-4 w-4 text-gray-600 mr-2" />
                <span className="text-sm font-medium text-gray-700">Sent:</span>
                <span className="ml-2 text-sm text-gray-900">
                  {formatDate(challenge.created_at)}
                </span>
              </div>

              {challenge.message && (
                <div className="mt-3">
                  <span className="text-sm font-medium text-gray-700">Message:</span>
                  <div className="mt-1 p-3 bg-white border border-gray-200 rounded text-sm text-gray-900">
                    {challenge.message}
                  </div>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex space-x-3 mt-6">
              <button
                type="button"
                onClick={() => handleResponse('reject')}
                disabled={loading}
                className="flex-1 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="spinner h-4 w-4" />
                ) : (
                  <>
                    <X className="h-4 w-4 mr-2" />
                    Reject
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => handleResponse('accept')}
                disabled={loading}
                className="flex-1 bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="spinner h-4 w-4" />
                ) : (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Accept Challenge
                  </>
                )}
              </button>
            </div>

            <div className="mt-4 text-center">
              <p className="text-xs text-gray-500">
                Accepting this challenge will create a new match between you and {challenge.challenger_participant.name}.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

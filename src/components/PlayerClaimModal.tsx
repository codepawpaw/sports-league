'use client'

import { useState } from 'react'
import { X, User, Mail, AlertTriangle } from 'lucide-react'
import Link from 'next/link'

interface PlayerClaimModalProps {
  isOpen: boolean
  onClose: () => void
  player: {
    id: string
    name: string
  } | null
  slug: string
  currentUserEmail: string | null
  onClaimSuccess: () => void
}

export default function PlayerClaimModal({
  isOpen,
  onClose,
  player,
  slug,
  currentUserEmail,
  onClaimSuccess
}: PlayerClaimModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen || !player) return null

  const handleSubmit = async () => {
    if (!currentUserEmail) {
      setError('You must be logged in to claim a player')
      return
    }

    if (!player?.id) {
      setError('Player information is not available')
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
          player_id: player.id
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit claim')
      }

      onClaimSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-black">Claim Player</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            disabled={isSubmitting}
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Player Info */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <User className="h-5 w-5 text-gray-600 mr-2" />
              <span className="text-sm font-medium text-gray-700">Player to Claim</span>
            </div>
            <p className="text-lg font-semibold text-black">{player?.name || 'Unknown Player'}</p>
          </div>

          {/* Email Info */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center mb-3">
              <Mail className="h-5 w-5 text-blue-600 mr-2" />
              <span className="text-sm font-medium text-blue-700">Your Email</span>
            </div>
            <p className="text-lg font-medium text-blue-900">{currentUserEmail}</p>
          </div>

          {/* Warning */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Important Information:</p>
                <ul className="space-y-1 text-xs">
                  <li>• Once approved, your email will be associated with this player</li>
                  <li>• You can only claim one player per league</li>
                  <li>• Each player can only be claimed by one email</li>
                  <li>• An admin must approve your claim before it takes effect</li>
                </ul>
              </div>
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {!currentUserEmail && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
              <p className="text-sm text-gray-700 mb-3">You must be logged in to claim a player.</p>
              <Link
                href={`/${slug}/auth`}
                className="bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors inline-block text-sm"
              >
                Sign In with Google
              </Link>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 bg-gray-100 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-200 transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !currentUserEmail}
              className="flex-1 bg-black text-white px-4 py-2 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Claim'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

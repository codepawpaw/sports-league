'use client'

import { useState } from 'react'
import { Trophy, X, Send, AlertCircle } from 'lucide-react'

interface ScoreRequestModalProps {
  isOpen: boolean
  onClose: () => void
  match: {
    id: string
    opponent: {
      id: string
      name: string
    }
    player1: {
      id: string
      name: string
    }
    player2: {
      id: string
      name: string
    }
  }
  currentPlayerId: string
  slug: string
  onSuccess: () => void
}

export default function ScoreRequestModal({
  isOpen,
  onClose,
  match,
  currentPlayerId,
  slug,
  onSuccess
}: ScoreRequestModalProps) {
  const [myScore, setMyScore] = useState('')
  const [opponentScore, setOpponentScore] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Determine which player is the current user and their opponent
  const isPlayer1 = match.player1.id === currentPlayerId
  const myName = isPlayer1 ? match.player1.name : match.player2.name
  const opponentName = isPlayer1 ? match.player2.name : match.player1.name

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!myScore || !opponentScore) {
      setError('Please enter both scores')
      return
    }

    const myScoreNum = parseInt(myScore)
    const opponentScoreNum = parseInt(opponentScore)

    if (isNaN(myScoreNum) || isNaN(opponentScoreNum)) {
      setError('Scores must be valid numbers')
      return
    }

    if (myScoreNum < 0 || opponentScoreNum < 0) {
      setError('Scores cannot be negative')
      return
    }

    try {
      setLoading(true)
      setError(null)

      // Determine player1_score and player2_score based on who is submitting
      const player1_score = isPlayer1 ? myScoreNum : opponentScoreNum
      const player2_score = isPlayer1 ? opponentScoreNum : myScoreNum

      const response = await fetch(`/api/leagues/${slug}/matches/${match.id}/score-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          player1_score,
          player2_score,
          message: message.trim() || undefined
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send score request')
      }

      // Reset form and close modal
      setMyScore('')
      setOpponentScore('')
      setMessage('')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error sending score request:', err)
      setError(err instanceof Error ? err.message : 'Failed to send score request')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setMyScore('')
      setOpponentScore('')
      setMessage('')
      setError(null)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={handleClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg px-4 pt-5 pb-4 text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full sm:p-6">
          <div className="absolute top-0 right-0 pt-4 pr-4">
            <button
              type="button"
              className="bg-white rounded-md text-gray-400 hover:text-gray-600"
              onClick={handleClose}
              disabled={loading}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="sm:flex sm:items-start">
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-green-100 sm:mx-0 sm:h-10 sm:w-10">
              <Trophy className="h-6 w-6 text-green-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Set Match Score
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Set the final score for your match against{' '}
                  <span className="font-medium">{opponentName}</span>
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center">
                <AlertCircle className="h-4 w-4 text-red-600 mr-2" />
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="myScore" className="block text-sm font-medium text-gray-700">
                  Your Score ({myName})
                </label>
                <input
                  type="number"
                  id="myScore"
                  value={myScore}
                  onChange={(e) => setMyScore(e.target.value)}
                  min="0"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={loading}
                  required
                />
              </div>

              <div>
                <label htmlFor="opponentScore" className="block text-sm font-medium text-gray-700">
                  Opponent Score ({opponentName})
                </label>
                <input
                  type="number"
                  id="opponentScore"
                  value={opponentScore}
                  onChange={(e) => setOpponentScore(e.target.value)}
                  min="0"
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                  disabled={loading}
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="message" className="block text-sm font-medium text-gray-700">
                Message (optional)
              </label>
              <textarea
                id="message"
                rows={3}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Add a message about the match..."
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                disabled={loading}
                maxLength={500}
              />
              <p className="mt-1 text-xs text-gray-500">
                {message.length}/500 characters
              </p>
            </div>

            <div className="mt-6 flex space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={loading}
                className="flex-1 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !myScore || !opponentScore}
                className="flex-1 bg-green-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {loading ? (
                  <div className="spinner h-4 w-4" />
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
    </div>
  )
}

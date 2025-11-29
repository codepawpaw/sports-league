'use client'

import { useState, useEffect } from 'react'
import { X, Save, Calendar, Users, Trophy } from 'lucide-react'

interface Match {
  id: string
  player1: { id: string; name: string }
  player2: { id: string; name: string }
  player1_score: number | null
  player2_score: number | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
}

interface MatchEditModalProps {
  match: Match | null
  isOpen: boolean
  onClose: () => void
  onSave: (matchId: string, data: {
    player1_score: string
    player2_score: string
    status: Match['status']
    scheduled_at: string
  }) => Promise<void>
  loading?: boolean
}

export default function MatchEditModal({
  match,
  isOpen,
  onClose,
  onSave,
  loading = false
}: MatchEditModalProps) {
  const [formData, setFormData] = useState({
    player1_score: '',
    player2_score: '',
    status: 'scheduled' as Match['status'],
    scheduled_at: ''
  })
  const [isSaving, setIsSaving] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Initialize form data when match changes
  useEffect(() => {
    if (match && isOpen) {
      setFormData({
        player1_score: match.player1_score?.toString() || '',
        player2_score: match.player2_score?.toString() || '',
        status: match.status,
        scheduled_at: match.scheduled_at 
          ? new Date(match.scheduled_at).toISOString().slice(0, 16)
          : ''
      })
      setErrors({})
    }
  }, [match, isOpen])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (formData.status === 'completed') {
      if (!formData.player1_score || parseInt(formData.player1_score) < 0) {
        newErrors.player1_score = 'Valid score required for completed match'
      }
      if (!formData.player2_score || parseInt(formData.player2_score) < 0) {
        newErrors.player2_score = 'Valid score required for completed match'
      }
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!match || !validateForm()) return

    setIsSaving(true)
    try {
      await onSave(match.id, formData)
      onClose()
    } catch (error) {
      console.error('Error saving match:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleStatusChange = (newStatus: Match['status']) => {
    setFormData(prev => ({ ...prev, status: newStatus }))
    // Clear scores if not completing the match
    if (newStatus !== 'completed') {
      setFormData(prev => ({
        ...prev,
        player1_score: '',
        player2_score: ''
      }))
    }
    setErrors({})
  }

  const getStatusColor = (status: Match['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'in_progress':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-white text-black border-gray-300'
    }
  }

  if (!isOpen || !match) return null

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-black">Edit Match</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {match.player1.name} vs {match.player2.name}
                </p>
              </div>
              <button
                type="button"
                className="text-gray-400 hover:text-black transition-colors"
                onClick={onClose}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white px-6 py-4">
            <div className="space-y-6">
              {/* Players Display */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center justify-center space-x-4">
                  <div className="text-center">
                    <Users className="h-5 w-5 mx-auto text-gray-600 mb-2" />
                    <p className="font-medium text-black">{match.player1.name}</p>
                  </div>
                  <div className="text-gray-400">vs</div>
                  <div className="text-center">
                    <Users className="h-5 w-5 mx-auto text-gray-600 mb-2" />
                    <p className="font-medium text-black">{match.player2.name}</p>
                  </div>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="block text-sm font-medium text-black mb-3">
                  Match Status
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {(['scheduled', 'in_progress', 'completed', 'cancelled'] as const).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleStatusChange(status)}
                      className={`px-4 py-3 text-sm font-medium rounded-lg border-2 transition-colors ${
                        formData.status === status
                          ? getStatusColor(status)
                          : 'bg-white text-gray-700 border-gray-300 hover:border-gray-400'
                      }`}
                    >
                      {status.replace('_', ' ')}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scores - only show when completing match */}
              {formData.status === 'completed' && (
                <div>
                  <label className="block text-sm font-medium text-black mb-3">
                    <Trophy className="h-4 w-4 inline mr-1" />
                    Final Scores
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {match.player1.name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.player1_score}
                        onChange={(e) => setFormData(prev => ({ ...prev, player1_score: e.target.value }))}
                        className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          errors.player1_score ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                      {errors.player1_score && (
                        <p className="text-red-600 text-xs mt-1">{errors.player1_score}</p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        {match.player2.name}
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={formData.player2_score}
                        onChange={(e) => setFormData(prev => ({ ...prev, player2_score: e.target.value }))}
                        className={`w-full px-3 py-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent ${
                          errors.player2_score ? 'border-red-300' : 'border-gray-300'
                        }`}
                        placeholder="0"
                      />
                      {errors.player2_score && (
                        <p className="text-red-600 text-xs mt-1">{errors.player2_score}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Scheduled Date */}
              <div>
                <label className="block text-sm font-medium text-black mb-2">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  Scheduled Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={formData.scheduled_at}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                  className="w-full px-3 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-3 border border-gray-300 rounded-lg text-black font-medium hover:bg-gray-50 transition-colors"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-6 py-3 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-green-300 disabled:cursor-not-allowed flex items-center"
              >
                {isSaving ? (
                  <>
                    <div className="spinner mr-2"></div>
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
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

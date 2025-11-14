'use client'

import { useState } from 'react'
import { Calendar, Clock, X, Send, AlertCircle } from 'lucide-react'

interface ScheduleRequestModalProps {
  isOpen: boolean
  onClose: () => void
  match: {
    id: string
    opponent: {
      id: string
      name: string
    }
  }
  slug: string
  onSuccess: () => void
}

export default function ScheduleRequestModal({
  isOpen,
  onClose,
  match,
  slug,
  onSuccess
}: ScheduleRequestModalProps) {
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedTime, setSelectedTime] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!selectedDate || !selectedTime) {
      setError('Please select both date and time')
      return
    }

    // Combine date and time into a proper ISO string
    const dateTimeString = `${selectedDate}T${selectedTime}:00`
    const requestedDate = new Date(dateTimeString)

    // Check if the date is in the future
    if (requestedDate <= new Date()) {
      setError('Please select a future date and time')
      return
    }

    try {
      setLoading(true)
      setError(null)

      const response = await fetch(`/api/leagues/${slug}/matches/${match.id}/schedule-requests`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requested_date: requestedDate.toISOString(),
          message: message.trim() || undefined
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send schedule request')
      }

      // Reset form and close modal
      setSelectedDate('')
      setSelectedTime('')
      setMessage('')
      onSuccess()
      onClose()
    } catch (err) {
      console.error('Error sending schedule request:', err)
      setError(err instanceof Error ? err.message : 'Failed to send schedule request')
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setSelectedDate('')
      setSelectedTime('')
      setMessage('')
      setError(null)
      onClose()
    }
  }

  // Get minimum date (today)
  const today = new Date().toISOString().split('T')[0]

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
            <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-blue-100 sm:mx-0 sm:h-10 sm:w-10">
              <Calendar className="h-6 w-6 text-blue-600" />
            </div>
            <div className="mt-3 text-center sm:mt-0 sm:ml-4 sm:text-left flex-1">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Request Schedule
              </h3>
              <div className="mt-2">
                <p className="text-sm text-gray-500">
                  Request a schedule time for your match against{' '}
                  <span className="font-medium">{match.opponent.name}</span>
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

            <div>
              <label htmlFor="date" className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                id="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                min={today}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
                required
              />
            </div>

            <div>
              <label htmlFor="time" className="block text-sm font-medium text-gray-700">
                Time
              </label>
              <input
                type="time"
                id="time"
                value={selectedTime}
                onChange={(e) => setSelectedTime(e.target.value)}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={loading}
                required
              />
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
                placeholder="Add a message to your opponent..."
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                className="flex-1 bg-white py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || !selectedDate || !selectedTime}
                className="flex-1 bg-blue-600 py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
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

'use client'

import { useEffect, useState } from 'react'
import { Trophy, Check, X, Bell } from 'lucide-react'

interface ScoreRequest {
  id: string
  player1_score: number
  player2_score: number
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  requester: {
    id: string
    name: string
  }
  match: {
    id: string
    player1: {
      id: string
      name: string
    }
    player2: {
      id: string
      name: string
    }
  }
}

interface ScoreRequestNotificationsProps {
  slug: string
}

export default function ScoreRequestNotifications({ slug }: ScoreRequestNotificationsProps) {
  const [requests, setRequests] = useState<ScoreRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchScoreRequests()
  }, [slug])

  const fetchScoreRequests = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leagues/${slug}/score-requests`)
      
      if (response.status === 401) {
        // User not authenticated or not a participant
        setRequests([])
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch score requests')
      }

      const data = await response.json()
      // Only show pending requests that the user needs to respond to (received_requests)
      const pendingRequests = data.received_requests?.filter((req: ScoreRequest) => req.status === 'pending') || []
      setRequests(pendingRequests)
    } catch (err) {
      console.error('Error fetching score requests:', err)
      setError('Failed to load notifications')
    } finally {
      setLoading(false)
    }
  }

  const handleResponse = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/leagues/${slug}/score-requests/${requestId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to respond to request')
      }

      // Refresh the requests after successful response
      fetchScoreRequests()
    } catch (err) {
      console.error('Error responding to score request:', err)
      setError(err instanceof Error ? err.message : 'Failed to respond to request')
    }
  }

  const getTimeAgo = (dateString: string) => {
    const now = new Date()
    const date = new Date(dateString)
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60))
    
    if (diffInHours < 1) {
      return 'Just now'
    } else if (diffInHours < 24) {
      return `${diffInHours}h ago`
    } else {
      const diffInDays = Math.floor(diffInHours / 24)
      return `${diffInDays}d ago`
    }
  }

  const getWinnerName = (request: ScoreRequest) => {
    if (request.player1_score > request.player2_score) {
      return request.match.player1.name
    } else if (request.player2_score > request.player1_score) {
      return request.match.player2.name
    } else {
      return 'Tie'
    }
  }

  if (loading) return null
  if (error) return null
  if (requests.length === 0) return null

  return (
    <div className="card mb-6">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center">
          <Bell className="h-5 w-5 text-green-600 mr-2" />
          <h3 className="font-semibold text-black">Score Requests</h3>
          <span className="ml-2 bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
            {requests.length}
          </span>
        </div>
      </div>
      <div className="divide-y divide-gray-100">
        {requests.map((request) => (
          <div key={request.id} className="p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  <Trophy className="h-4 w-4 text-gray-400 mr-2" />
                  <span className="text-sm font-medium text-gray-900">
                    Score Request from {request.requester.name}
                  </span>
                  <span className="ml-2 text-xs text-gray-500">
                    {getTimeAgo(request.requested_at)}
                  </span>
                </div>
                
                <p className="text-sm text-gray-600 mb-2">
                  Match: {request.match.player1.name} vs {request.match.player2.name}
                </p>
                
                <div className="flex items-center text-sm text-gray-600 mb-2">
                  <Trophy className="h-4 w-4 text-gray-400 mr-1" />
                  Proposed result: {request.match.player1.name} {request.player1_score} - {request.player2_score} {request.match.player2.name}
                  {request.player1_score !== request.player2_score && (
                    <span className="ml-1 text-green-600 font-medium">
                      ({getWinnerName(request)} wins)
                    </span>
                  )}
                </div>
                
                {request.message && (
                  <p className="text-sm text-gray-600 mb-3 italic">
                    "{request.message}"
                  </p>
                )}
              </div>
              
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => handleResponse(request.id, 'approve')}
                  className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-green-200 hover:border-green-300 flex items-center"
                >
                  <Check className="h-3 w-3 mr-1" />
                  Approve
                </button>
                <button
                  onClick={() => handleResponse(request.id, 'reject')}
                  className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-red-200 hover:border-red-300 flex items-center"
                >
                  <X className="h-3 w-3 mr-1" />
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

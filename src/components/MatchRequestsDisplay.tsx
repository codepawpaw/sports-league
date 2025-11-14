'use client'

import { useState, useEffect } from 'react'
import { Clock, CheckCircle, XCircle, MessageSquare } from 'lucide-react'

interface MatchRequest {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  message: string | null
  requested_at: string
  reviewed_at: string | null
  requesting_player: {
    id: string
    name: string
    email: string | null
  }
  requested_player: {
    id: string
    name: string
    email: string | null
  }
  reviewed_by_admin?: {
    id: string
    email: string
  } | null
}

interface MatchRequestsDisplayProps {
  slug: string
  currentUserEmail: string | null
  refreshTrigger?: number // Used to refresh data when new request is created
}

export default function MatchRequestsDisplay({ 
  slug, 
  currentUserEmail, 
  refreshTrigger 
}: MatchRequestsDisplayProps) {
  const [matchRequests, setMatchRequests] = useState<MatchRequest[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (currentUserEmail) {
      fetchMatchRequests()
    }
  }, [currentUserEmail, refreshTrigger])

  const fetchMatchRequests = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/match-requests`)
      if (response.ok) {
        const data = await response.json()
        setMatchRequests(data.matchRequests || [])
      }
    } catch (error) {
      console.error('Error fetching match requests:', error)
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

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-600" />
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />
      default:
        return null
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800'
      case 'approved':
        return 'bg-green-100 text-green-800'
      case 'rejected':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (!currentUserEmail || loading) {
    return null
  }

  const pendingRequests = matchRequests.filter(req => req.status === 'pending')
  const recentRequests = matchRequests.filter(req => req.status !== 'pending').slice(0, 3)

  if (matchRequests.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-black flex items-center">
              <Clock className="h-5 w-5 text-yellow-600 mr-2" />
              Pending Match Requests ({pendingRequests.length})
            </h3>
          </div>
          <div className="p-4 space-y-3">
            {pendingRequests.map((request) => (
              <div key={request.id} className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-black">
                      {request.requesting_player.email === currentUserEmail ? (
                        <>You requested a match with <span className="font-bold">{request.requested_player.name}</span></>
                      ) : (
                        <><span className="font-bold">{request.requesting_player.name}</span> requested a match with you</>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Requested {formatDate(request.requested_at)}
                    </div>
                    {request.message && (
                      <div className="mt-2 p-3 bg-white border border-gray-200 rounded text-sm">
                        <div className="flex items-start">
                          <MessageSquare className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{request.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      <Clock className="h-3 w-3 mr-1" />
                      Pending Review
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Requests */}
      {recentRequests.length > 0 && (
        <div className="card">
          <div className="p-4 border-b border-gray-200">
            <h3 className="font-semibold text-black">Recent Match Requests</h3>
          </div>
          <div className="p-4 space-y-3">
            {recentRequests.map((request) => (
              <div key={request.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium text-black">
                      {request.requesting_player.email === currentUserEmail ? (
                        <>You requested a match with <span className="font-bold">{request.requested_player.name}</span></>
                      ) : (
                        <><span className="font-bold">{request.requesting_player.name}</span> requested a match with you</>
                      )}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Requested {formatDate(request.requested_at)}
                      {request.reviewed_at && (
                        <> • Reviewed {formatDate(request.reviewed_at)}</>
                      )}
                    </div>
                    {request.message && (
                      <div className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-sm">
                        <div className="flex items-start">
                          <MessageSquare className="h-4 w-4 text-gray-400 mr-2 mt-0.5 flex-shrink-0" />
                          <span className="text-gray-700">{request.message}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      <span className="ml-1 capitalize">{request.status}</span>
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

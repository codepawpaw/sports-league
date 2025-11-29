'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseComponentClient } from '@/lib/supabase'
import RegisterAsPlayerModal from '@/components/RegisterAsPlayerModal'
import ScheduleRequestModal from '@/components/ScheduleRequestModal'
import ScoreRequestModal from '@/components/ScoreRequestModal'
import TabNavigation from '@/components/TabNavigation'

interface UserMatch {
  id: string
  opponent: {
    id: string
    name: string
  }
  player_score: number | null
  opponent_score: number | null
  result?: 'win' | 'loss'
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
}

interface ScheduleRequest {
  id: string
  requested_date: string
  message?: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at?: string
  requester: {
    id: string
    name: string
  }
  opponent: {
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

interface MyMatchesData {
  user_player: {
    id: string
    name: string
  } | null
  upcoming_matches: UserMatch[]
  completed_matches: UserMatch[]
  league: {
    id: string
    name: string
  }
}

export default function MyMatchesPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [data, setData] = useState<MyMatchesData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [showRegisterModal, setShowRegisterModal] = useState(false)
  const [showScheduleModal, setShowScheduleModal] = useState(false)
  const [showScoreModal, setShowScoreModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<UserMatch | null>(null)
  const [selectedScoreMatch, setSelectedScoreMatch] = useState<any>(null)
  const [scheduleRequests, setScheduleRequests] = useState<{
    sent: ScheduleRequest[]
    received: ScheduleRequest[]
  }>({ sent: [], received: [] })
  const [scoreRequests, setScoreRequests] = useState<{
    sent: any[]
    received: any[]
  }>({ sent: [], received: [] })

  useEffect(() => {
    if (slug) {
      checkUserAndFetchData()
    }
  }, [slug])

  const checkUserAndFetchData = async () => {
    try {
      setLoading(true)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)

      if (!user) {
        // User is not authenticated, redirect to auth
        return
      }

      await fetchMyMatches()
    } catch (err) {
      console.error('Error checking user:', err)
      setError('Failed to load user data')
      setLoading(false)
    }
  }

  const fetchMyMatches = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/my-matches`)
      
      if (response.status === 401) {
        // User is not authenticated, they need to sign in
        setCurrentUser(null)
        setLoading(false)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch my matches')
      }

      const matchData = await response.json()
      setData(matchData)
      
      // Also fetch schedule and score requests
      await fetchScheduleRequests()
      await fetchScoreRequests()
    } catch (err) {
      console.error('Error fetching my matches:', err)
      setError('Failed to load my matches')
    } finally {
      setLoading(false)
    }
  }

  const fetchScheduleRequests = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/schedule-requests`)
      
      if (response.status === 401) {
        // User not authenticated or not a participant
        setScheduleRequests({ sent: [], received: [] })
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch schedule requests')
      }

      const data = await response.json()
      setScheduleRequests({
        sent: data.sent_requests || [],
        received: data.received_requests || []
      })
    } catch (err) {
      console.error('Error fetching schedule requests:', err)
      // Don't show error for schedule requests, just keep them empty
      setScheduleRequests({ sent: [], received: [] })
    }
  }

  const fetchScoreRequests = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/score-requests`)
      
      if (response.status === 401) {
        // User not authenticated or not a participant
        setScoreRequests({ sent: [], received: [] })
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch score requests')
      }

      const data = await response.json()
      setScoreRequests({
        sent: data.sent_requests || [],
        received: data.received_requests || []
      })
    } catch (err) {
      console.error('Error fetching score requests:', err)
      // Don't show error for score requests, just keep them empty
      setScoreRequests({ sent: [], received: [] })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
  }

  const formatTime = (dateString: string | null) => {
    if (!dateString) return 'TBD'
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  const formatNotificationDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
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

  const handleScheduleRequestResponse = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      const response = await fetch(`/api/leagues/${slug}/schedule-requests/${requestId}`, {
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
      fetchScheduleRequests()
    } catch (err) {
      console.error('Error responding to schedule request:', err)
      setError(err instanceof Error ? err.message : 'Failed to respond to request')
    }
  }

  const handleDeleteScheduleRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/leagues/${slug}/schedule-requests/${requestId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete request')
      }

      // Refresh the requests after successful deletion
      fetchScheduleRequests()
    } catch (err) {
      console.error('Error deleting schedule request:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete request')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
            Scheduled
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
            In Progress
          </span>
        )
      case 'completed':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
            Completed
          </span>
        )
      default:
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-black text-white border border-gray-200">
            {status}
          </span>
        )
    }
  }

  const getResultBadge = (result: 'win' | 'loss') => {
    return result === 'win' ? (
      <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200 font-medium">
        W
      </span>
    ) : (
      <span className="inline-block px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 border border-red-200 font-medium">
        L
      </span>
    )
  }

  const getScheduleRequestStatusBadge = (status: 'pending' | 'approved' | 'rejected') => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
            Pending
          </span>
        )
      case 'approved':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-green-100 text-green-800 border border-green-200">
            Approved
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 border border-red-200">
            Rejected
          </span>
        )
      default:
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-black text-white border border-gray-200">
            {status}
          </span>
        )
    }
  }

  const handleRegisterSuccess = () => {
    fetchMyMatches()
  }

  const handleOpenRegisterModal = () => {
    setShowRegisterModal(true)
  }

  const handleCloseRegisterModal = () => {
    setShowRegisterModal(false)
  }

  const handleOpenScheduleModal = (match: UserMatch) => {
    setSelectedMatch(match)
    setShowScheduleModal(true)
  }

  const handleCloseScheduleModal = () => {
    setShowScheduleModal(false)
    setSelectedMatch(null)
  }

  const handleScheduleRequestSuccess = () => {
    fetchMyMatches()
  }

  const handleScoreRequestResponse = async (requestId: string, action: 'approve' | 'reject') => {
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

      fetchScoreRequests()
      fetchMyMatches()
    } catch (err) {
      console.error('Error responding to score request:', err)
      setError(err instanceof Error ? err.message : 'Failed to respond to request')
    }
  }

  const handleDeleteScoreRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/leagues/${slug}/score-requests/${requestId}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete request')
      }

      fetchScoreRequests()
    } catch (err) {
      console.error('Error deleting score request:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete request')
    }
  }

  const handleOpenScoreModal = (match: any) => {
    const scoreMatch = {
      id: match.id,
      opponent: match.opponent,
      player1: {
        id: data?.user_player?.id || '',
        name: data?.user_player?.name || ''
      },
      player2: {
        id: match.opponent.id,
        name: match.opponent.name
      }
    }
    setSelectedScoreMatch(scoreMatch)
    setShowScoreModal(true)
  }

  const handleCloseScoreModal = () => {
    setShowScoreModal(false)
    setSelectedScoreMatch(null)
  }

  const handleScoreRequestSuccess = () => {
    fetchMyMatches()
  }

  const isMatchScheduledForToday = (scheduledAt: string | null): boolean => {
    if (!scheduledAt) return false
    
    const matchDate = new Date(scheduledAt)
    const today = new Date()
    
    return (
      matchDate.getFullYear() === today.getFullYear() &&
      matchDate.getMonth() === today.getMonth() &&
      matchDate.getDate() === today.getDate()
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading my matches...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href={`/${slug}`} className="btn-primary">
            Back to League
          </Link>
        </div>
      </div>
    )
  }

  // User not authenticated
  if (!currentUser) {
    return (
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              <div className="flex items-center">
                <Link href="/" className="flex items-center text-black hover:text-gray-600 font-bold text-xl">
                  PingPong
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <Link href={`/${slug}`} className="btn-mobile">
                  Back to League
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-gray-400 font-bold">?</span>
            </div>
            <h1 className="text-2xl font-bold text-black mb-4">Sign In Required</h1>
            <p className="text-gray-600 mb-6">
              You need to sign in to view your matches.
            </p>
            <Link
              href={`/${slug}/auth`}
              className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors"
            >
              Sign In with Google
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-black hover:text-gray-600 font-bold text-xl">
                PingPong
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/${slug}`} className="btn-mobile">
                Back to League
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* League Title */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black break-words">
              {data?.league.name}
            </h1>
            <h2 className="text-lg font-medium text-gray-600 mt-1">
              {data?.user_player ? `My Matches - ${data.user_player.name}` : 'My Matches'}
            </h2>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation 
        currentUser={currentUser}
        isParticipant={!!data?.user_player}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Handle user player status */}
        {!data?.user_player ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
              <span className="text-gray-400 font-bold">?</span>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Player Associated</h3>
            <p className="text-gray-500 mb-6">
              Your email is not associated with any player in this league. You can request to register as a player or contact a league admin.
            </p>
            <div className="space-y-4">
              <button
                onClick={handleOpenRegisterModal}
                className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors"
              >
                Register as Player
              </button>
              <div className="bg-green-50 border border-green-200 rounded-md p-4 max-w-md mx-auto">
                <p className="text-green-700 text-sm">
                  You can also ask league admins to manually add your email to a player profile.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Player Info */}
            <div className="card">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-green-100 rounded-full mr-3 flex items-center justify-center">
                    <span className="text-green-700 font-bold text-sm">
                      {data.user_player.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <h2 className="text-xl font-bold text-black">Playing as: {data.user_player.name}</h2>
                </div>
              </div>
            </div>

            {/* Upcoming Matches - Horizontal Carousel */}
            <div className="bg-gray-50 border border-gray-200 rounded-lg">
              <div className="px-6 py-4">
                {/* Header */}
                <div className="flex items-center mb-4">
                  <div className="bg-green-600 text-white px-3 py-1 text-sm font-bold tracking-wide rounded">
                    UPCOMING
                  </div>
                  <span className="ml-2 text-lg font-bold text-black">
                    ({data.upcoming_matches.length})
                  </span>
                </div>

                {data.upcoming_matches.length === 0 ? (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-gray-400 font-bold">!</span>
                    </div>
                    <p className="text-gray-600 mb-2">No upcoming matches</p>
                    <p className="text-sm text-gray-500">
                      Check back later for upcoming scheduled matches.
                    </p>
                  </div>
                ) : (
                  /* Horizontal Scrollable Container */
                  <div className="relative">
                    <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2" style={{ scrollBehavior: 'smooth' }}>
                      {data.upcoming_matches.map((match) => (
                        <div 
                          key={match.id} 
                          className="flex-shrink-0 w-48 sm:w-56 bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-green-300 hover:shadow-md transition-all duration-200"
                        >
                          {/* Date Header */}
                          <div className="bg-green-600 text-white px-3 py-1 text-xs font-medium flex items-center justify-center">
                            {formatDateShort(match.scheduled_at)}
                          </div>

                          {/* Match Content */}
                          <div className="p-3 space-y-3">
                            {/* Current Player */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-green-100 text-green-700">
                                  {data.user_player?.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium truncate text-black">
                                  {data.user_player?.name && data.user_player.name.length > 12 
                                    ? data.user_player.name.substring(0, 12) + '...' 
                                    : data.user_player?.name}
                                </span>
                              </div>
                            </div>

                            {/* VS Divider */}
                            <div className="text-center">
                              <span className="text-gray-400 font-medium text-xs">VS</span>
                            </div>

                            {/* Opponent */}
                            <div className="flex items-center justify-between">
                              <div className="flex items-center space-x-2 flex-1 min-w-0">
                                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 bg-gray-100 text-gray-600">
                                  {match.opponent.name.charAt(0).toUpperCase()}
                                </div>
                                <span className="text-sm font-medium truncate text-black">
                                  {match.opponent.name.length > 12 
                                    ? match.opponent.name.substring(0, 12) + '...' 
                                    : match.opponent.name}
                                </span>
                              </div>
                            </div>

                            {/* Match Status and Time */}
                            <div className="border-t border-gray-100 pt-3 space-y-2">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-medium text-green-600">
                                  {match.status === 'scheduled' ? 'Scheduled' : 'In Progress'}
                                </span>
                                <span className="text-gray-500">
                                  {formatTime(match.scheduled_at)}
                                </span>
                              </div>
                              
                              {/* Action Buttons */}
                              <div className="space-y-1">
                                {match.status === 'scheduled' && (
                                  <button
                                    onClick={() => handleOpenScheduleModal(match)}
                                    className="w-full bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 hover:border-green-300 px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                  >
                                    Request Schedule
                                  </button>
                                )}
                                {match.status === 'scheduled' && isMatchScheduledForToday(match.scheduled_at) && (
                                  <button
                                    onClick={() => handleOpenScoreModal(match)}
                                    className="w-full bg-black hover:bg-gray-800 text-white px-3 py-1.5 rounded-md text-xs font-medium transition-colors"
                                  >
                                    Set Score
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Scroll indicators for better UX */}
                    <div className="absolute top-1/2 -translate-y-1/2 left-0 w-4 h-full bg-gradient-to-r from-gray-50 to-transparent pointer-events-none opacity-50 sm:opacity-0"></div>
                    <div className="absolute top-1/2 -translate-y-1/2 right-0 w-4 h-full bg-gradient-to-l from-gray-50 to-transparent pointer-events-none opacity-50 sm:opacity-0"></div>
                  </div>
                )}
              </div>
            </div>

            {/* Score and Schedule Requests */}
            <div className="space-y-6">
              {/* Received Score Requests - Modern Notification List */}
              <div className="card">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-black">Score Requests</h3>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                      {scoreRequests.received.filter(r => r.status === 'pending').length}
                    </span>
                  </div>
                </div>
                {scoreRequests.received.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-gray-400 font-bold">!</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests</h3>
                    <p className="text-gray-500">
                      You haven't received any pending score requests.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {scoreRequests.received.filter(r => r.status === 'pending').map((request) => (
                      <div key={request.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span className="font-medium text-black">
                                Score Request from {request.requester.name}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {getTimeAgo(request.requested_at)}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              Match: {request.match.player1.name} vs {request.match.player2.name}
                            </p>
                            
                            <div className="text-sm text-gray-600 mb-2">
                              Proposed result: {request.match.player1.name} {request.player1_score} - {request.player2_score} {request.match.player2.name}
                              {request.player1_score !== request.player2_score && (
                                <span className="ml-1 text-green-600 font-medium">
                                  ({request.player1_score > request.player2_score ? request.match.player1.name : request.match.player2.name} wins)
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
                              onClick={() => handleScoreRequestResponse(request.id, 'approve')}
                              className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-green-200 hover:border-green-300"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleScoreRequestResponse(request.id, 'reject')}
                              className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-red-200 hover:border-red-300"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Received Schedule Requests - Modern Notification List */}
              <div className="card">
                <div className="p-4 border-b border-gray-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-black">Schedule Requests</h3>
                    <span className="bg-green-100 text-green-800 text-xs font-medium px-2 py-1 rounded-full">
                      {scheduleRequests.received.filter(r => r.status === 'pending').length}
                    </span>
                  </div>
                </div>
                {scheduleRequests.received.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-gray-400 font-bold">!</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests</h3>
                    <p className="text-gray-500">
                      You haven't received any pending schedule requests.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 p-4">
                    {scheduleRequests.received.filter(r => r.status === 'pending').map((request) => (
                      <div key={request.id} className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <div className="flex items-center mb-2">
                              <span className="font-medium text-black">
                                Schedule Request from {request.requester.name}
                              </span>
                              <span className="ml-2 text-xs text-gray-500">
                                {getTimeAgo(request.requested_at)}
                              </span>
                            </div>
                            
                            <p className="text-sm text-gray-600 mb-2">
                              Match: {request.match.player1.name} vs {request.match.player2.name}
                            </p>
                            
                            <div className="text-sm text-gray-600 mb-2">
                              Proposed time: {formatNotificationDate(request.requested_date)}
                            </div>
                            
                            {request.message && (
                              <p className="text-sm text-gray-600 mb-3 italic">
                                "{request.message}"
                              </p>
                            )}
                          </div>
                          
                          <div className="flex space-x-2 ml-4">
                            <button
                              onClick={() => handleScheduleRequestResponse(request.id, 'approve')}
                              className="bg-green-100 hover:bg-green-200 text-green-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-green-200 hover:border-green-300"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleScheduleRequestResponse(request.id, 'reject')}
                              className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-red-200 hover:border-red-300"
                            >
                              Reject
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Sent Score Requests - Modern Table */}
              <div className="card">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-black">
                    Pending Score Requests Sent ({scoreRequests.sent.filter(r => r.status === 'pending').length})
                  </h3>
                </div>
                {scoreRequests.sent.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-gray-400 font-bold">!</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests</h3>
                    <p className="text-gray-500">
                      You haven't sent any pending score requests.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">To</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Match</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Score</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Message</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Requested</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scoreRequests.sent.filter(r => r.status === 'pending').map((request) => (
                          <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-900">
                              {request.opponent.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {request.match.player1.name} vs {request.match.player2.name}
                            </td>
                            <td className="py-3 px-4 text-sm font-medium text-gray-900">
                              {request.player1_score} - {request.player2_score}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500 max-w-xs truncate">
                              {request.message || <span className="italic text-gray-400">No message</span>}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {getTimeAgo(request.requested_at)}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleDeleteScoreRequest(request.id)}
                                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-red-200 hover:border-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Sent Schedule Requests - Modern Table */}
              <div className="card">
                <div className="p-4 border-b border-gray-200">
                  <h3 className="font-semibold text-black">
                    Pending Schedule Requests Sent ({scheduleRequests.sent.filter(r => r.status === 'pending').length})
                  </h3>
                </div>
                {scheduleRequests.sent.filter(r => r.status === 'pending').length === 0 ? (
                  <div className="p-8 text-center">
                    <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                      <span className="text-gray-400 font-bold">!</span>
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No pending requests</h3>
                    <p className="text-gray-500">
                      You haven't sent any pending schedule requests.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-gray-200">
                          <th className="text-left py-3 px-4 font-medium text-gray-900">To</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Match</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Requested Date</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Message</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Requested</th>
                          <th className="text-left py-3 px-4 font-medium text-gray-900">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {scheduleRequests.sent.filter(r => r.status === 'pending').map((request) => (
                          <tr key={request.id} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-3 px-4 font-medium text-gray-900">
                              {request.opponent.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-600">
                              {request.match.player1.name} vs {request.match.player2.name}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-900">
                              {formatDate(request.requested_date)}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500 max-w-xs truncate">
                              {request.message || <span className="italic text-gray-400">No message</span>}
                            </td>
                            <td className="py-3 px-4 text-sm text-gray-500">
                              {formatDate(request.requested_at)}
                            </td>
                            <td className="py-3 px-4">
                              <button
                                onClick={() => handleDeleteScheduleRequest(request.id)}
                                className="bg-red-100 hover:bg-red-200 text-red-800 px-3 py-1 rounded-md text-xs font-medium transition-colors border border-red-200 hover:border-red-300"
                              >
                                Delete
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Match History - Modern Table */}
            <div className="card">
              <div className="p-4 border-b border-gray-200">
                <h3 className="font-semibold text-black">
                  Match History ({data.completed_matches.length})
                </h3>
              </div>
              {data.completed_matches.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full mx-auto mb-4 flex items-center justify-center">
                    <span className="text-gray-400 font-bold">!</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No completed matches</h3>
                  <p className="text-gray-500">
                    You haven't completed any matches yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Result</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Opponent</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Score</th>
                        <th className="text-left py-3 px-4 font-medium text-gray-900">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.completed_matches.map((match) => (
                        <tr key={match.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-4">
                            {match.result && getResultBadge(match.result)}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            vs {match.opponent.name}
                          </td>
                          <td className="py-3 px-4 font-medium text-gray-900">
                            {match.player_score} - {match.opponent_score}
                          </td>
                          <td className="py-3 px-4 text-sm text-gray-500">
                            {match.completed_at && formatDate(match.completed_at)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Register as Player Modal */}
      <RegisterAsPlayerModal
        isOpen={showRegisterModal}
        onClose={handleCloseRegisterModal}
        slug={slug}
        onSuccess={handleRegisterSuccess}
      />

      {/* Schedule Request Modal */}
      {selectedMatch && (
        <ScheduleRequestModal
          isOpen={showScheduleModal}
          onClose={handleCloseScheduleModal}
          match={selectedMatch}
          slug={slug}
          onSuccess={handleScheduleRequestSuccess}
        />
      )}

      {/* Score Request Modal */}
      {selectedScoreMatch && data?.user_player && (
        <ScoreRequestModal
          isOpen={showScoreModal}
          onClose={handleCloseScoreModal}
          match={selectedScoreMatch}
          currentPlayerId={data.user_player.id}
          slug={slug}
          onSuccess={handleScoreRequestSuccess}
        />
      )}
    </div>
  )
}

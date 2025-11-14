'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Calendar, ArrowLeft, Clock, User, CalendarPlus } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import RegisterAsPlayerModal from '@/components/RegisterAsPlayerModal'
import ScheduleRequestModal from '@/components/ScheduleRequestModal'

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
  const [selectedMatch, setSelectedMatch] = useState<UserMatch | null>(null)
  const [scheduleRequests, setScheduleRequests] = useState<{
    sent: ScheduleRequest[]
    received: ScheduleRequest[]
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
      
      // Also fetch schedule requests
      await fetchScheduleRequests()
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'scheduled':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800 border border-blue-200">
            Scheduled
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800 border border-yellow-200">
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
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 border border-gray-200">
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

  const handleRegisterSuccess = () => {
    // Refresh the data after successful registration
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
    // Refresh the data after successful schedule request
    fetchMyMatches()
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
                <Link href="/" className="flex items-center text-black hover:text-gray-600">
                  <Trophy className="h-8 w-8" />
                </Link>
              </div>
              <div className="flex items-center gap-4">
                <Link href={`/${slug}`} className="btn-mobile">
                  <ArrowLeft className="h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2" />
                  Back to League
                </Link>
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-black mb-4">Sign In Required</h1>
            <p className="text-gray-600 mb-6">
              You need to sign in to view your matches.
            </p>
            <Link
              href={`/${slug}/auth`}
              className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors inline-flex items-center"
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
              <Link href="/" className="flex items-center text-black hover:text-gray-600">
                <Trophy className="h-8 w-8" />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/${slug}`} className="btn-mobile">
                <ArrowLeft className="h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2" />
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Handle user player status */}
        {!data?.user_player ? (
          <div className="text-center py-16">
            <User className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No Player Associated</h3>
            <p className="text-gray-500 mb-6">
              Your email is not associated with any player in this league. You can request to register as a player or contact a league admin.
            </p>
            <div className="space-y-4">
              <button
                onClick={handleOpenRegisterModal}
                className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors inline-flex items-center"
              >
                <User className="h-4 w-4 mr-2" />
                Register as Player
              </button>
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4 max-w-md mx-auto">
                <p className="text-blue-700 text-sm">
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
                  <User className="h-6 w-6 text-black mr-2" />
                  <h2 className="text-xl font-bold text-black">Playing as: {data.user_player.name}</h2>
                </div>
              </div>
            </div>

            {/* Upcoming Matches */}
            <div className="card">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center">
                  <Calendar className="h-6 w-6 text-black mr-2" />
                  <h2 className="text-xl font-bold text-black">
                    Upcoming Matches ({data.upcoming_matches.length})
                  </h2>
                </div>
              </div>
              {data.upcoming_matches.length === 0 ? (
                <div className="p-8 text-center">
                  <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming matches</h3>
                  <p className="text-gray-500">
                    You have no scheduled matches at the moment.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full">
                    <thead>
                      <tr>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Opponent
                        </th>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Scheduled
                        </th>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.upcoming_matches.map((match) => (
                        <tr key={match.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 border-b border-gray-200">
                            <div className="font-medium text-gray-900">
                              vs {match.opponent.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            {getStatusBadge(match.status)}
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200 text-sm text-gray-500">
                            {match.scheduled_at ? (
                              formatDate(match.scheduled_at)
                            ) : (
                              <span className="text-gray-400 italic">Not scheduled</span>
                            )}
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200 text-sm">
                            {match.status === 'in_progress' && match.player_score !== null && match.opponent_score !== null ? (
                              <div className="font-medium text-gray-900">
                                {match.player_score} - {match.opponent_score}
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                {match.status === 'scheduled' ? 'Not started' : 'No score'}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            {match.status === 'scheduled' && (
                              <button
                                onClick={() => handleOpenScheduleModal(match)}
                                className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-md font-medium transition-colors border border-blue-200 hover:border-blue-300 flex items-center"
                              >
                                <CalendarPlus className="h-4 w-4 mr-1" />
                                Request Schedule
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Completed Matches */}
            <div className="card">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center">
                  <Trophy className="h-6 w-6 text-black mr-2" />
                  <h2 className="text-xl font-bold text-black">
                    Match History ({data.completed_matches.length})
                  </h2>
                </div>
              </div>
              {data.completed_matches.length === 0 ? (
                <div className="p-8 text-center">
                  <Trophy className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No completed matches</h3>
                  <p className="text-gray-500">
                    You haven't completed any matches yet.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-full">
                    <thead>
                      <tr>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Result
                        </th>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Opponent
                        </th>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Score
                        </th>
                        <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                          Date
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.completed_matches.map((match) => (
                        <tr key={match.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 border-b border-gray-200">
                            {match.result && getResultBadge(match.result)}
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            <div className="font-medium text-gray-900">
                              vs {match.opponent.name}
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200">
                            <div className="font-medium text-gray-900">
                              {match.player_score} - {match.opponent_score}
                            </div>
                          </td>
                          <td className="px-6 py-4 border-b border-gray-200 text-sm text-gray-500">
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
    </div>
  )
}

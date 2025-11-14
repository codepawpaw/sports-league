'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Calendar, ArrowLeft, Clock, UserPlus, User } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import ClaimPlayerDropdownModal from '@/components/ClaimPlayerDropdownModal'

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

interface MyMatchesData {
  user_player: {
    id: string
    name: string
  } | null
  upcoming_matches: UserMatch[]
  completed_matches: UserMatch[]
  has_claim: boolean
  claim_status: 'none' | 'pending' | 'approved' | 'rejected'
  claim_details: {
    id: string
    player_name: string
    requested_at: string
    reviewed_at: string | null
  } | null
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
  const [isClaimDropdownModalOpen, setIsClaimDropdownModalOpen] = useState(false)

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
    } catch (err) {
      console.error('Error fetching my matches:', err)
      setError('Failed to load my matches')
    } finally {
      setLoading(false)
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
        {/* Handle different claim statuses */}
        {data?.claim_status === 'none' ? (
          <div className="text-center py-16">
            <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Claim a Player</h3>
            <p className="text-gray-500 mb-6">
              You need to claim a player in this league to view your matches.
            </p>
            <button
              onClick={() => setIsClaimDropdownModalOpen(true)}
              className="bg-gray-700 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors inline-flex items-center"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Claim Player
            </button>
          </div>
        ) : data?.claim_status === 'pending' ? (
          <div className="text-center py-16">
            <Clock className="h-12 w-12 text-amber-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Claim Pending Approval</h3>
            <p className="text-gray-500 mb-4">
              Your claim for <span className="font-medium text-gray-700">{data.claim_details?.player_name}</span> is awaiting admin approval.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Submitted on {data.claim_details?.requested_at ? formatDate(data.claim_details.requested_at) : 'Unknown date'}
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-4 max-w-md mx-auto">
              <p className="text-amber-700 text-sm">
                Please wait for a league admin to review and approve your claim. You'll be able to view your matches once approved.
              </p>
            </div>
          </div>
        ) : data?.claim_status === 'rejected' ? (
          <div className="text-center py-16">
            <UserPlus className="h-12 w-12 text-red-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Claim Rejected</h3>
            <p className="text-gray-500 mb-4">
              Your claim for <span className="font-medium text-gray-700">{data.claim_details?.player_name}</span> was rejected by a league admin.
            </p>
            <p className="text-sm text-gray-400 mb-6">
              Reviewed on {data.claim_details?.reviewed_at ? formatDate(data.claim_details.reviewed_at) : 'Unknown date'}
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 max-w-md mx-auto mb-6">
              <p className="text-red-700 text-sm">
                Please contact a league admin for more information or try claiming a different player.
              </p>
            </div>
            <button
              onClick={() => setIsClaimDropdownModalOpen(true)}
              className="bg-gray-700 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors inline-flex items-center"
            >
              <UserPlus className="h-5 w-5 mr-2" />
              Claim Another Player
            </button>
          </div>
        ) : data?.claim_status === 'approved' && data?.user_player ? (
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
        ) : (
          <div className="text-center py-16">
            <UserPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
            <p className="text-gray-500 mb-6">
              Unable to determine your claim status. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gray-700 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        )}
      </main>

      {/* Claim Player Dropdown Modal */}
      <ClaimPlayerDropdownModal
        isOpen={isClaimDropdownModalOpen}
        onClose={() => setIsClaimDropdownModalOpen(false)}
        slug={slug}
        currentUserEmail={currentUser?.email || null}
      />
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar, ArrowLeft, Clock } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import TabNavigation from '@/components/TabNavigation'

interface League {
  id: string
  name: string
}

interface Player {
  id: string
  name: string
}

interface UpcomingMatch {
  id: string
  player1: Player
  player2: Player
  player1_score: number | null
  player2_score: number | null
  status: 'scheduled' | 'in_progress'
  scheduled_at: string | null
  created_at: string
}

interface UpcomingData {
  league: League
  matches: UpcomingMatch[]
  total: number
}

export default function UpcomingPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [data, setData] = useState<UpcomingData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isParticipant, setIsParticipant] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchUpcomingMatches()
      getCurrentUser()
    }
  }, [slug])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    
    if (user && data?.league) {
      // Check if user is a participant
      const { data: participantData } = await supabase
        .from('participants')
        .select('id')
        .eq('league_id', data.league.id)
        .eq('email', user.email)
        .single()

      setIsParticipant(!!participantData)
    }
  }

  const fetchUpcomingMatches = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leagues/${slug}/upcoming`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch upcoming matches')
      }

      const upcomingData = await response.json()
      setData(upcomingData)
    } catch (err) {
      console.error('Error fetching upcoming matches:', err)
      setError('Failed to load upcoming matches')
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
      default:
        return (
          <span className="inline-block px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        )
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading upcoming matches...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
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

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-black hover:text-gray-600">
                <Calendar className="h-8 w-8" />
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
            <h1 className="text-2xl sm:text-3xl font-bold text-black break-words">{data.league.name}</h1>
            <h2 className="text-lg font-medium text-gray-600 mt-1">Upcoming Matches</h2>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation 
        currentUser={currentUser}
        isParticipant={isParticipant}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Calendar className="h-6 w-6 text-black mr-2" />
            <h2 className="text-2xl font-bold text-black">Upcoming Matches</h2>
          </div>
          <p className="text-gray-600">
            {data.total} upcoming match{data.total !== 1 ? 'es' : ''}
          </p>
        </div>

        {data.matches.length === 0 ? (
          <div className="card">
            <div className="p-8 text-center">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No upcoming matches</h3>
              <p className="text-gray-500">
                No matches have been scheduled in this league yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Match
                    </th>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Scheduled
                    </th>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((match) => {
                    return (
                      <tr key={match.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {match.player1.name} vs {match.player2.name}
                            </div>
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
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="text-sm">
                            {match.status === 'in_progress' && match.player1_score !== null && match.player2_score !== null ? (
                              <div>
                                <div className="font-medium text-gray-900">
                                  {match.player1_score} - {match.player2_score}
                                </div>
                                <div className="text-xs text-gray-500">
                                  sets
                                </div>
                              </div>
                            ) : (
                              <span className="text-gray-400 italic">
                                {match.status === 'scheduled' ? 'Not started' : 'No score yet'}
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

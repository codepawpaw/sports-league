'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Calendar, Clock, Filter } from 'lucide-react'
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
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all')

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
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            Scheduled
          </span>
        )
      case 'in_progress':
        return (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-gray-800 text-white border border-gray-700">
            In Progress
          </span>
        )
      default:
        return (
          <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200">
            {status}
          </span>
        )
    }
  }

  // Get all unique players for filtering
  const getAllPlayers = () => {
    if (!data?.matches) return []
    const playersSet = new Set<string>()
    const playersMap = new Map<string, Player>()
    
    data.matches.forEach(match => {
      if (!playersMap.has(match.player1.id)) {
        playersMap.set(match.player1.id, match.player1)
        playersSet.add(match.player1.id)
      }
      if (!playersMap.has(match.player2.id)) {
        playersMap.set(match.player2.id, match.player2)
        playersSet.add(match.player2.id)
      }
    })
    
    return Array.from(playersSet).map(id => playersMap.get(id)!).sort((a, b) => a.name.localeCompare(b.name))
  }

  // Filter matches based on selected player
  const getFilteredMatches = () => {
    if (!data?.matches) return []
    if (selectedPlayer === 'all') return data.matches
    
    return data.matches.filter(match => 
      match.player1.id === selectedPlayer || match.player2.id === selectedPlayer
    )
  }

  const filteredMatches = getFilteredMatches()
  const allPlayers = getAllPlayers()

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-black">Loading upcoming matches...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Error</h1>
          <p className="text-black mb-6">{error}</p>
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
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/${slug}`} className="text-black hover:text-green-600 font-medium">
                ← Back to League
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* League Title */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-black break-words">{data.league.name}</h1>
            <p className="text-lg text-black mt-2">Upcoming Matches</p>
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
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Calendar className="h-6 w-6 text-black mr-2" />
            <h2 className="text-2xl font-bold text-black">All Upcoming Matches</h2>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-black">
              {filteredMatches.length} of {data.total} match{filteredMatches.length !== 1 ? 'es' : ''}
            </p>
            
            {/* Player Filter */}
            {allPlayers.length > 0 && (
              <div className="flex items-center gap-3">
                <Filter className="h-4 w-4 text-black" />
                <label htmlFor="player-filter" className="text-black font-medium">
                  Filter by Player:
                </label>
                <select
                  id="player-filter"
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="border border-gray-200 px-4 py-2 rounded-md bg-white text-black focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-green-600"
                >
                  <option value="all">All Players</option>
                  {allPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Matches Table */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
              <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-black mb-2">
                {selectedPlayer === 'all' ? 'No upcoming matches' : 'No matches found'}
              </h3>
              <p className="text-gray-600">
                {selectedPlayer === 'all' 
                  ? 'No matches have been scheduled in this league yet.'
                  : 'No upcoming matches found for the selected player.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">
                      Match
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">
                      Scheduled
                    </th>
                    <th className="px-6 py-4 text-left text-sm font-semibold text-black">
                      Progress
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredMatches.map((match, index) => (
                    <tr 
                      key={match.id} 
                      className={`hover:bg-gray-50 transition-colors duration-150 ${
                        index % 2 === 0 ? 'bg-white' : 'bg-gray-25'
                      }`}
                    >
                      <td className="px-6 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                          <div className="flex items-center space-x-3">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-black border">
                              {match.player1.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-black">{match.player1.name}</span>
                          </div>
                          <span className="text-gray-400 font-medium text-sm mx-2 hidden sm:inline">vs</span>
                          <div className="flex items-center space-x-3 sm:ml-0 ml-10">
                            <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-sm font-semibold text-black border">
                              {match.player2.name.charAt(0).toUpperCase()}
                            </div>
                            <span className="font-medium text-black">{match.player2.name}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {getStatusBadge(match.status)}
                      </td>
                      <td className="px-6 py-4">
                        {match.scheduled_at ? (
                          <div className="text-sm">
                            <div className="font-medium text-black">
                              {formatDate(match.scheduled_at)}
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-sm">Not scheduled</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {match.status === 'in_progress' && match.player1_score !== null && match.player2_score !== null ? (
                          <div className="text-sm">
                            <div className="font-bold text-black text-lg">
                              {match.player1_score} - {match.player2_score}
                            </div>
                            <div className="text-xs text-gray-600">
                              sets
                            </div>
                          </div>
                        ) : (
                          <span className="text-gray-400 italic text-sm">
                            {match.status === 'scheduled' ? 'Not started' : 'No score yet'}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

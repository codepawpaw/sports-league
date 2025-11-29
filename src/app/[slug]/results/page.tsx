'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
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

interface MatchResult {
  id: string
  player1: Player
  player2: Player
  player1_score: number
  player2_score: number
  winner_id: string
  completed_at: string
}

interface ResultsData {
  league: League
  matches: MatchResult[]
  total: number
}

export default function ResultsPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isParticipant, setIsParticipant] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<string>('all')

  useEffect(() => {
    if (slug) {
      fetchResults()
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

  const fetchResults = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leagues/${slug}/results`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch results')
      }

      const resultsData = await response.json()
      setData(resultsData)
    } catch (err) {
      console.error('Error fetching results:', err)
      setError('Failed to load match results')
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

  const getWinner = (match: MatchResult) => {
    return match.winner_id === match.player1.id ? match.player1 : match.player2
  }

  const getLoser = (match: MatchResult) => {
    return match.winner_id === match.player1.id ? match.player2 : match.player1
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
          <p className="text-black">Loading match results...</p>
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
            <p className="text-lg text-black mt-2">Match Results</p>
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
          <h2 className="text-2xl font-bold text-black mb-2">All Match Results</h2>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <p className="text-black">
              {filteredMatches.length} of {data.total} match{filteredMatches.length !== 1 ? 'es' : ''}
            </p>
            
            {/* Player Filter */}
            {allPlayers.length > 0 && (
              <div className="flex items-center gap-3">
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

        {/* Results Section */}
        {filteredMatches.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
              <h3 className="text-xl font-bold text-black mb-2">
                {selectedPlayer === 'all' ? 'No completed matches' : 'No matches found'}
              </h3>
              <p className="text-gray-600">
                {selectedPlayer === 'all' 
                  ? 'No matches have been completed in this league yet.'
                  : 'No matches found for the selected player.'
                }
              </p>
            </div>
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredMatches.map((match) => {
              const winner = getWinner(match)
              const loser = getLoser(match)
              
              return (
                <div key={match.id} className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-green-300 hover:shadow-md transition-all duration-200">
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
                      {/* Match Info */}
                      <div className="md:col-span-1">
                        <div className="space-y-1">
                          <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              winner.id === match.player1.id 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {match.player1.name.charAt(0).toUpperCase()}
                            </div>
                            <span className={`font-bold text-base ${
                              winner.id === match.player1.id ? 'text-black' : 'text-gray-600'
                            }`}>
                              {match.player1.name}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-gray-400 font-medium text-xs">VS</span>
                          </div>
                          <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                              winner.id === match.player2.id 
                                ? 'bg-green-100 text-green-700' 
                                : 'bg-gray-100 text-gray-600'
                            }`}>
                              {match.player2.name.charAt(0).toUpperCase()}
                            </div>
                            <span className={`font-bold text-base ${
                              winner.id === match.player2.id ? 'text-black' : 'text-gray-600'
                            }`}>
                              {match.player2.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Score */}
                      <div className="md:col-span-1 text-center">
                        <div className="text-3xl font-bold text-black mb-1">
                          {match.player1_score} - {match.player2_score}
                        </div>
                        <p className="text-gray-600 text-sm">sets</p>
                      </div>

                      {/* Winner */}
                      <div className="md:col-span-1">
                        <div className="text-center md:text-left">
                          <p className="text-sm text-gray-600 mb-1">Winner</p>
                          <p className="font-bold text-green-600 text-lg">{winner.name}</p>
                          <p className="text-sm text-gray-600">defeated {loser.name}</p>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="md:col-span-1 text-center md:text-right">
                        <p className="text-sm text-gray-600 mb-1">Completed</p>
                        <p className="font-medium text-black">{formatDate(match.completed_at)}</p>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}

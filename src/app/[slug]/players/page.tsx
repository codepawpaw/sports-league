'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { createSupabaseComponentClient } from '@/lib/supabase'
import PlayerMatchHistoryModal from '@/components/PlayerMatchHistoryModal'
import RegisterAsPlayerModal from '@/components/RegisterAsPlayerModal'
import TabNavigation from '@/components/TabNavigation'

interface League {
  id: string
  name: string
}

interface Player {
  id: string
  name: string
  email: string | null
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  set_diff: number
  points: number
  current_rating: number
  is_provisional: boolean
  total_matches: number
}

interface PlayersData {
  league: League
  players: Player[]
  total: number
}

export default function PlayersPage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [data, setData] = useState<PlayersData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isParticipant, setIsParticipant] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchPlayers()
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

  const fetchPlayers = async () => {
    try {
      setLoading(true)
      // Add cache-busting parameter
      const response = await fetch(`/api/leagues/${slug}/players?_t=${Date.now()}`, {
        cache: 'no-store'
      })
      
      if (!response.ok) {
        throw new Error('Failed to fetch players')
      }

      const playersData = await response.json()
      setData(playersData)
    } catch (err) {
      console.error('Error fetching players:', err)
      setError('Failed to load players')
    } finally {
      setLoading(false)
    }
  }

  // Sort players by rating (highest first), then by name
  const sortedPlayers = data?.players ? [...data.players].sort((a, b) => {
    // Players with ratings come first
    if (a.total_matches >= 2 && b.total_matches < 2) return -1
    if (a.total_matches < 2 && b.total_matches >= 2) return 1
    
    // Both have ratings, sort by rating (highest first)
    if (a.total_matches >= 2 && b.total_matches >= 2) {
      return b.current_rating - a.current_rating
    }
    
    // Both don't have ratings, sort by name
    return a.name.localeCompare(b.name)
  }) : []

  const topThreePlayers = sortedPlayers.slice(0, 3)
  const otherPlayers = sortedPlayers.slice(3)

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-black">Loading players...</p>
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
      {/* Header - Same as Results Page */}
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

      {/* League Title - Same as Results Page */}
      <div className="border-b border-gray-200 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold text-black break-words">{data.league.name}</h1>
            <p className="text-lg text-black mt-2">Players</p>
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
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-black mb-2">Players</h2>
              <p className="text-black">
                {data.total} player{data.total !== 1 ? 's' : ''} in this league
              </p>
            </div>
            <button
              onClick={() => setIsRegisterModalOpen(true)}
              className="bg-black hover:bg-gray-800 text-white px-4 py-2 rounded-md font-medium transition-colors"
            >
              Register as Player
            </button>
          </div>
        </div>

        {data.players.length === 0 ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg border-2 border-gray-200 p-8">
              <h3 className="text-xl font-bold text-black mb-2">No players yet</h3>
              <p className="text-black">
                No players have joined this league yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Top 3 Players Cards */}
            {topThreePlayers.length > 0 && (
              <div>
                <div className="bg-black text-white px-3 py-1 text-sm font-bold tracking-wide inline-block mb-4">
                  TOP PERFORMERS
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {topThreePlayers.map((player, index) => (
                    <div 
                      key={player.id} 
                      className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-md transition-all duration-200"
                    >
                      {/* Position Header */}
                      <div className="bg-gray-800 text-white px-3 py-1 text-xs font-medium flex items-center justify-center">
                        {index === 0 && '🥇 '}
                        {index === 1 && '🥈 '}
                        {index === 2 && '🥉 '}
                        Position {index + 1}
                      </div>

                      {/* Player Content */}
                      <div className="p-4 space-y-3">
                        {/* Player Name */}
                        <div className="text-center">
                          <div className="w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold bg-gray-100 text-gray-800 mx-auto mb-2">
                            {player.name.charAt(0).toUpperCase()}
                          </div>
                          <h3 className="font-bold text-lg text-black truncate">{player.name}</h3>
                        </div>

                        {/* Rating */}
                        <div className="text-center border-t border-gray-100 pt-3">
                          {player.total_matches >= 2 ? (
                            <div>
                              <div className="text-2xl font-bold text-black">{player.current_rating}</div>
                              <div className="text-sm text-black">Rating</div>
                              {player.is_provisional && (
                                <div className="text-xs text-black mt-1">Provisional</div>
                              )}
                            </div>
                          ) : (
                            <div>
                              <div className="text-lg text-black">No Rating</div>
                              <div className="text-xs text-black">Need {2 - player.total_matches} more match{2 - player.total_matches !== 1 ? 'es' : ''}</div>
                            </div>
                          )}
                        </div>

                        {/* Action Button */}
                        <button
                          onClick={() => {
                            setSelectedPlayer({ id: player.id, name: player.name })
                            setIsHistoryModalOpen(true)
                          }}
                          className="w-full bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200 hover:border-gray-300 px-3 py-2 rounded-md text-sm font-medium transition-colors"
                        >
                          View History
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Other Players List */}
            {otherPlayers.length > 0 && (
              <div>
                <div className="bg-black text-white px-3 py-1 text-sm font-bold tracking-wide inline-block mb-4">
                  ALL PLAYERS
                </div>
                <div className="space-y-2">
                  {otherPlayers.map((player) => (
                    <div 
                      key={player.id} 
                      className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden hover:border-gray-400 hover:shadow-sm transition-all duration-200"
                    >
                      <div className="p-4">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          {/* Player Info */}
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold bg-gray-100 text-gray-800 flex-shrink-0">
                              {player.name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <h3 className="font-bold text-lg text-black">{player.name}</h3>
                              <div className="text-sm text-black">
                                {player.total_matches >= 2 ? (
                                  <div className="flex items-center gap-2">
                                    <span className="font-semibold">Rating: {player.current_rating}</span>
                                    {player.is_provisional && (
                                      <span className="text-xs">(Provisional)</span>
                                    )}
                                  </div>
                                ) : (
                                  <span>No Rating - Need {2 - player.total_matches} more match{2 - player.total_matches !== 1 ? 'es' : ''}</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Button */}
                          <button
                            onClick={() => {
                              setSelectedPlayer({ id: player.id, name: player.name })
                              setIsHistoryModalOpen(true)
                            }}
                            className="bg-gray-50 hover:bg-gray-100 text-gray-800 border border-gray-200 hover:border-gray-300 px-4 py-2 rounded-md text-sm font-medium transition-colors flex-shrink-0"
                          >
                            View History
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Player Match History Modal */}
      <PlayerMatchHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false)
          setSelectedPlayer(null)
        }}
        player={selectedPlayer}
        slug={slug}
      />

      {/* Register as Player Modal */}
      <RegisterAsPlayerModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        slug={slug}
        onSuccess={() => {
          // Optionally refresh the players list
          fetchPlayers()
        }}
      />
    </div>
  )
}

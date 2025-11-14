'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Users, ArrowLeft, Trophy } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import PlayerMatchHistoryModal from '@/components/PlayerMatchHistoryModal'

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
  const [currentUser, setCurrentUser] = useState<any>(null)

  useEffect(() => {
    if (slug) {
      fetchPlayers()
      getCurrentUser()
    }
  }, [slug])

  const getCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
  }

  const fetchPlayers = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leagues/${slug}/players`)
      
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading players...</p>
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
                <Users className="h-8 w-8" />
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
            <h2 className="text-lg font-medium text-gray-600 mt-1">Players</h2>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Users className="h-6 w-6 text-black mr-2" />
            <h2 className="text-2xl font-bold text-black">Players</h2>
          </div>
          <p className="text-gray-600">
            {data.total} player{data.total !== 1 ? 's' : ''} in this league
          </p>
        </div>


        {data.players.length === 0 ? (
          <div className="card">
            <div className="p-8 text-center">
              <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No players yet</h3>
              <p className="text-gray-500">
                No players have joined this league yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <Trophy className="h-6 w-6 text-black mr-2" />
                <h3 className="text-xl font-bold text-black">Player Rankings</h3>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Rank</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Player</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Total Matches</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">W</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">L</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Sets W</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Sets L</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Set Diff</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Points</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.players.map((player, index) => (
                    <tr key={player.id}>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-bold text-lg">#{index + 1}</span>
                      </td>
                      <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-medium">{player.name}</span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-medium">{player.wins + player.losses}</span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{player.wins}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{player.losses}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{player.sets_won}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{player.sets_lost}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className={`font-medium ${player.set_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {player.set_diff >= 0 ? '+' : ''}{player.set_diff}
                        </span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-semibold">{player.points}</span>
                      </td>
                      <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <button
                          onClick={() => {
                            setSelectedPlayer({ id: player.id, name: player.name })
                            setIsHistoryModalOpen(true)
                          }}
                          className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-md font-medium transition-colors border border-blue-200 hover:border-blue-300"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

    </div>
  )
}

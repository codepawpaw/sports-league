'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Calendar, Users, Settings, LogIn, Plus, UserPlus } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import HeadToHeadComparison from '@/components/HeadToHeadComparison'
import PlayerMatchHistoryModal from '@/components/PlayerMatchHistoryModal'
import TopPlayersBanner from '@/components/TopPlayersBanner'
import MatchRequestModal from '@/components/MatchRequestModal'
import MatchRequestsDisplay from '@/components/MatchRequestsDisplay'
import PlayerClaimModal from '@/components/PlayerClaimModal'
import PlayerClaimButton from '@/components/PlayerClaimButton'
import ClaimPlayerDropdownModal from '@/components/ClaimPlayerDropdownModal'

interface League {
  id: string
  name: string
  slug: string
  description: string | null
  sets_per_match: number
  created_at: string
}

interface Season {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  is_finished: boolean
}

interface Participant {
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

interface Match {
  id: string
  player1: { id: string; name: string }
  player2: { id: string; name: string }
  player1_score: number | null
  player2_score: number | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
}

interface SupabaseMatchData {
  id: string
  player1_score: number | null
  player2_score: number | null
  status: string
}

interface SupabaseParticipantData {
  id: string
  name: string
  email: string | null
  league_id: string
  player1_matches?: SupabaseMatchData[]
  player2_matches?: SupabaseMatchData[]
}

export default function LeaguePage() {
  const params = useParams()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [league, setLeague] = useState<League | null>(null)
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [upcomingMatches, setUpcomingMatches] = useState<Match[]>([])
  const [recentMatches, setRecentMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState<{ id: string; name: string } | null>(null)
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)
  const [isMatchRequestModalOpen, setIsMatchRequestModalOpen] = useState(false)
  const [matchRequestRefreshTrigger, setMatchRequestRefreshTrigger] = useState(0)
  const [isParticipant, setIsParticipant] = useState(false)
  const [selectedClaimPlayer, setSelectedClaimPlayer] = useState<{ id: string; name: string } | null>(null)
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false)
  const [isClaimDropdownModalOpen, setIsClaimDropdownModalOpen] = useState(false)
  const [claimRefreshTrigger, setClaimRefreshTrigger] = useState(0)

  useEffect(() => {
    if (slug) {
      fetchLeagueData()
    }
  }, [slug])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      // Refresh the page to update the UI state
      window.location.reload()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const fetchLeagueData = async () => {
    try {
      setLoading(true)

      // Fetch league info
      const { data: leagueData, error: leagueError } = await supabase
        .from('leagues')
        .select('*')
        .eq('slug', slug)
        .single()

      if (leagueError || !leagueData) {
        setError('League not found')
        return
      }

      setLeague(leagueData)

      // Fetch active season info
      try {
        const response = await fetch(`/api/leagues/${slug}/seasons`)
        if (response.ok) {
          const data = await response.json()
          const activeSeasonData = data.seasons.find((s: Season) => s.is_active)
          setActiveSeason(activeSeasonData || null)
        }
      } catch (error) {
        console.error('Error fetching season data:', error)
      }

      // Check if current user is admin and participant
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      
      if (user) {
        const { data: adminData } = await supabase
          .from('league_admins')
          .select('id')
          .eq('league_id', leagueData.id)
          .eq('email', user.email)
          .single()

        setIsAdmin(!!adminData)

        // Check if user is a participant
        const { data: participantData } = await supabase
          .from('participants')
          .select('id')
          .eq('league_id', leagueData.id)
          .eq('email', user.email)
          .single()

        setIsParticipant(!!participantData)
      }

      // Fetch participants with calculated stats
      const { data: participantsData } = await supabase
        .from('participants')
        .select(`
          *,
          player1_matches:matches!matches_player1_id_fkey(id, player1_score, player2_score, status),
          player2_matches:matches!matches_player2_id_fkey(id, player1_score, player2_score, status)
        `)
        .eq('league_id', leagueData.id)

      if (participantsData) {
        const participantsWithStats = (participantsData as SupabaseParticipantData[])
          .filter((p: SupabaseParticipantData) => p && p.id && p.name) // Filter out invalid entries
          .map((p: SupabaseParticipantData) => {
            const completedMatches1 = p.player1_matches?.filter((m: SupabaseMatchData) => m.status === 'completed') || []
            const completedMatches2 = p.player2_matches?.filter((m: SupabaseMatchData) => m.status === 'completed') || []
            
            let wins = 0
            let losses = 0
            let sets_won = 0
            let sets_lost = 0

            completedMatches1.forEach((m: SupabaseMatchData) => {
              const player1_sets = m.player1_score || 0
              const player2_sets = m.player2_score || 0
              
              sets_won += player1_sets // Add sets won by this player in this match
              sets_lost += player2_sets // Add sets lost by this player in this match
              
              if (player1_sets > player2_sets) wins++
              else losses++
            })

            completedMatches2.forEach((m: SupabaseMatchData) => {
              const player1_sets = m.player1_score || 0
              const player2_sets = m.player2_score || 0
              
              sets_won += player2_sets // Add sets won by this player in this match
              sets_lost += player1_sets // Add sets lost by this player in this match
              
              if (player2_sets > player1_sets) wins++
              else losses++
            })

            const set_diff = sets_won - sets_lost // Calculate set difference
            const points = wins * 2 // 2 points for win, 0 for loss

            return {
              id: p.id,
              name: p.name || 'Unknown Player',
              email: p.email,
              wins,
              losses,
              sets_won,
              sets_lost,
              set_diff,
              points
            }
          })

        // Sort by points (descending), then by set diff (descending), then alphabetically by name (ascending)
        participantsWithStats.sort((a, b) => {
          if (a.points !== b.points) return b.points - a.points
          if (a.set_diff !== b.set_diff) return b.set_diff - a.set_diff
          return (a.name || '').localeCompare(b.name || '') // Alphabetical tiebreaker with null safety
        })

        setParticipants(participantsWithStats)
      }

      // Fetch upcoming matches
      const { data: upcomingData } = await supabase
        .from('matches')
        .select(`
          *,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        `)
        .eq('league_id', leagueData.id)
        .in('status', ['scheduled', 'in_progress'])
        .order('scheduled_at', { ascending: true })
        .limit(5)

      if (upcomingData) {
        setUpcomingMatches(upcomingData
          .filter(m => m && m.player1 && m.player2 && m.player1.name && m.player2.name) // Filter out invalid matches
          .map(m => ({
            id: m.id,
            player1: { id: m.player1.id, name: m.player1.name || 'Unknown Player' },
            player2: { id: m.player2.id, name: m.player2.name || 'Unknown Player' },
            player1_score: m.player1_score,
            player2_score: m.player2_score,
            status: m.status,
            scheduled_at: m.scheduled_at,
            completed_at: m.completed_at
          })))
      }

      // Fetch recent completed matches
      const { data: recentData } = await supabase
        .from('matches')
        .select(`
          *,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        `)
        .eq('league_id', leagueData.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
        .limit(5)

      if (recentData) {
        setRecentMatches(recentData
          .filter(m => m && m.player1 && m.player2 && m.player1.name && m.player2.name) // Filter out invalid matches
          .map(m => ({
            id: m.id,
            player1: { id: m.player1.id, name: m.player1.name || 'Unknown Player' },
            player2: { id: m.player2.id, name: m.player2.name || 'Unknown Player' },
            player1_score: m.player1_score,
            player2_score: m.player2_score,
            status: m.status,
            scheduled_at: m.scheduled_at,
            completed_at: m.completed_at
          })))
      }

    } catch (err) {
      console.error('Error fetching league data:', err)
      setError('Failed to load league data')
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

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading league data...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">League Not Found</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href="/" className="btn-primary">
            Go Home
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
                <Trophy className="h-8 w-8" />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Link href={`/${slug}/admin`} className="btn-outline">
                  Admin Panel
                </Link>
              )}
              {currentUser && (
                <button onClick={handleLogout} className="btn-compact">
                  Log Out
                </button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* League Title and Navigation */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black break-words">{league?.name}</h1>
              {activeSeason && (
                <h2 className="text-lg font-medium text-gray-600 mt-1">{activeSeason.name}</h2>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link href={`/${slug}/players`} className="btn-compact">
                Players
              </Link>
              <Link href={`/${slug}/upcoming`} className="btn-compact">
                Upcoming Matches
              </Link>
              <Link href={`/${slug}/results`} className="btn-compact">
                All Results
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {/* Active Season Description */}
        {activeSeason?.description && (
          <div className="mb-8 p-4 bg-gray-50 rounded-lg border">
            <p className="text-gray-700 text-center">{activeSeason.description}</p>
          </div>
        )}

        {league?.description && (
          <div className="mb-8">
            <p className="text-lg text-gray-600">{league.description}</p>
          </div>
        )}

        {/* Authentication and Action Buttons Section */}
        {currentUser ? (
          isParticipant ? (
            <div className="mb-8">
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setIsClaimDropdownModalOpen(true)}
                  className="bg-gray-700 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors flex items-center"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Claim Player
                </button>
                <button
                  onClick={() => setIsMatchRequestModalOpen(true)}
                  className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors flex items-center"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Request a Match
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-8">
              <div className="flex justify-center gap-4 mb-4">
                <button
                  onClick={() => setIsClaimDropdownModalOpen(true)}
                  className="bg-gray-700 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors flex items-center"
                >
                  <UserPlus className="h-5 w-5 mr-2" />
                  Claim Player
                </button>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border text-center">
                <p className="text-gray-600">
                  You need to be a participant in this league to request matches. Contact the league admin to join.
                </p>
              </div>
            </div>
          )
        ) : (
          <div className="mb-8">
            <div className="flex justify-center gap-4 mb-4">
              <button
                onClick={() => setIsClaimDropdownModalOpen(true)}
                className="bg-gray-700 text-white px-6 py-3 rounded-md hover:bg-gray-600 transition-colors flex items-center"
              >
                <UserPlus className="h-5 w-5 mr-2" />
                Claim Player
              </button>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border text-center">
              <p className="text-gray-600 mb-4">
                Sign in with Google to request matches with other players
              </p>
              <Link
                href={`/${slug}/auth`}
                className="bg-black text-white px-6 py-3 rounded-md hover:bg-gray-800 transition-colors inline-flex items-center"
              >
                <LogIn className="h-5 w-5 mr-2" />
                Sign In with Google
              </Link>
            </div>
          </div>
        )}

        {/* Match Requests Display */}
        <MatchRequestsDisplay 
          slug={slug}
          currentUserEmail={currentUser?.email || null}
          refreshTrigger={matchRequestRefreshTrigger}
        />

        {/* Top Players Banner */}
        <TopPlayersBanner 
          participants={participants}
          upcomingMatches={upcomingMatches}
        />

        {/* Rankings - Full Width */}
        <div className="space-y-8">
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center">
                <Trophy className="h-6 w-6 text-black mr-2" />
                <h2 className="text-xl font-bold text-black">Current Rankings</h2>
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
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Claim</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {participants.map((participant, index) => (
                    <tr key={participant.id}>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-bold text-lg">#{index + 1}</span>
                      </td>
                      <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-medium">{participant.name}</span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-medium">{participant.wins + participant.losses}</span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{participant.wins}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{participant.losses}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{participant.sets_won}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">{participant.sets_lost}</td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className={`font-medium ${participant.set_diff >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {participant.set_diff >= 0 ? '+' : ''}{participant.set_diff}
                        </span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-semibold">{participant.points}</span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <PlayerClaimButton
                          player={participant}
                          slug={slug}
                          currentUserEmail={currentUser?.email || null}
                          onClaimClick={(player) => {
                            setSelectedClaimPlayer(player)
                            setIsClaimModalOpen(true)
                          }}
                          refreshTrigger={claimRefreshTrigger}
                        />
                      </td>
                      <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <button
                          onClick={() => {
                            setSelectedPlayer({ id: participant.id, name: participant.name })
                            setIsHistoryModalOpen(true)
                          }}
                          className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded-md font-medium transition-colors border border-blue-200 hover:border-blue-300"
                        >
                          History
                        </button>
                      </td>
                    </tr>
                  ))}
                  {participants.length === 0 && (
                    <tr>
                      <td colSpan={11} className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900 text-center text-gray-500">
                        No participants yet
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Head-to-Head Analysis */}
          {participants.length >= 2 && (
            <HeadToHeadComparison 
              participants={participants.map(p => ({ id: p.id, name: p.name }))} 
              slug={slug}
            />
          )}
        </div>

        {/* Sidebar - Now Below Rankings */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {/* Upcoming Matches */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center">
                <h3 className="font-semibold text-black">Upcoming Matches</h3>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {upcomingMatches.map((match) => (
                <div key={match.id} className="text-sm">
                  <div className="font-medium text-black">
                    {match.player1.name} vs {match.player2.name}
                  </div>
                  {match.scheduled_at && (
                    <div className="text-gray-500">
                      {formatDate(match.scheduled_at)}
                    </div>
                  )}
                  <div className={`inline-block px-2 py-1 rounded-full text-xs ${
                    match.status === 'scheduled' ? 'bg-blue-100 text-blue-800' : 'bg-yellow-100 text-yellow-800'
                  }`}>
                    {match.status === 'scheduled' ? 'Scheduled' : 'In Progress'}
                  </div>
                </div>
              ))}
              {upcomingMatches.length === 0 && (
                <p className="text-gray-500 text-sm">No upcoming matches</p>
              )}
            </div>
          </div>

          {/* Recent Results */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <h3 className="font-semibold text-black">Recent Results</h3>
            </div>
            <div className="p-4 space-y-3">
              {recentMatches.map((match) => (
                <div key={match.id} className="text-sm">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="font-medium text-black">
                        {match.player1.name} vs {match.player2.name}
                      </div>
                      <div className="text-gray-500">
                        {match.completed_at && formatDate(match.completed_at)}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-black">
                        {match.player1_score} - {match.player2_score}
                      </div>
                      <div className="text-xs text-gray-500">
                        {(match.player1_score !== null && match.player2_score !== null && 
                          match.player1_score > match.player2_score) ? 
                          match.player1.name : match.player2.name} wins
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {recentMatches.length === 0 && (
                <p className="text-gray-500 text-sm">No completed matches</p>
              )}
            </div>
          </div>

          {/* League Info */}
          <div className="card">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center">
                <Users className="h-5 w-5 text-black mr-2" />
                <h3 className="font-semibold text-black">League Info</h3>
              </div>
            </div>
            <div className="p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Format:</span>
                <span className="text-black">Best of {league?.sets_per_match}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Players:</span>
                <span className="text-black">{participants.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Matches:</span>
                <span className="text-black">{upcomingMatches.length + recentMatches.length}</span>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Match Request Modal */}
      <MatchRequestModal
        isOpen={isMatchRequestModalOpen}
        onClose={() => setIsMatchRequestModalOpen(false)}
        slug={slug}
        currentUserEmail={currentUser?.email || null}
        onRequestCreated={() => {
          setMatchRequestRefreshTrigger(prev => prev + 1)
        }}
      />

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

      {/* Player Claim Modal */}
      <PlayerClaimModal
        isOpen={isClaimModalOpen}
        onClose={() => {
          setIsClaimModalOpen(false)
          setSelectedClaimPlayer(null)
        }}
        player={selectedClaimPlayer}
        slug={slug}
        currentUserEmail={currentUser?.email || null}
        onClaimSuccess={() => {
          setClaimRefreshTrigger(prev => prev + 1)
          fetchLeagueData() // Refresh participants data to show updated claim status
        }}
      />

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

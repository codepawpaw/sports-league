'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Calendar, Users, Settings, LogIn, Plus, RefreshCw } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import HeadToHeadComparison from '@/components/HeadToHeadComparison'
import PlayerMatchHistoryModal from '@/components/PlayerMatchHistoryModal'
import TopPlayersBanner from '@/components/TopPlayersBanner'
import ScheduleRequestNotifications from '@/components/ScheduleRequestNotifications'
import ScoreRequestNotifications from '@/components/ScoreRequestNotifications'
import RegisterAsPlayerModal from '@/components/RegisterAsPlayerModal'
import MatchTabs from '@/components/MatchTabs'
import TabNavigation from '@/components/TabNavigation'
import CompletedMatchesCarousel from '@/components/CompletedMatchesCarousel'

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
  current_rating?: number
  is_provisional?: boolean
  total_matches?: number
  winning_streak: number
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
  const [isParticipant, setIsParticipant] = useState(false)
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false)
  const [hasShownAutoModal, setHasShownAutoModal] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchLeagueData()
    }
  }, [slug])

  // Auto-modal logic: show modal when user is authenticated but not a participant
  useEffect(() => {
    if (currentUser !== null && !loading && slug) {
      // Check if we've already shown the auto-modal for this league
      const storageKey = `autoModal_${slug}`
      const hasShownBefore = localStorage.getItem(storageKey) === 'true'
      
      if (currentUser && !isParticipant && !hasShownBefore && !hasShownAutoModal) {
        // Show the modal automatically
        setIsRegisterModalOpen(true)
        setHasShownAutoModal(true)
        // Mark as shown in localStorage
        localStorage.setItem(storageKey, 'true')
      }
    }
  }, [currentUser, isParticipant, loading, slug, hasShownAutoModal])

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut()
      // Refresh the page to update the UI state
      window.location.reload()
    } catch (error) {
      console.error('Error logging out:', error)
    }
  }

  const handleRegistrationSuccess = () => {
    // Refresh league data to update participant status
    fetchLeagueData()
    setIsRegisterModalOpen(false)
  }

  const handleManualRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetchLeagueData()
    } finally {
      setRefreshing(false)
    }
  }

  const fetchLeagueData = async () => {
    const timestamp = Date.now()
    const requestId = Math.random().toString(36).substring(7)
    
    console.log("===================================")
    console.log(`[${new Date().toISOString()}] [${requestId}] Call fetch league data for slug: ${slug}`)
    
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

      // Fetch active season info with stronger cache busting
      try {
        const seasonUrl = `/api/leagues/${slug}/seasons?t=${timestamp}&r=${requestId}`
        console.log(`[${new Date().toISOString()}] [${requestId}] Fetching season data from: ${seasonUrl}`)
        
        const response = await fetch(seasonUrl, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (response.ok) {
          const data = await response.json()
          const activeSeasonData = data.seasons.find((s: Season) => s.is_active)
          setActiveSeason(activeSeasonData || null)
          console.log(`[${new Date().toISOString()}] [${requestId}] Found active season:`, activeSeasonData?.name || 'None')
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] [${requestId}] Error fetching season data:`, error)
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

      // Fetch participants with ratings from API with stronger cache busting
      try {
        const playersUrl = `/api/leagues/${slug}/players?t=${timestamp}&r=${requestId}`
        console.log(`[${new Date().toISOString()}] [${requestId}] Fetching players data from: ${playersUrl}`)
        
        const playersResponse = await fetch(playersUrl, {
          method: 'GET',
          cache: 'no-store',
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'Expires': '0'
          }
        })
        if (playersResponse.ok) {
          const playersData = await playersResponse.json()
          console.log("playersData ===== ", playersData)
          console.log(`[${new Date().toISOString()}] [${requestId}] Received players data:`, {
            players_count: playersData.players?.length || 0,
            generated_at: playersData.generated_at,
            request_id: playersData.request_id
          })
          setParticipants(playersData.players || [])
        } else {
          console.error(`[${new Date().toISOString()}] [${requestId}] Failed to fetch players:`, playersResponse.status, playersResponse.statusText)
          setParticipants([])
        }
      } catch (error) {
        console.error(`[${new Date().toISOString()}] [${requestId}] Error fetching players:`, error)
        // Fallback to empty array
        setParticipants([])
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
                <Link href={`/${slug}/admin`} className="btn-compact">
                  Admin Panel
                </Link>
              )}
              {currentUser && !isParticipant && (
                <button 
                  onClick={() => setIsRegisterModalOpen(true)} 
                  className="btn-compact"
                >
                  Register as Player
                </button>
              )}
              {currentUser ? (
                <button onClick={handleLogout} className="btn-compact">
                  Log Out
                </button>
              ) : (
                <Link href={`/${slug}/auth`} className="btn-primary flex items-center gap-2">
                  <LogIn className="h-4 w-4" />
                  Log In
                </Link>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* League Title */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black break-words">{league?.name}</h1>
            {activeSeason && (
              <h2 className="text-lg font-medium text-gray-600 mt-1">{activeSeason.name}</h2>
            )}
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <TabNavigation 
        currentUser={currentUser}
        isParticipant={isParticipant}
      />

      {/* Completed Matches Carousel */}
      <CompletedMatchesCarousel recentMatches={recentMatches} />

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

        {/* Score Request Notifications */}
        <ScoreRequestNotifications slug={slug} />

        {/* Schedule Request Notifications */}
        <ScheduleRequestNotifications slug={slug} />

        {/* Match Tabs - Upcoming Matches Only */}
        <MatchTabs 
          upcomingMatches={upcomingMatches}
          slug={slug}
        />

        {/* Rankings - Full Width */}
        <div className="space-y-8">
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Trophy className="h-6 w-6 text-black mr-2" />
                  <h2 className="text-xl font-bold text-black">Current Rankings</h2>
                </div>
                <button
                  onClick={handleManualRefresh}
                  disabled={refreshing}
                  className={`btn-compact flex items-center gap-2 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                  title="Refresh rankings and match data"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing...' : 'Refresh'}
                </button>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Rank</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-4 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Player</th>
                    <th className="bg-gray-50 border-b border-gray-200 px-3 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">Rating</th>
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
                  {participants.map((participant, index) => (
                    <tr key={participant.id}>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-bold text-lg">#{index + 1}</span>
                      </td>
                      <td className="px-4 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <span className="font-medium">{participant.name}</span>
                      </td>
                      <td className="px-3 py-4 border-b border-gray-200 text-sm text-gray-900">
                        <div className="flex flex-col">
                          <span className="font-semibold text-lg">{participant.current_rating || 1200}</span>
                          {participant.is_provisional && (
                            <span className="text-xs text-gray-500">Provisional</span>
                          )}
                        </div>
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
         

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
        onSuccess={handleRegistrationSuccess}
      />

    </div>
  )
}

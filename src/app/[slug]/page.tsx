'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, Calendar, Users, Settings, LogIn, Plus, RefreshCw, ChevronDown } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import HeadToHeadComparison from '@/components/HeadToHeadComparison'
import PlayerMatchHistoryModal from '@/components/PlayerMatchHistoryModal'
import TopPlayersBanner from '@/components/TopPlayersBanner'
import ScheduleRequestNotifications from '@/components/ScheduleRequestNotifications'
import ScoreRequestNotifications from '@/components/ScoreRequestNotifications'
import RegisterAsPlayerModal from '@/components/RegisterAsPlayerModal'
import UpcomingMatchesCarousel from '@/components/UpcomingMatchesCarousel'
import TabNavigation from '@/components/TabNavigation'
import CompletedMatchesCarousel from '@/components/CompletedMatchesCarousel'
import LeaguePredictionCard from '@/components/LeaguePredictionCard'
import RatingCalculationModal from '@/components/RatingCalculationModal'
import ChallengeRequestModal from '@/components/ChallengeRequestModal'

interface League {
  id: string
  name: string
  slug: string
  description: string | null
  sets_per_match: number
  created_at: string
}


interface Tournament {
  id: string
  name: string
  slug: string
  description: string | null
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
  start_date: string | null
  end_date: string | null
  tournament_type?: string
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
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false)

  // Tournament-based rankings state
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null)

  // Challenge request state
  const [pendingChallenge, setPendingChallenge] = useState<any>(null)
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false)
  const [hasCheckedChallenges, setHasCheckedChallenges] = useState(false)

  useEffect(() => {
    if (slug) {
      fetchLeagueData()
      fetchTournaments()
    }
  }, [slug])

  // Fetch tournament data when selectedTournament changes
  useEffect(() => {
    if (selectedTournament) {
      fetchTournamentRankings()
      fetchTournamentMatches()
      checkForPendingChallenges()
    } else {
      // Clear matches when no tournament is selected
      setUpcomingMatches([])
      setRecentMatches([])
    }
  }, [selectedTournament])

  // Check for pending challenges when user and participant status change
  useEffect(() => {
    if (currentUser && isParticipant && selectedTournament && !hasCheckedChallenges) {
      checkForPendingChallenges()
    }
  }, [currentUser, isParticipant, selectedTournament, hasCheckedChallenges])

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments`, {
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
        setTournaments(data.tournaments || [])
        
        // Auto-select the first active tournament or latest tournament
        if (data.tournaments && data.tournaments.length > 0) {
          const activeTournament = data.tournaments.find((t: Tournament) => t.status === 'active')
          const selectedTournament = activeTournament || data.tournaments[0]
          setSelectedTournament(selectedTournament)
          setCurrentTournament(selectedTournament)
        }
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error)
    }
  }

  const fetchTournamentRankings = async () => {
    if (!selectedTournament) return

    const timestamp = Date.now()
    const requestId = Math.random().toString(36).substring(7)
    
    try {
      const playersUrl = `/api/leagues/${slug}/players-v2?tournamentId=${selectedTournament.id}&t=${timestamp}&r=${requestId}`
      console.log(`Fetching tournament rankings from: ${playersUrl}`)
      
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
        console.log("Tournament rankings data:", playersData)
        setParticipants(playersData.players || [])
        setCurrentTournament(playersData.tournament || selectedTournament)
      } else {
        console.error('Failed to fetch tournament rankings:', playersResponse.status, playersResponse.statusText)
        setParticipants([])
      }
    } catch (error) {
      console.error('Error fetching tournament rankings:', error)
      setParticipants([])
    }
  }

  const fetchTournamentMatches = async () => {
    if (!selectedTournament || !league) return

    try {
      // Fetch upcoming matches for the tournament
      const { data: upcomingData } = await supabase
        .from('matches')
        .select(`
          *,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        `)
        .eq('league_id', league.id)
        .eq('tournament_id', selectedTournament.id)
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

      // Fetch recent completed matches for the tournament
      const { data: recentData } = await supabase
        .from('matches')
        .select(`
          *,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        `)
        .eq('league_id', league.id)
        .eq('tournament_id', selectedTournament.id)
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
    } catch (error) {
      console.error('Error fetching tournament matches:', error)
      setUpcomingMatches([])
      setRecentMatches([])
    }
  }

  const handleTournamentSelect = (tournament: Tournament) => {
    setSelectedTournament(tournament)
    setIsDropdownOpen(false)
  }

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

  const checkForPendingChallenges = async () => {
    if (!selectedTournament || !currentUser || !isParticipant || hasCheckedChallenges) {
      return
    }

    // Only check for challenges in exhibition tournaments
    if (selectedTournament.tournament_type !== 'exhibition') {
      setHasCheckedChallenges(true)
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments/${selectedTournament.slug}/challenges`, {
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
        const receivedChallenges = data.received_challenges || []
        
        // Find the most recent pending challenge
        const pendingChallenge = receivedChallenges.find((challenge: any) => challenge.status === 'pending')
        
        if (pendingChallenge) {
          // Check if we've already shown this specific challenge to avoid repetition
          const storageKey = `challenge_shown_${pendingChallenge.id}`
          const hasShownChallenge = localStorage.getItem(storageKey) === 'true'
          
          if (!hasShownChallenge) {
            setPendingChallenge(pendingChallenge)
            setIsChallengeModalOpen(true)
            // Mark this challenge as shown
            localStorage.setItem(storageKey, 'true')
          }
        }
      }
    } catch (error) {
      console.error('Error checking for pending challenges:', error)
    } finally {
      setHasCheckedChallenges(true)
    }
  }

  const handleChallengeSuccess = () => {
    // Refresh tournament data to update matches
    fetchTournamentMatches()
    setIsChallengeModalOpen(false)
    setPendingChallenge(null)
    setHasCheckedChallenges(false) // Allow checking for new challenges
  }

  const handleManualRefresh = async () => {
    if (refreshing) return
    setRefreshing(true)
    try {
      await fetchLeagueData()
      setHasCheckedChallenges(false) // Allow checking for challenges again after refresh
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


      // Check if current user is admin/editor and participant
      const { data: { user } } = await supabase.auth.getUser()
      setCurrentUser(user)
      
      if (user) {
        // Check if user is admin
        const { data: adminData } = await supabase
          .from('league_admins')
          .select('id')
          .eq('league_id', leagueData.id)
          .eq('email', user.email)
          .single()

        // Check if user is editor (if not admin)
        let editorData = null
        if (!adminData) {
          const { data: editorResult } = await supabase
            .from('league_editors')
            .select('id')
            .eq('league_id', leagueData.id)
            .eq('email', user.email)
            .single()
          
          editorData = editorResult
        }

        // User has admin access if they are either admin or editor
        setIsAdmin(!!(adminData || editorData))

        // Check if user is a participant
        const { data: participantData } = await supabase
          .from('participants')
          .select('id')
          .eq('league_id', leagueData.id)
          .eq('email', user.email)
          .single()

        setIsParticipant(!!participantData)
      }

      // Clear participants and matches initially - they'll be loaded when tournament is selected
      setParticipants([])
      setUpcomingMatches([])
      setRecentMatches([])

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

      {/* League Title with Tournament Selection */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold text-black break-words">{league?.name}</h1>
              {currentTournament && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm font-medium text-gray-700">Tournament:</span>
                  <span className="text-sm font-semibold text-green-700">{currentTournament.name}</span>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    currentTournament.status === 'active' ? 'bg-green-100 text-green-800' :
                    currentTournament.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                    currentTournament.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {currentTournament.status.charAt(0).toUpperCase() + currentTournament.status.slice(1)}
                  </span>
                </div>
              )}
            </div>
            
            {/* Tournament Selector */}
            {tournaments.length > 0 && (
              <div className="relative">
                <button
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors duration-200"
                >
                  Select Tournament
                  <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                    {tournaments.map((tournament) => (
                      <button
                        key={tournament.id}
                        onClick={() => handleTournamentSelect(tournament)}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors duration-150 ${
                          selectedTournament?.id === tournament.id ? 'bg-blue-50 border-l-4 border-blue-500' : ''
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium text-gray-900">{tournament.name}</div>
                            {tournament.description && (
                              <div className="text-sm text-gray-600 mt-1">{tournament.description}</div>
                            )}
                          </div>
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                            tournament.status === 'active' ? 'bg-green-100 text-green-800' :
                            tournament.status === 'completed' ? 'bg-gray-100 text-gray-800' :
                            tournament.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                          </span>
                        </div>
                      </button>
                    ))}
                    
                    {tournaments.length === 0 && (
                      <div className="px-4 py-6 text-center text-gray-500">
                        <div className="font-medium">No tournaments available</div>
                        <div className="text-sm mt-1">Tournaments will appear here once created</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
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

      <UpcomingMatchesCarousel 
          upcomingMatches={upcomingMatches}
          slug={slug}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {league?.description && (
          <div className="mb-8">
            <p className="text-lg text-gray-600">{league.description}</p>
          </div>
        )}

        {/* Score Request Notifications */}
        <ScoreRequestNotifications slug={slug} />

        {/* Schedule Request Notifications */}
        <ScheduleRequestNotifications slug={slug} />

        {/* Championship Predictions */}
        <LeaguePredictionCard slug={slug} selectedTournament={currentTournament} />

        {/* Tournament Rankings - Full Width */}
        <div className="space-y-8">
          <div className="card">
            <div className="p-8 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-black tracking-tight">
                    Tournament Rankings
                  </h2>
                  <p className="text-gray-600 text-sm mt-1">
                    Tournament standings and player statistics
                  </p>
                  {!currentTournament && tournaments.length === 0 && (
                    <p className="text-sm text-orange-600 mt-2">
                      No tournaments found. Please create a tournament to view rankings.
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setIsRatingModalOpen(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-black bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors duration-200"
                    title="Learn how ratings are calculated in this tournament"
                  >
                    How rating calculated?
                  </button>
                  <button
                    onClick={handleManualRefresh}
                    disabled={refreshing}
                    className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors duration-200 ${refreshing ? 'opacity-50 cursor-not-allowed' : ''}`}
                    title="Refresh rankings and match data"
                  >
                    <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                    {refreshing ? 'Refreshing...' : 'Refresh'}
                  </button>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="bg-white px-6 py-4 text-left text-sm font-bold text-black">#</th>
                    <th className="bg-white px-6 py-4 text-left text-sm font-bold text-black">Player</th>
                    <th className="bg-white px-4 py-4 text-left text-sm font-bold text-black">Rating</th>
                    {currentTournament?.tournament_type !== 'exhibition' && (
                      <>
                        <th className="bg-white px-4 py-4 text-left text-sm font-bold text-black hidden sm:table-cell">Matches</th>
                        <th className="bg-white px-3 py-4 text-left text-sm font-bold text-green-700">W</th>
                        <th className="bg-white px-3 py-4 text-left text-sm font-bold text-black">L</th>
                        <th className="bg-white px-3 py-4 text-left text-sm font-bold text-green-700 hidden md:table-cell">Sets W</th>
                        <th className="bg-white px-3 py-4 text-left text-sm font-bold text-black hidden md:table-cell">Sets L</th>
                        <th className="bg-white px-4 py-4 text-left text-sm font-bold text-black hidden lg:table-cell">Set Diff</th>
                        <th className="bg-white px-4 py-4 text-left text-sm font-bold text-black">Points</th>
                      </>
                    )}
                    {currentTournament?.tournament_type === 'exhibition' && (
                      <>
                        <th className="bg-white px-4 py-4 text-left text-sm font-bold text-black hidden sm:table-cell">Matches Played</th>
                        <th className="bg-white px-4 py-4 text-left text-sm font-bold text-gray-600 hidden md:table-cell">Win Rate</th>
                        <th className="bg-white px-4 py-4 text-left text-sm font-bold text-blue-600 hidden lg:table-cell">Winning Streak</th>
                      </>
                    )}
                    <th className="bg-white px-6 py-4 text-left text-sm font-bold text-black">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {participants.map((participant, index) => (
                    <tr key={participant.id} className="hover:bg-green-50 transition-colors duration-150 group">
                      <td className="px-6 py-6">
                        <div className="flex items-center">
                          <span className={`text-lg font-bold ${currentTournament?.tournament_type === 'exhibition' ? 'text-blue-700' : index < 3 ? 'text-green-700' : 'text-black'}`}>
                            #{index + 1}
                          </span>
                          {currentTournament?.tournament_type !== 'exhibition' && index === 0 && (
                            <div className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-6">
                        <div className="font-semibold text-black text-base group-hover:text-green-800 transition-colors">
                          {participant.name}
                        </div>
                      </td>
                      <td className="px-4 py-6">
                        <div className="flex flex-col">
                          <span className={`font-bold text-base ${currentTournament?.tournament_type === 'exhibition' ? 'text-blue-700' : 'text-black'}`}>
                            {participant.current_rating || 1200}
                          </span>
                          {participant.is_provisional && (
                            <span className="text-xs text-gray-500 font-medium">Provisional</span>
                          )}
                        </div>
                      </td>
                      {currentTournament?.tournament_type !== 'exhibition' && (
                        <>
                          <td className="px-4 py-6 hidden sm:table-cell">
                            <span className="font-medium text-black">{participant.wins + participant.losses}</span>
                          </td>
                          <td className="px-3 py-6">
                            <span className="font-bold text-green-700 text-base">{participant.wins}</span>
                          </td>
                          <td className="px-3 py-6">
                            <span className="font-medium text-black">{participant.losses}</span>
                          </td>
                          <td className="px-3 py-6 hidden md:table-cell">
                            <span className="font-bold text-green-700">{participant.sets_won}</span>
                          </td>
                          <td className="px-3 py-6 hidden md:table-cell">
                            <span className="font-medium text-black">{participant.sets_lost}</span>
                          </td>
                          <td className="px-4 py-6 hidden lg:table-cell">
                            <span className={`font-bold ${participant.set_diff >= 0 ? 'text-green-700' : 'text-black'}`}>
                              {participant.set_diff >= 0 ? '+' : ''}{participant.set_diff}
                            </span>
                          </td>
                          <td className="px-4 py-6">
                            <span className="font-bold text-black text-base">{participant.points}</span>
                          </td>
                        </>
                      )}
                      {currentTournament?.tournament_type === 'exhibition' && (
                        <>
                          <td className="px-4 py-6 hidden sm:table-cell">
                            <span className="font-medium text-black">{participant.wins + participant.losses}</span>
                          </td>
                          <td className="px-4 py-6 hidden md:table-cell">
                            <span className="font-medium text-gray-600">
                              {participant.wins + participant.losses > 0 ? 
                                `${Math.round((participant.wins / (participant.wins + participant.losses)) * 100)}%` : 
                                'N/A'
                              }
                            </span>
                          </td>
                          <td className="px-4 py-6 hidden lg:table-cell">
                            <div className="flex items-center">
                              <span className={`font-bold ${participant.winning_streak > 0 ? 'text-blue-700' : 'text-gray-500'}`}>
                                {participant.winning_streak || 0}
                              </span>
                              {participant.winning_streak >= 3 && (
                                <div className="ml-1 w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></div>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-6">
                        <button
                          onClick={() => {
                            setSelectedPlayer({ id: participant.id, name: participant.name })
                            setIsHistoryModalOpen(true)
                          }}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 hover:text-green-800 transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                        >
                          View History
                        </button>
                      </td>
                    </tr>
                  ))}
                  {participants.length === 0 && (
                    <tr>
                      <td colSpan={currentTournament?.tournament_type === 'exhibition' ? 6 : 11} className="px-6 py-12 text-center">
                        <div className="text-gray-500 font-medium">No participants yet</div>
                        <div className="text-gray-400 text-sm mt-1">Players will appear here once they join the league</div>
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

      {/* Rating Calculation Modal */}
      <RatingCalculationModal
        isOpen={isRatingModalOpen}
        onClose={() => setIsRatingModalOpen(false)}
        currentTournament={currentTournament}
      />

      {/* Challenge Request Modal */}
      <ChallengeRequestModal
        isOpen={isChallengeModalOpen}
        onClose={() => setIsChallengeModalOpen(false)}
        challenge={pendingChallenge}
        slug={slug}
        tournamentSlug={selectedTournament?.slug || ''}
        onSuccess={handleChallengeSuccess}
      />

    </div>
  )
}

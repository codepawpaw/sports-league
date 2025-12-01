'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ArrowLeft, Users, Calendar, Plus, Edit, Trash2, Save, X, Shuffle, Eye, Clock, Shield, CheckCircle, XCircle, MessageSquare, UserPlus, Settings, Calculator } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import MatchEditModal from '@/components/MatchEditModal'
import TournamentSettingsModal from '@/components/TournamentSettingsModal'

interface League {
  id: string
  name: string
  slug: string
  description: string | null
  sets_per_match: number
}

interface Participant {
  id: string
  name: string
  email: string | null
}

interface Match {
  id: string
  player1: { id: string; name: string }
  player2: { id: string; name: string }
  player1_score: number | null
  player2_score: number | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
}

interface Admin {
  id: string
  email: string
  created_at: string
}


interface RegistrationRequest {
  id: string
  player_id: string
  claimer_email: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at: string | null
  reviewed_by: string | null
  player: {
    id: string
    name: string
  }
}

interface ChatIntegration {
  id: string
  league_id: string
  webhook_url: string
  enabled: boolean
  notify_new_matches: boolean
  notify_approved_schedules: boolean
  notify_schedule_requests: boolean
  notify_match_completions: boolean
  daily_summary_enabled: boolean
  daily_summary_time: string
  summary_include_streaks: boolean
  summary_include_rankings: boolean
  summary_include_schedule: boolean
  last_summary_sent: string | null
  created_at: string
  updated_at: string
}

interface Tournament {
  id: string
  league_id: string
  name: string
  slug: string
  description: string | null
  tournament_type: 'round_robin' | 'table_system' | 'exhibition' | 'single_elimination' | 'double_elimination'
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
  start_date: string | null
  end_date: string | null
  max_participants: number | null
  auto_generate_matches: boolean
  settings: any
  created_at: string
  updated_at: string
  participant_count?: number
}

interface TournamentParticipant {
  id: string
  participant: {
    id: string
    name: string
    email: string | null
  }
  joined_at: string
  seed_position: number | null
}

interface TournamentParticipantsData {
  tournament_participants: TournamentParticipant[]
  available_participants: Participant[]
  max_participants: number | null
  current_count: number
}



export default function AdminPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [league, setLeague] = useState<League | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([])
  const [chatIntegration, setChatIntegration] = useState<ChatIntegration | null>(null)
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('participants')
  const [currentUserEmail, setCurrentUserEmail] = useState<string>('')
  
  // Forms state
  const [newParticipant, setNewParticipant] = useState({ name: '', email: '' })
  const [editingParticipant, setEditingParticipant] = useState<string | null>(null)
  const [editParticipantData, setEditParticipantData] = useState({ name: '', email: '' })
  
  // Admin forms state
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  
  
  // Chat integration forms state
  const [chatConfig, setChatConfig] = useState({
    webhook_url: '',
    enabled: true,
    notify_new_matches: true,
    notify_approved_schedules: true,
    notify_schedule_requests: true,
    notify_match_completions: true,
    daily_summary_enabled: false,
    daily_summary_time: '09:00',
    summary_include_streaks: true,
    summary_include_rankings: true,
    summary_include_schedule: true
  })
  const [savingChatConfig, setSavingChatConfig] = useState(false)
  const [testingChat, setTestingChat] = useState(false)
  const [sendingDailySummary, setSendingDailySummary] = useState(false)
  const [recalculatingRatings, setRecalculatingRatings] = useState(false)
  const [previewingDailySummary, setPreviewingDailySummary] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [dailySummaryPreview, setDailySummaryPreview] = useState<any>(null)
  
  // Announcement state
  const [announcementText, setAnnouncementText] = useState('')
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false)
  
  // Tournament state
  const [newTournament, setNewTournament] = useState({
    name: '',
    description: '',
    tournament_type: 'round_robin' as Tournament['tournament_type'],
    start_date: '',
    end_date: '',
    max_participants: '',
    auto_generate_matches: false
  })
  const [addingTournament, setAddingTournament] = useState(false)
  const [editingTournament, setEditingTournament] = useState<string | null>(null)
  const [editTournamentData, setEditTournamentData] = useState({
    name: '',
    description: '',
    status: 'upcoming' as Tournament['status']
  })
  
  // Tournament participants state
  const [selectedTournament, setSelectedTournament] = useState<Tournament | null>(null)
  const [tournamentParticipants, setTournamentParticipants] = useState<TournamentParticipantsData | null>(null)
  const [loadingParticipants, setLoadingParticipants] = useState(false)
  const [selectedParticipantsToAdd, setSelectedParticipantsToAdd] = useState<string[]>([])
  const [addingParticipants, setAddingParticipants] = useState(false)
  
  // Tournament settings modal state
  const [selectedTournamentForSettings, setSelectedTournamentForSettings] = useState<Tournament | null>(null)
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false)
  const [savingTournamentSettings, setSavingTournamentSettings] = useState(false)
  
  // Tournament match scheduling state
  const [selectedTournamentForMatch, setSelectedTournamentForMatch] = useState<string>('')
  const [tournamentMatches, setTournamentMatches] = useState<Match[]>([])
  const [loadingTournamentMatches, setLoadingTournamentMatches] = useState(false)
  
  const [newMatch, setNewMatch] = useState({
    player1Id: '',
    player2Id: '',
    scheduledAt: '',
    tournamentId: ''
  })
  
  // Modal state
  const [editingMatch, setEditingMatch] = useState<Match | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Match tabs state
  const [activeMatchTab, setActiveMatchTab] = useState<'scheduled' | 'completed' | 'ongoing'>('scheduled')

  // Auto draw state
  const [showAutoDraw, setShowAutoDraw] = useState(false)
  const [autoDrawConfig, setAutoDrawConfig] = useState({
    clearExisting: false,
    autoSchedule: false,
    startDate: '',
    startTime: '09:00',
    intervalDays: 1,
    daysOfWeek: [1, 2, 3, 4, 5] // Monday to Friday
  })
  const [autoDrawPreview, setAutoDrawPreview] = useState<any>(null)
  const [isGeneratingDraw, setIsGeneratingDraw] = useState(false)
  const [showPreview, setShowPreview] = useState(false)

  // Player filter state
  const [selectedPlayerFilter, setSelectedPlayerFilter] = useState('all')



  useEffect(() => {
    if (slug) {
      checkAdminAccess()
    }
  }, [slug])

  const checkAdminAccess = async () => {
    try {
      // Check if user is authenticated and is admin
      const { data: { user } } = await supabase.auth.getUser()
      
      if (!user) {
        router.push(`/${slug}/auth`)
        return
      }

      setCurrentUserEmail(user.email || '')

      // Get league and verify admin access
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('*')
        .eq('slug', slug)
        .single()

      if (!leagueData) {
        router.push('/')
        return
      }

      const { data: adminData } = await supabase
        .from('league_admins')
        .select('id')
        .eq('league_id', leagueData.id)
        .eq('email', user.email)
        .single()

      if (!adminData) {
        router.push(`/${slug}`)
        return
      }

      setLeague(leagueData)
      await fetchData(leagueData.id)
      await fetchAdmins()
      await fetchRegistrationRequests()
      await fetchChatIntegration()
      await fetchTournaments()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push(`/${slug}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (leagueId: string) => {
    try {
      // Fetch all participants for the league
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('league_id', leagueId)
        .order('name')

      setParticipants(participantsData || [])

      // Fetch matches
      const { data: matchesData } = await supabase
        .from('matches')
        .select(`
          *,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        `)
        .eq('league_id', leagueId)
        .order('created_at', { ascending: false })

      if (matchesData) {
        setMatches(matchesData.map((m: any) => ({
          id: m.id,
          player1: m.player1,
          player2: m.player2,
          player1_score: m.player1_score,
          player2_score: m.player2_score,
          status: m.status,
          scheduled_at: m.scheduled_at
        })))
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    }
  }

  const fetchAdmins = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/admins`)
      if (response.ok) {
        const data = await response.json()
        setAdmins(data.admins)
      }
    } catch (error) {
      console.error('Error fetching admins:', error)
    }
  }


  const fetchRegistrationRequests = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/player-registration-requests`)
      if (response.ok) {
        const data = await response.json()
        setRegistrationRequests(data.requests)
      }
    } catch (error) {
      console.error('Error fetching registration requests:', error)
    }
  }

  const fetchChatIntegration = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/chat-integration`)
      if (response.ok) {
        const data = await response.json()
        setChatIntegration(data.integration)
        if (data.integration) {
          setChatConfig({
            webhook_url: data.integration.webhook_url,
            enabled: data.integration.enabled,
            notify_new_matches: data.integration.notify_new_matches,
            notify_approved_schedules: data.integration.notify_approved_schedules,
            notify_schedule_requests: data.integration.notify_schedule_requests !== false,
            notify_match_completions: data.integration.notify_match_completions,
            daily_summary_enabled: data.integration.daily_summary_enabled || false,
            daily_summary_time: data.integration.daily_summary_time || '09:00',
            summary_include_streaks: data.integration.summary_include_streaks !== false,
            summary_include_rankings: data.integration.summary_include_rankings !== false,
            summary_include_schedule: data.integration.summary_include_schedule !== false
          })
        }
      }
    } catch (error) {
      console.error('Error fetching chat integration:', error)
    }
  }

  const fetchTournaments = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments`)
      if (response.ok) {
        const data = await response.json()
        setTournaments(data.tournaments || [])
      }
    } catch (error) {
      console.error('Error fetching tournaments:', error)
    }
  }

  const fetchTournamentMatches = async (tournamentSlug: string) => {
    setLoadingTournamentMatches(true)
    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments/${tournamentSlug}/matches`)
      if (response.ok) {
        const data = await response.json()
        setTournamentMatches(data.matches || [])
      } else {
        console.error('Error fetching tournament matches')
        setTournamentMatches([])
      }
    } catch (error) {
      console.error('Error fetching tournament matches:', error)
      setTournamentMatches([])
    } finally {
      setLoadingTournamentMatches(false)
    }
  }



  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!league || !newParticipant.name.trim()) return

    try {
      const { error: participantError } = await supabase
        .from('participants')
        .insert({
          league_id: league.id,
          name: newParticipant.name.trim(),
          email: newParticipant.email.trim() || null
        })

      if (participantError) {
        alert('Error adding participant: ' + participantError.message)
        return
      }

      setNewParticipant({ name: '', email: '' })
      await fetchData(league.id)
    } catch (error) {
      console.error('Error adding participant:', error)
      alert('Failed to add participant')
    }
  }

  const handleEditParticipant = async (participantId: string) => {
    if (!league) return

    try {
      const { error } = await supabase
        .from('participants')
        .update({
          name: editParticipantData.name.trim(),
          email: editParticipantData.email.trim() || null
        })
        .eq('id', participantId)

      if (!error) {
        setEditingParticipant(null)
        await fetchData(league.id)
      } else {
        alert('Error updating participant: ' + error.message)
      }
    } catch (error) {
      console.error('Error updating participant:', error)
      alert('Failed to update participant')
    }
  }

  const handleDeleteParticipant = async (participantId: string) => {
    if (!league || !confirm('Are you sure you want to delete this participant?')) return

    try {
      const { error } = await supabase
        .from('participants')
        .delete()
        .eq('id', participantId)

      if (!error) {
        await fetchData(league.id)
      } else {
        alert('Error deleting participant: ' + error.message)
      }
    } catch (error) {
      console.error('Error deleting participant:', error)
      alert('Failed to delete participant')
    }
  }

  const handleDeleteMatch = async (matchId: string) => {
    if (!league) return

    // Find the match to show player names in confirmation
    const match = matches.find(m => m.id === matchId)
    if (!match) return

    const confirmMessage = `Are you sure you want to delete the match between ${match.player1.name} and ${match.player2.name}?`
    if (!confirm(confirmMessage)) return

    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId)

      if (!error) {
        await fetchData(league.id)
      } else {
        alert('Error deleting match: ' + error.message)
      }
    } catch (error) {
      console.error('Error deleting match:', error)
      alert('Failed to delete match')
    }
  }

  const handleAddMatch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!league || !newMatch.player1Id || !newMatch.player2Id || newMatch.player1Id === newMatch.player2Id) {
      alert('Please select two different players')
      return
    }

    try {
      let response, data

      if (newMatch.tournamentId) {
        // Create tournament match
        const tournament = tournaments.find(t => t.id === newMatch.tournamentId)
        if (!tournament) {
          alert('Tournament not found')
          return
        }

        response = await fetch(`/api/leagues/${slug}/tournaments/${tournament.slug}/matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player1_id: newMatch.player1Id,
            player2_id: newMatch.player2Id,
            scheduled_at: newMatch.scheduledAt || undefined
          })
        })
      } else {
        // Create regular league match
        response = await fetch(`/api/leagues/${slug}/matches`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            player1_id: newMatch.player1Id,
            player2_id: newMatch.player2Id,
            scheduled_at: newMatch.scheduledAt || undefined
          })
        })
      }

      data = await response.json()

      if (response.ok) {
        setNewMatch({ player1Id: '', player2Id: '', scheduledAt: '', tournamentId: '' })
        await fetchData(league.id)
        
        // Refresh tournament matches if we were viewing a specific tournament
        if (selectedTournamentForMatch && newMatch.tournamentId === selectedTournamentForMatch) {
          const tournament = tournaments.find(t => t.id === selectedTournamentForMatch)
          if (tournament) {
            await fetchTournamentMatches(tournament.slug)
          }
        }
        
        alert('Match created successfully!')
      } else {
        alert(data.error || 'Failed to create match')
      }
    } catch (error) {
      console.error('Error creating match:', error)
      alert('Failed to create match')
    }
  }

  const handleUpdateMatch = async (matchId: string, formData: {
    player1_score: string
    player2_score: string
    status: Match['status']
    scheduled_at: string
  }) => {
    if (!league) return

    try {
      const updateData: any = {
        status: formData.status,
        scheduled_at: formData.scheduled_at ? new Date(formData.scheduled_at).toISOString() : null
      }

      const completedAt = new Date().toISOString()
      const wasBeingCompleted = formData.status === 'completed'

      if (wasBeingCompleted) {
        if (!formData.player1_score || !formData.player2_score) {
          alert('Please enter scores for both players')
          return
        }
        updateData.player1_score = parseInt(formData.player1_score)
        updateData.player2_score = parseInt(formData.player2_score)
        updateData.completed_at = completedAt
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId)

      if (error) {
        alert('Error updating match: ' + error.message)
        return
      }

      // If match was just completed, handle rating updates and notifications
      if (wasBeingCompleted) {
        try {
          // Update player ratings using the rating updater
          const response = await fetch(`/api/leagues/${slug}/ratings/recalculate`, {
            method: 'PUT',
            headers: {
              'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
              'Content-Type': 'application/json'
            }
          })

          if (!response.ok) {
            console.error('Rating update failed after admin match completion')
          } else {
            console.log('Successfully updated ratings after admin match completion')
          }
        } catch (error) {
          console.error('Error updating ratings after admin match completion:', error)
          // Don't fail the match update if rating update fails
        }

        // Send Google Chat notification for match completion
        try {
          // Get match details with player names and league info
          const { data: matchDetails, error: matchDetailsError } = await supabase
            .from('matches')
            .select(`
              id,
              player1_score,
              player2_score,
              player1_id,
              player2_id,
              league_id,
              season_id
            `)
            .eq('id', matchId)
            .single()

          if (!matchDetailsError && matchDetails) {
            // Get player names
            const { data: playersData, error: playersError } = await supabase
              .from('participants')
              .select('id, name')
              .in('id', [matchDetails.player1_id, matchDetails.player2_id])

            // Get league info
            const { data: leagueData, error: leagueDataError } = await supabase
              .from('leagues')
              .select('id, name, slug')
              .eq('id', matchDetails.league_id)
              .single()

            // Get season info if exists
            let seasonData = null
            if (matchDetails.season_id) {
              const { data: seasonResult, error: seasonError } = await supabase
                .from('seasons')
                .select('id, name')
                .eq('id', matchDetails.season_id)
                .single()
              
              if (!seasonError) seasonData = seasonResult
            }

            // Get chat integration settings
            const { data: chatIntegration, error: chatError } = await supabase
              .from('league_chat_integrations')
              .select('webhook_url, enabled, notify_match_completions')
              .eq('league_id', league.id)
              .eq('enabled', true)
              .eq('notify_match_completions', true)
              .single()

            if (!playersError && playersData && !leagueDataError && leagueData && !chatError && chatIntegration) {
              // Map players by ID
              const playersMap = playersData.reduce((acc, player) => {
                acc[player.id] = player
                return acc
              }, {} as Record<string, { id: string; name: string }>)

              // Determine winner
              const player1Score = parseInt(formData.player1_score!)
              const player2Score = parseInt(formData.player2_score!)
              const player1Name = playersMap[matchDetails.player1_id]?.name || 'Player 1'
              const player2Name = playersMap[matchDetails.player2_id]?.name || 'Player 2'
              
              let winnerName = 'Draw'
              if (player1Score > player2Score) {
                winnerName = player1Name
              } else if (player2Score > player1Score) {
                winnerName = player2Name
              }

              const notificationData = {
                leagueName: leagueData.name,
                seasonName: seasonData?.name,
                player1Name: player1Name,
                player2Name: player2Name,
                player1Score: player1Score,
                player2Score: player2Score,
                winnerName: winnerName,
                completedAt: completedAt,
                leagueSlug: slug,
                appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
              }

              // Send notification via fetch to avoid importing GoogleChatNotifier in client component
              fetch(`/api/leagues/${slug}/chat-integration/notify-completion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(notificationData)
              }).catch(error => console.error('Failed to send match completion notification:', error))
            }
          }
        } catch (error) {
          console.error('Error sending Google Chat notification:', error)
          // Don't fail the match update if notification fails
        }
      }

      await fetchData(league.id)
    } catch (error) {
      console.error('Error updating match:', error)
      alert('Failed to update match')
    }
  }

  const startEditingParticipant = (participant: Participant) => {
    setEditingParticipant(participant.id)
    setEditParticipantData({
      name: participant.name,
      email: participant.email || ''
    })
  }

  const startEditingMatch = (match: Match) => {
    setEditingMatch(match)
    setIsModalOpen(true)
  }

  const closeModal = () => {
    setIsModalOpen(false)
    setEditingMatch(null)
  }

  // Auto draw functions
  const handlePreviewAutoDraw = async () => {
    if (!league) return

    if (participants.length < 2) {
      alert('At least 2 participants are required for auto draw')
      return
    }

    try {
      const queryParams = new URLSearchParams({
        clearExisting: autoDrawConfig.clearExisting.toString(),
        autoSchedule: autoDrawConfig.autoSchedule.toString(),
        ...(autoDrawConfig.autoSchedule && autoDrawConfig.startDate && {
          startDate: autoDrawConfig.startDate,
          startTime: autoDrawConfig.startTime,
          intervalDays: autoDrawConfig.intervalDays.toString(),
          daysOfWeek: autoDrawConfig.daysOfWeek.join(',')
        })
      })

      const response = await fetch(`/api/leagues/${slug}/auto-draw?${queryParams}`)
      const data = await response.json()

      if (response.ok) {
        setAutoDrawPreview(data)
        setShowPreview(true)
      } else {
        alert(data.error || 'Failed to generate preview')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      alert('Failed to generate preview')
    }
  }

  const handleGenerateAutoDraw = async () => {
    if (!league || !confirm('This will create all matches. Continue?')) return

    if (autoDrawConfig.clearExisting && !confirm('This will delete all existing matches. Are you sure?')) {
      return
    }

    setIsGeneratingDraw(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/auto-draw`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(autoDrawConfig)
      })

      const data = await response.json()

      if (response.ok) {
        alert(`Successfully created ${data.matchesCreated} matches!`)
        setShowAutoDraw(false)
        setShowPreview(false)
        setAutoDrawPreview(null)
        await fetchData(league.id)
      } else {
        alert(data.error || 'Failed to generate matches')
      }
    } catch (error) {
      console.error('Error generating matches:', error)
      alert('Failed to generate matches')
    } finally {
      setIsGeneratingDraw(false)
    }
  }

  const handleDayOfWeekToggle = (day: number) => {
    setAutoDrawConfig(prev => ({
      ...prev,
      daysOfWeek: prev.daysOfWeek.includes(day)
        ? prev.daysOfWeek.filter(d => d !== day)
        : [...prev.daysOfWeek, day].sort()
    }))
  }

  const formatPreviewDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDayName = (dayNumber: number) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return days[dayNumber]
  }

  // Get tournament participants for match creation
  const getTournamentParticipants = (tournamentId: string) => {
    const tournament = tournaments.find(t => t.id === tournamentId)
    if (!tournament || !tournamentParticipants || selectedTournament?.id !== tournamentId) {
      return []
    }
    return tournamentParticipants.tournament_participants.map(tp => tp.participant)
  }

  // Filter matches based on selected player and active tab
  const getFilteredMatches = () => {
    let matchesToFilter = matches
    
    // If viewing tournament matches, use tournament matches instead
    if (selectedTournamentForMatch) {
      matchesToFilter = tournamentMatches
    }
    
    let filtered = selectedPlayerFilter === 'all' 
      ? matchesToFilter 
      : matchesToFilter.filter(match => 
          match.player1.id === selectedPlayerFilter || 
          match.player2.id === selectedPlayerFilter
        )
    
    // Filter by tab status
    switch (activeMatchTab) {
      case 'scheduled':
        return filtered.filter(match => match.status === 'scheduled')
      case 'ongoing':
        return filtered.filter(match => match.status === 'in_progress')
      case 'completed':
        return filtered.filter(match => match.status === 'completed')
      default:
        return filtered
    }
  }

  const filteredMatches = getFilteredMatches()


  // Admin management functions
  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newAdminEmail.trim()) return

    setAddingAdmin(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/admins`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: newAdminEmail.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        setNewAdminEmail('')
        await fetchAdmins()
        alert('Administrator added successfully!')
      } else {
        alert(data.error || 'Failed to add administrator')
      }
    } catch (error) {
      console.error('Error adding admin:', error)
      alert('Failed to add administrator')
    } finally {
      setAddingAdmin(false)
    }
  }

  const handleRemoveAdmin = async (admin: Admin) => {
    if (!confirm(`Are you sure you want to remove ${admin.email} as an administrator?`)) {
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/admins?id=${admin.id}&email=${admin.email}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        await fetchAdmins()
        alert('Administrator removed successfully!')
      } else {
        alert(data.error || 'Failed to remove administrator')
      }
    } catch (error) {
      console.error('Error removing admin:', error)
      alert('Failed to remove administrator')
    }
  }

  // Registration request management functions
  const handleApproveRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/leagues/${slug}/player-registration-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'approve' })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchRegistrationRequests()
        await fetchData(league!.id) // Refresh participants list
        alert('Registration request approved successfully!')
      } else {
        alert(data.error || 'Failed to approve request')
      }
    } catch (error) {
      console.error('Error approving request:', error)
      alert('Failed to approve request')
    }
  }

  const handleRejectRequest = async (requestId: string) => {
    if (!confirm('Are you sure you want to reject this registration request?')) {
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/player-registration-requests/${requestId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchRegistrationRequests()
        alert('Registration request rejected')
      } else {
        alert(data.error || 'Failed to reject request')
      }
    } catch (error) {
      console.error('Error rejecting request:', error)
      alert('Failed to reject request')
    }
  }

  // Chat integration functions
  const handleSaveChatConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatConfig.webhook_url.trim()) {
      alert('Please enter a webhook URL')
      return
    }

    setSavingChatConfig(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/chat-integration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(chatConfig)
      })

      const data = await response.json()

      if (response.ok) {
        await fetchChatIntegration()
        alert('Chat integration settings saved successfully!')
      } else {
        alert(data.error || 'Failed to save chat integration settings')
      }
    } catch (error) {
      console.error('Error saving chat integration:', error)
      alert('Failed to save chat integration settings')
    } finally {
      setSavingChatConfig(false)
    }
  }

  const handleTestChat = async () => {
    setTestingChat(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/chat-integration/test`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        alert('✅ Test notification sent successfully! Check your Google Chat space.')
      } else {
        alert(data.error || 'Failed to send test notification')
      }
    } catch (error) {
      console.error('Error testing chat integration:', error)
      alert('Failed to send test notification')
    } finally {
      setTestingChat(false)
    }
  }

  const handleRemoveChatIntegration = async () => {
    if (!confirm('Are you sure you want to remove Google Chat integration? This will delete all configuration.')) {
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/chat-integration`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        await fetchChatIntegration()
        setChatConfig({
          webhook_url: '',
          enabled: true,
          notify_new_matches: true,
          notify_approved_schedules: true,
          notify_schedule_requests: true,
          notify_match_completions: true,
          daily_summary_enabled: false,
          daily_summary_time: '09:00',
          summary_include_streaks: true,
          summary_include_rankings: true,
          summary_include_schedule: true
        })
        alert('Chat integration removed successfully')
      } else {
        alert(data.error || 'Failed to remove chat integration')
      }
    } catch (error) {
      console.error('Error removing chat integration:', error)
      alert('Failed to remove chat integration')
    }
  }

  const handleSendDailySummary = async () => {
    setSendingDailySummary(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/chat-integration/daily-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          include_streaks: chatConfig.summary_include_streaks,
          include_rankings: chatConfig.summary_include_rankings,
          include_schedule: chatConfig.summary_include_schedule
        })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchChatIntegration()
        alert('✅ Daily summary sent successfully! Check your Google Chat space.')
      } else {
        alert(data.error || 'Failed to send daily summary')
      }
    } catch (error) {
      console.error('Error sending daily summary:', error)
      alert('Failed to send daily summary')
    } finally {
      setSendingDailySummary(false)
    }
  }

  const handlePreviewDailySummary = async () => {
    setPreviewingDailySummary(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/chat-integration/daily-summary/preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      const data = await response.json()

      if (response.ok) {
        setDailySummaryPreview(data.preview)
        setShowPreviewModal(true)
      } else {
        alert(data.error || 'Failed to generate preview')
      }
    } catch (error) {
      console.error('Error generating preview:', error)
      alert('Failed to generate preview')
    } finally {
      setPreviewingDailySummary(false)
    }
  }


  // Player rating recalculation function
  const handleRecalculateRatings = async () => {
    if (!league) return
    
    const completedMatches = matches.filter(m => m.status === 'completed').length
    
    if (completedMatches === 0) {
      alert('No completed matches found. Player ratings can only be calculated after matches are completed.')
      return
    }

    if (!confirm(`This will recalculate ratings for all players based on ${completedMatches} completed match(es). Continue?`)) {
      return
    }

    setRecalculatingRatings(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      if (!token) {
        alert('Authentication error. Please refresh the page and try again.')
        return
      }

      const response = await fetch(`/api/leagues/${slug}/ratings/recalculate`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      })

      const data = await response.json()

      if (response.ok) {
        alert(`✅ Ratings recalculated successfully!\n\n` +
              `• Updated players: ${data.updated_players}\n` +
              `• Matches processed: ${data.total_matches_processed}\n\n` +
              `Player ratings have been updated based on all completed matches.`)
      } else {
        alert(`❌ Failed to recalculate ratings:\n\n${data.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error recalculating ratings:', error)
      alert('❌ Failed to recalculate ratings. Please check your internet connection and try again.')
    } finally {
      setRecalculatingRatings(false)
    }
  }

  // Announcement function
  const handleSendAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!announcementText.trim()) {
      alert('Please enter an announcement text')
      return
    }

    setSendingAnnouncement(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/chat-integration/announcement`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ announcement: announcementText.trim() })
      })

      const data = await response.json()

      if (response.ok) {
        setAnnouncementText('')
        alert('✅ Announcement sent successfully! Check your Google Chat space.')
      } else {
        alert(data.error || 'Failed to send announcement')
      }
    } catch (error) {
      console.error('Error sending announcement:', error)
      alert('Failed to send announcement')
    } finally {
      setSendingAnnouncement(false)
    }
  }

  // Tournament management functions
  const handleAddTournament = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTournament.name.trim()) return

    setAddingTournament(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newTournament.name.trim(),
          description: newTournament.description.trim() || null,
          tournament_type: newTournament.tournament_type,
          start_date: newTournament.start_date || null,
          end_date: newTournament.end_date || null,
          max_participants: newTournament.max_participants ? parseInt(newTournament.max_participants) : null,
          auto_generate_matches: newTournament.auto_generate_matches
        })
      })

      const data = await response.json()

      if (response.ok) {
        setNewTournament({
          name: '',
          description: '',
          tournament_type: 'round_robin' as Tournament['tournament_type'],
          start_date: '',
          end_date: '',
          max_participants: '',
          auto_generate_matches: false
        })
        await fetchTournaments()
        alert('Tournament created successfully!')
      } else {
        alert(data.error || 'Failed to create tournament')
      }
    } catch (error) {
      console.error('Error creating tournament:', error)
      alert('Failed to create tournament')
    } finally {
      setAddingTournament(false)
    }
  }

  // Tournament participant management functions
  const fetchTournamentParticipants = async (tournament: Tournament) => {
    setLoadingParticipants(true)
    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments/${tournament.slug}/participants`)
      if (response.ok) {
        const data = await response.json()
        setTournamentParticipants(data)
      } else {
        console.error('Error fetching tournament participants')
        setTournamentParticipants(null)
      }
    } catch (error) {
      console.error('Error fetching tournament participants:', error)
      setTournamentParticipants(null)
    } finally {
      setLoadingParticipants(false)
    }
  }

  const handleSelectTournament = async (tournament: Tournament) => {
    setSelectedTournament(tournament)
    setSelectedParticipantsToAdd([])
    await fetchTournamentParticipants(tournament)
  }

  const handleAddParticipantsToTournament = async () => {
    if (!selectedTournament || selectedParticipantsToAdd.length === 0) return

    setAddingParticipants(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments/${selectedTournament.slug}/participants`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participant_ids: selectedParticipantsToAdd
        })
      })

      const data = await response.json()

      if (response.ok) {
        setSelectedParticipantsToAdd([])
        await fetchTournamentParticipants(selectedTournament)
        await fetchTournaments()
        alert(`Successfully added ${selectedParticipantsToAdd.length} participant(s) to the tournament!`)
      } else {
        alert(data.error || 'Failed to add participants to tournament')
      }
    } catch (error) {
      console.error('Error adding participants to tournament:', error)
      alert('Failed to add participants to tournament')
    } finally {
      setAddingParticipants(false)
    }
  }

  const handleRemoveParticipantFromTournament = async (participantId: string, participantName: string) => {
    if (!selectedTournament) return

    if (!confirm(`Are you sure you want to remove ${participantName} from this tournament?`)) {
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments/${selectedTournament.slug}/participants?participant_id=${participantId}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTournamentParticipants(selectedTournament)
        await fetchTournaments()
        alert(`${participantName} removed from tournament successfully!`)
      } else {
        alert(data.error || 'Failed to remove participant from tournament')
      }
    } catch (error) {
      console.error('Error removing participant from tournament:', error)
      alert('Failed to remove participant from tournament')
    }
  }

  const handleParticipantToggle = (participantId: string) => {
    setSelectedParticipantsToAdd(prev =>
      prev.includes(participantId)
        ? prev.filter(id => id !== participantId)
        : [...prev, participantId]
    )
  }

  const startEditingTournament = (tournament: Tournament) => {
    setEditingTournament(tournament.id)
    setEditTournamentData({
      name: tournament.name,
      description: tournament.description || '',
      status: tournament.status
    })
  }

  const handleEditTournament = async (tournamentId: string) => {
    if (!editTournamentData.name.trim()) return

    try {
      const tournament = tournaments.find(t => t.id === tournamentId)
      if (!tournament) {
        alert('Tournament not found')
        return
      }

      const response = await fetch(`/api/leagues/${slug}/tournaments/${tournament.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editTournamentData.name.trim(),
          description: editTournamentData.description.trim() || null,
          status: editTournamentData.status
        })
      })

      const data = await response.json()

      if (response.ok) {
        setEditingTournament(null)
        await fetchTournaments()
        alert('Tournament updated successfully!')
      } else {
        alert(data.error || 'Failed to update tournament')
      }
    } catch (error) {
      console.error('Error updating tournament:', error)
      alert('Failed to update tournament')
    }
  }

  const handleDeleteTournament = async (tournament: Tournament) => {
    if (!confirm(`Are you sure you want to delete the tournament "${tournament.name}"? This action cannot be undone.`)) {
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/tournaments/${tournament.slug}`, {
        method: 'DELETE'
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTournaments()
        alert('Tournament deleted successfully!')
      } else {
        alert(data.error || 'Failed to delete tournament')
      }
    } catch (error) {
      console.error('Error deleting tournament:', error)
      alert('Failed to delete tournament')
    }
  }

  // Tournament settings functions
  const handleOpenTournamentSettings = (tournament: Tournament) => {
    setSelectedTournamentForSettings(tournament)
    setIsSettingsModalOpen(true)
  }

  const handleCloseTournamentSettings = () => {
    setIsSettingsModalOpen(false)
    setSelectedTournamentForSettings(null)
  }

  const handleSaveTournamentSettings = async (tournamentId: string, settings: any) => {
    setSavingTournamentSettings(true)

    try {
      const tournament = tournaments.find(t => t.id === tournamentId)
      if (!tournament) {
        alert('Tournament not found')
        return
      }

      const response = await fetch(`/api/leagues/${slug}/tournaments/${tournament.slug}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            ...tournament.settings,
            rating_settings: settings
          }
        })
      })

      const data = await response.json()

      if (response.ok) {
        await fetchTournaments()
        handleCloseTournamentSettings()
        alert('Tournament rating settings saved successfully!')
      } else {
        alert(data.error || 'Failed to save tournament settings')
      }
    } catch (error) {
      console.error('Error saving tournament settings:', error)
      alert('Failed to save tournament settings')
    } finally {
      setSavingTournamentSettings(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading admin panel...</p>
        </div>
      </div>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href={`/${slug}`} className="flex items-center text-black hover:text-gray-600 mr-8">
                <ArrowLeft className="h-5 w-5 mr-2" />
                <Trophy className="h-8 w-8 mr-3" />
                <span className="text-xl font-bold">{league?.name} - Admin</span>
              </Link>
            </div>
            <Link href={`/${slug}`} className="btn-modern-small">
              View Public Page
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 nav-gradient">
          <nav className="flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide nav-scroll">
            <button
              onClick={() => setActiveTab('participants')}
              className={`flex-shrink-0 py-4 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'participants'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Participants</span>
              <span className="xs:hidden">People</span>
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`flex-shrink-0 py-4 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'matches'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-1 sm:mr-2" />
              Matches
            </button>
            <button
              onClick={() => setActiveTab('tournaments')}
              className={`flex-shrink-0 py-4 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'tournaments'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Trophy className="h-4 w-4 inline mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Tournaments</span>
              <span className="xs:hidden">Tourneys</span>
            </button>
            <button
              onClick={() => setActiveTab('registration-requests')}
              className={`flex-shrink-0 py-4 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'registration-requests'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserPlus className="h-4 w-4 inline mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Player Requests</span>
              <span className="xs:hidden">Requests</span>
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`flex-shrink-0 py-4 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'admins'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Shield className="h-4 w-4 inline mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Administrators</span>
              <span className="xs:hidden">Admins</span>
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex-shrink-0 py-4 px-1 sm:px-2 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === 'integrations'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="h-4 w-4 inline mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Integrations</span>
              <span className="xs:hidden">Settings</span>
            </button>
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        {activeTab === 'participants' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Manage Participants</h2>
              
              {/* Add Participant Form */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Add New Participant</h3>
                <form onSubmit={handleAddParticipant} className="flex gap-4">
                  <input
                    type="text"
                    placeholder="Participant name"
                    value={newParticipant.name}
                    onChange={(e) => setNewParticipant(prev => ({ ...prev, name: e.target.value }))}
                    className="input-field flex-1"
                    required
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={newParticipant.email}
                    onChange={(e) => setNewParticipant(prev => ({ ...prev, email: e.target.value }))}
                    className="input-field flex-1"
                  />
                  <button type="submit" className="btn-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Add
                  </button>
                </form>
              </div>

              {/* Participants List */}
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-black">Current Participants</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Name</th>
                        <th className="table-header">Email</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {participants.map((participant) => (
                        <tr key={participant.id}>
                          <td className="table-cell">
                            {editingParticipant === participant.id ? (
                              <input
                                type="text"
                                value={editParticipantData.name}
                                onChange={(e) => setEditParticipantData(prev => ({ ...prev, name: e.target.value }))}
                                className="input-field"
                              />
                            ) : (
                              participant.name
                            )}
                          </td>
                          <td className="table-cell">
                            {editingParticipant === participant.id ? (
                              <input
                                type="email"
                                value={editParticipantData.email}
                                onChange={(e) => setEditParticipantData(prev => ({ ...prev, email: e.target.value }))}
                                className="input-field"
                              />
                            ) : (
                              participant.email || '-'
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              {editingParticipant === participant.id ? (
                                <>
                                  <button
                                    onClick={() => handleEditParticipant(participant.id)}
                                    className="p-2 text-green-600 hover:text-green-800"
                                    title="Save changes"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingParticipant(null)}
                                    className="p-2 text-gray-600 hover:text-gray-800"
                                    title="Cancel editing"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditingParticipant(participant)}
                                    className="p-2 text-blue-600 hover:text-blue-800"
                                    title="Edit participant"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteParticipant(participant.id)}
                                    className="p-2 text-red-600 hover:text-red-800"
                                    title="Delete participant"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {participants.length === 0 && (
                        <tr>
                          <td colSpan={2} className="table-cell text-center text-gray-500">
                            No participants yet
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Rating Management Section */}
              <div className="card p-6">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-black mb-2">Player Ratings</h3>
                    <p className="text-sm text-gray-600 mb-4">
                      Player ratings are automatically updated when matches are completed. Use this button to manually recalculate all ratings if needed.
                    </p>
                    <div className="flex items-center gap-4 text-sm text-gray-500">
                      <span>• Completed matches: {matches.filter(m => m.status === 'completed').length}</span>
                      <span>• Active participants: {participants.length}</span>
                    </div>
                  </div>
                  <button
                    onClick={handleRecalculateRatings}
                    disabled={recalculatingRatings || matches.filter(m => m.status === 'completed').length === 0}
                    className="btn-primary"
                    title={matches.filter(m => m.status === 'completed').length === 0 ? 'No completed matches to calculate ratings from' : 'Recalculate all player ratings'}
                  >
                    {recalculatingRatings ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Recalculating...
                      </>
                    ) : (
                      <>
                        <Calculator className="h-4 w-4 mr-2" />
                        Recalculate Player Ratings
                      </>
                    )}
                  </button>
                </div>
                {matches.filter(m => m.status === 'completed').length === 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <p className="text-sm text-yellow-800">
                      <strong>Note:</strong> Player ratings can only be calculated after matches are completed. Complete some matches first to enable rating calculations.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'matches' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-black mb-2">Match Management</h2>
              <p className="text-gray-600 mb-8">Create, manage, and track all league matches from this central hub.</p>
              
              {/* Quick Stats */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black mb-1">{matches.length}</div>
                    <div className="text-sm text-gray-600">Total Matches</div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600 mb-1">
                      {matches.filter(m => m.status === 'completed').length}
                    </div>
                    <div className="text-sm text-gray-600">Completed</div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black mb-1">
                      {matches.filter(m => m.status === 'scheduled').length}
                    </div>
                    <div className="text-sm text-gray-600">Scheduled</div>
                  </div>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-6">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-black mb-1">
                      {matches.filter(m => m.status === 'in_progress').length}
                    </div>
                    <div className="text-sm text-gray-600">In Progress</div>
                  </div>
                </div>
              </div>

              {/* Action Panel */}
              <div className="bg-white border border-gray-200 rounded-xl p-6 mb-8">
                <h3 className="text-xl font-semibold text-black mb-6">Quick Actions</h3>
                
                {/* Tournament Selection */}
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-black mb-4">Tournament Match Management</h4>
                  <div className="flex flex-col sm:flex-row gap-4 items-end">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-2">Select Tournament (Optional)</label>
                      <select
                        value={selectedTournamentForMatch}
                        onChange={(e) => {
                          setSelectedTournamentForMatch(e.target.value)
                          if (e.target.value) {
                            const tournament = tournaments.find(t => t.id === e.target.value)
                            if (tournament) {
                              fetchTournamentMatches(tournament.slug)
                            }
                          } else {
                            setTournamentMatches([])
                          }
                        }}
                        className="input-field"
                      >
                        <option value="">View all league matches</option>
                        {tournaments.map(tournament => (
                          <option key={tournament.id} value={tournament.id}>
                            {tournament.name} ({tournament.tournament_type.replace('_', ' ')})
                          </option>
                        ))}
                      </select>
                    </div>
                    {selectedTournamentForMatch && (
                      <div className="text-sm text-gray-600">
                        {loadingTournamentMatches ? (
                          <span className="flex items-center">
                            <Clock className="h-4 w-4 mr-1 animate-spin" />
                            Loading...
                          </span>
                        ) : (
                          <span>{tournamentMatches.length} tournament matches</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Add Match Form */}
                <div className="mb-6">
                  <h4 className="text-lg font-medium text-black mb-4">
                    {selectedTournamentForMatch ? 'Schedule Tournament Match' : 'Schedule New Match'}
                  </h4>
                  <form onSubmit={handleAddMatch} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
                      {selectedTournamentForMatch && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Tournament</label>
                          <select
                            value={newMatch.tournamentId}
                            onChange={(e) => {
                              setNewMatch(prev => ({ ...prev, tournamentId: e.target.value }))
                              // Reset player selections when tournament changes
                              setNewMatch(prev => ({ 
                                ...prev, 
                                tournamentId: e.target.value,
                                player1Id: '',
                                player2Id: ''
                              }))
                            }}
                            className="input-field"
                          >
                            <option value="">Regular League Match</option>
                            {tournaments.map(tournament => (
                              <option key={tournament.id} value={tournament.id}>
                                {tournament.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Player 1</label>
                        <select
                          value={newMatch.player1Id}
                          onChange={(e) => setNewMatch(prev => ({ ...prev, player1Id: e.target.value }))}
                          className="input-field"
                          required
                        >
                          <option value="">Select Player 1</option>
                          {(newMatch.tournamentId ? getTournamentParticipants(newMatch.tournamentId) : participants).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Player 2</label>
                        <select
                          value={newMatch.player2Id}
                          onChange={(e) => setNewMatch(prev => ({ ...prev, player2Id: e.target.value }))}
                          className="input-field"
                          required
                        >
                          <option value="">Select Player 2</option>
                          {(newMatch.tournamentId ? getTournamentParticipants(newMatch.tournamentId) : participants).map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule Date</label>
                        <input
                          type="datetime-local"
                          value={newMatch.scheduledAt}
                          onChange={(e) => setNewMatch(prev => ({ ...prev, scheduledAt: e.target.value }))}
                          className="input-field"
                        />
                      </div>
                      <div className="flex items-end">
                        <button type="submit" className="btn-primary w-full">
                          <Plus className="h-4 w-4 mr-2" />
                          {newMatch.tournamentId ? 'Schedule Tournament Match' : 'Schedule Match'}
                        </button>
                      </div>
                    </div>
                    {newMatch.tournamentId && getTournamentParticipants(newMatch.tournamentId).length === 0 && (
                      <div className="text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded p-3">
                        <strong>Note:</strong> No participants found for selected tournament. Please add participants to the tournament first.
                      </div>
                    )}
                  </form>
                </div>
              </div>

              {/* Matches List */}
              <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                    <div>
                      <h3 className="text-xl font-semibold text-black">
                        {selectedTournamentForMatch ? 
                          `${tournaments.find(t => t.id === selectedTournamentForMatch)?.name} Matches` : 
                          'Match Overview'
                        }
                      </h3>
                      {selectedTournamentForMatch && (
                        <p className="text-sm text-gray-600">
                          Tournament matches only • {tournaments.find(t => t.id === selectedTournamentForMatch)?.tournament_type.replace('_', ' ')}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                      {/* Player Filter */}
                      <div className="flex items-center gap-3">
                        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
                          Filter by player:
                        </label>
                        <select
                          value={selectedPlayerFilter}
                          onChange={(e) => setSelectedPlayerFilter(e.target.value)}
                          className="input-field min-w-[150px]"
                        >
                          <option value="all">All Players</option>
                          {(selectedTournamentForMatch && tournamentParticipants && selectedTournament?.id === selectedTournamentForMatch ? 
                            tournamentParticipants.tournament_participants.map(tp => tp.participant) : 
                            participants
                          ).map(participant => (
                            <option key={participant.id} value={participant.id}>
                              {participant.name}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="text-sm text-gray-500 whitespace-nowrap">
                        Showing {filteredMatches.length} of {selectedTournamentForMatch ? tournamentMatches.length : matches.length} matches
                      </span>
                    </div>
                  </div>
                  
                  {/* Match Tabs */}
                  <div className="border-b border-gray-200">
                    <nav className="flex space-x-8">
                      <button
                        onClick={() => setActiveMatchTab('scheduled')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm ${
                          activeMatchTab === 'scheduled'
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Scheduled ({(selectedTournamentForMatch ? tournamentMatches : matches).filter(m => m.status === 'scheduled').length})
                      </button>
                      <button
                        onClick={() => setActiveMatchTab('ongoing')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm ${
                          activeMatchTab === 'ongoing'
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Ongoing ({(selectedTournamentForMatch ? tournamentMatches : matches).filter(m => m.status === 'in_progress').length})
                      </button>
                      <button
                        onClick={() => setActiveMatchTab('completed')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm ${
                          activeMatchTab === 'completed'
                            ? 'border-green-500 text-green-600'
                            : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                        }`}
                      >
                        Completed ({(selectedTournamentForMatch ? tournamentMatches : matches).filter(m => m.status === 'completed').length})
                      </button>
                    </nav>
                  </div>
                </div>
                
                {/* Mobile Card Layout */}
                <div className="block lg:hidden">
                  {filteredMatches.length === 0 ? (
                    <div className="p-8 text-center">
                      <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-2">No matches found</p>
                            <p className="text-gray-500">
                            {(selectedTournamentForMatch ? tournamentMatches.length : matches.length) === 0 ? 
                              (selectedTournamentForMatch ? "No matches in this tournament yet." : "Create your first match above to get started.") :
                              `No ${activeMatchTab} matches found.`
                            }
                            </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredMatches.map((match) => (
                        <div key={match.id} className="p-4">
                          <div className="space-y-3">
                            {/* Players */}
                            <div className="flex justify-between items-center">
                              <h4 className="font-semibold text-black">
                                {match.player1.name} vs {match.player2.name}
                              </h4>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => startEditingMatch(match)}
                                  className="p-2 text-gray-600 hover:text-black"
                                >
                                  <Edit className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteMatch(match.id)}
                                  className="p-2 text-gray-600 hover:text-black"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              </div>
                            </div>
                            
                            {/* Status & Score */}
                            <div className="flex justify-between items-center">
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                match.status === 'completed' ? 'bg-green-100 text-green-800' :
                                match.status === 'in_progress' ? 'bg-gray-100 text-gray-800' :
                                match.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 
                                'bg-gray-100 text-gray-800'
                              }`}>
                                {match.status.replace('_', ' ')}
                              </span>
                              <span className="font-mono text-lg">
                                {match.status === 'completed' 
                                  ? `${match.player1_score} - ${match.player2_score}`
                                  : '-'
                                }
                              </span>
                            </div>
                            
                            {/* Date */}
                            {match.scheduled_at && (
                              <p className="text-sm text-gray-600">
                                Scheduled: {formatDate(match.scheduled_at)}
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Desktop Table Layout */}
                <div className="hidden lg:block overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Players</th>
                        <th className="table-header">Score</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Scheduled</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredMatches.map((match) => (
                        <tr key={match.id}>
                          <td className="table-cell">
                            <span className="font-medium">{match.player1.name} vs {match.player2.name}</span>
                          </td>
                          <td className="table-cell">
                            <span className="font-mono">
                              {match.status === 'completed' 
                                ? `${match.player1_score} - ${match.player2_score}`
                                : '-'
                              }
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              match.status === 'completed' ? 'bg-green-100 text-green-800' :
                              match.status === 'in_progress' ? 'bg-gray-100 text-gray-800' :
                              match.status === 'cancelled' ? 'bg-gray-100 text-gray-800' : 
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {match.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="table-cell">
                            <span className="text-sm">
                              {match.scheduled_at ? formatDate(match.scheduled_at) : 'Not scheduled'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              <button
                                onClick={() => startEditingMatch(match)}
                                className="p-2 text-gray-600 hover:text-black"
                                title="Edit match"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => handleDeleteMatch(match.id)}
                                className="p-2 text-gray-600 hover:text-black"
                                title="Delete match"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                      {filteredMatches.length === 0 && (
                        <tr>
                          <td colSpan={5} className="table-cell text-center text-gray-500 py-8">
                            <Calendar className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-2">No matches found</p>
                            <p className="text-gray-500">
                              {(selectedTournamentForMatch ? tournamentMatches.length : matches.length) === 0 ? 
                                (selectedTournamentForMatch ? "No matches in this tournament yet." : "Create your first match above to get started.") :
                                `No ${activeMatchTab} matches found.`
                              }
                            </p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}


        {activeTab === 'tournaments' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Tournament Management</h2>
              
              {/* Add Tournament Form */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Create New Tournament</h3>
                <form onSubmit={handleAddTournament} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tournament Name</label>
                      <input
                        type="text"
                        placeholder="Tournament name"
                        value={newTournament.name}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, name: e.target.value }))}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tournament Type</label>
                      <select
                        value={newTournament.tournament_type}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, tournament_type: e.target.value as Tournament['tournament_type'] }))}
                        className="input-field"
                        required
                      >
                        <option value="round_robin">Round Robin</option>
                        <option value="table_system">Table System</option>
                        <option value="exhibition">Exhibition</option>
                        <option value="single_elimination">Single Elimination</option>
                        <option value="double_elimination">Double Elimination</option>
                      </select>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                    <textarea
                      placeholder="Tournament description (optional)"
                      value={newTournament.description}
                      onChange={(e) => setNewTournament(prev => ({ ...prev, description: e.target.value }))}
                      className="input-field"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
                      <input
                        type="datetime-local"
                        value={newTournament.start_date}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, start_date: e.target.value }))}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                      <input
                        type="datetime-local"
                        value={newTournament.end_date}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, end_date: e.target.value }))}
                        className="input-field"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Max Participants</label>
                      <input
                        type="number"
                        placeholder="Leave empty for unlimited"
                        value={newTournament.max_participants}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, max_participants: e.target.value }))}
                        className="input-field"
                        min="2"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newTournament.auto_generate_matches}
                        onChange={(e) => setNewTournament(prev => ({ ...prev, auto_generate_matches: e.target.checked }))}
                        className="mr-2"
                      />
                      Auto-generate matches when tournament starts
                    </label>
                  </div>

                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={addingTournament}
                  >
                    {addingTournament ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Creating...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Create Tournament
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Tournaments List */}
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-black">All Tournaments</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Name</th>
                        <th className="table-header">Type</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Participants</th>
                        <th className="table-header">Start Date</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tournaments.map((tournament) => (
                        <tr key={tournament.id}>
                          <td className="table-cell">
                            {editingTournament === tournament.id ? (
                              <input
                                type="text"
                                value={editTournamentData.name}
                                onChange={(e) => setEditTournamentData(prev => ({ ...prev, name: e.target.value }))}
                                className="input-field"
                              />
                            ) : (
                              <div>
                                <div className="font-medium">{tournament.name}</div>
                                {tournament.description && (
                                  <div className="text-sm text-gray-500">{tournament.description}</div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="table-cell">
                            <span className="capitalize">{tournament.tournament_type.replace('_', ' ')}</span>
                          </td>
                          <td className="table-cell">
                            {editingTournament === tournament.id ? (
                              <select
                                value={editTournamentData.status}
                                onChange={(e) => setEditTournamentData(prev => ({ ...prev, status: e.target.value as Tournament['status'] }))}
                                className="input-field"
                              >
                                <option value="upcoming">Upcoming</option>
                                <option value="active">Active</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            ) : (
                              <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                                tournament.status === 'active' ? 'bg-green-100 text-green-800' :
                                tournament.status === 'completed' ? 'bg-blue-100 text-blue-800' :
                                tournament.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                                'bg-yellow-100 text-yellow-800'
                              }`}>
                                {tournament.status.charAt(0).toUpperCase() + tournament.status.slice(1)}
                              </span>
                            )}
                          </td>
                          <td className="table-cell">
                            <button
                              onClick={() => handleSelectTournament(tournament)}
                              className="text-sm text-blue-600 hover:text-blue-800 hover:underline"
                            >
                              {tournament.participant_count || 0}
                              {tournament.max_participants && ` / ${tournament.max_participants}`} participants
                            </button>
                          </td>
                          <td className="table-cell">
                            <span className="text-sm">
                              {tournament.start_date ? formatDate(tournament.start_date) : 'Not set'}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              {editingTournament === tournament.id ? (
                                <>
                                  <button
                                    onClick={() => handleEditTournament(tournament.id)}
                                    className="p-2 text-green-600 hover:text-green-800"
                                    title="Save changes"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingTournament(null)}
                                    className="p-2 text-gray-600 hover:text-gray-800"
                                    title="Cancel editing"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleSelectTournament(tournament)}
                                    className="p-2 text-purple-600 hover:text-purple-800"
                                    title="Manage participants"
                                  >
                                    <Users className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleOpenTournamentSettings(tournament)}
                                    className="p-2 text-green-600 hover:text-green-800"
                                    title="Rating settings"
                                  >
                                    <Calculator className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => startEditingTournament(tournament)}
                                    className="p-2 text-blue-600 hover:text-blue-800"
                                    title="Edit tournament"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteTournament(tournament)}
                                    className="p-2 text-red-600 hover:text-red-800"
                                    title="Delete tournament"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {tournaments.length === 0 && (
                        <tr>
                          <td colSpan={6} className="table-cell text-center text-gray-500 py-8">
                            <Trophy className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <p className="text-lg font-medium text-gray-900 mb-2">No tournaments yet</p>
                            <p className="text-gray-500">Create your first tournament above to get started.</p>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Tournament Participant Management */}
              {selectedTournament && (
                <div className="card p-6">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-semibold text-black">
                      {selectedTournament.name} - Participant Management
                    </h3>
                    <button
                      onClick={() => {
                        setSelectedTournament(null)
                        setTournamentParticipants(null)
                        setSelectedParticipantsToAdd([])
                      }}
                      className="btn-secondary"
                    >
                      <X className="h-4 w-4 mr-2" />
                      Close
                    </button>
                  </div>

                  {loadingParticipants ? (
                    <div className="text-center py-8">
                      <div className="spinner mx-auto mb-4"></div>
                      <p className="text-gray-600">Loading participants...</p>
                    </div>
                  ) : tournamentParticipants ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                      {/* Current Participants */}
                      <div>
                        <div className="flex justify-between items-center mb-4">
                          <h4 className="text-md font-medium text-black">
                            Current Participants ({tournamentParticipants.current_count}
                            {tournamentParticipants.max_participants && ` / ${tournamentParticipants.max_participants}`})
                          </h4>
                          {tournamentParticipants.max_participants && 
                           tournamentParticipants.current_count >= tournamentParticipants.max_participants && (
                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                              Full
                            </span>
                          )}
                        </div>
                        
                        <div className="border border-gray-200 rounded-lg">
                          {tournamentParticipants.tournament_participants.length === 0 ? (
                            <div className="p-6 text-center text-gray-500">
                              <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                              <p>No participants yet</p>
                            </div>
                          ) : (
                            <div className="divide-y divide-gray-200">
                              {tournamentParticipants.tournament_participants.map((tp) => (
                                <div key={tp.id} className="p-4 flex justify-between items-center">
                                  <div>
                                    <div className="font-medium">{tp.participant.name}</div>
                                    <div className="text-sm text-gray-500">
                                      Joined {formatDate(tp.joined_at)}
                                      {tp.seed_position && ` • Seed #${tp.seed_position}`}
                                    </div>
                                  </div>
                                  <button
                                    onClick={() => handleRemoveParticipantFromTournament(tp.participant.id, tp.participant.name)}
                                    className="p-2 text-red-600 hover:text-red-800"
                                    title="Remove from tournament"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Available Participants */}
                      <div>
                        <h4 className="text-md font-medium text-black mb-4">
                          Available Participants ({tournamentParticipants.available_participants.length})
                        </h4>
                        
                        {tournamentParticipants.available_participants.length === 0 ? (
                          <div className="border border-gray-200 rounded-lg p-6 text-center text-gray-500">
                            <Users className="h-8 w-8 mx-auto text-gray-300 mb-2" />
                            <p>All league participants are already in this tournament</p>
                          </div>
                        ) : (
                          <>
                            <div className="border border-gray-200 rounded-lg max-h-64 overflow-y-auto">
                              <div className="divide-y divide-gray-200">
                                {tournamentParticipants.available_participants.map((participant) => (
                                  <div key={participant.id} className="p-4">
                                    <label className="flex items-center space-x-3">
                                      <input
                                        type="checkbox"
                                        checked={selectedParticipantsToAdd.includes(participant.id)}
                                        onChange={() => handleParticipantToggle(participant.id)}
                                        className="rounded border-gray-300 text-black focus:ring-black"
                                        disabled={Boolean(
                                          tournamentParticipants.max_participants &&
                                          tournamentParticipants.current_count + selectedParticipantsToAdd.length >= tournamentParticipants.max_participants &&
                                          !selectedParticipantsToAdd.includes(participant.id)
                                        )}
                                      />
                                      <div>
                                        <div className="font-medium">{participant.name}</div>
                                        {participant.email && (
                                          <div className="text-sm text-gray-500">{participant.email}</div>
                                        )}
                                      </div>
                                    </label>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {selectedParticipantsToAdd.length > 0 && (
                              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <span className="text-sm text-blue-800">
                                    {selectedParticipantsToAdd.length} participant(s) selected
                                  </span>
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => setSelectedParticipantsToAdd([])}
                                      className="text-sm text-blue-600 hover:text-blue-800"
                                    >
                                      Clear
                                    </button>
                                    <button
                                      onClick={handleAddParticipantsToTournament}
                                      disabled={addingParticipants}
                                      className="btn-primary btn-sm"
                                    >
                                      {addingParticipants ? (
                                        <>
                                          <Clock className="h-3 w-3 mr-1 animate-spin" />
                                          Adding...
                                        </>
                                      ) : (
                                        <>
                                          <Plus className="h-3 w-3 mr-1" />
                                          Add to Tournament
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <p>Failed to load tournament participants. Please try again.</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'registration-requests' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Player Registration Requests</h2>
              
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-black">Pending Requests</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Player</th>
                        <th className="table-header">Requester Email</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Requested Date</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrationRequests.map((request) => (
                        <tr key={request.id}>
                          <td className="table-cell">
                            <div className="font-medium">{request.player.name}</div>
                          </td>
                          <td className="table-cell">
                            {request.claimer_email}
                          </td>
                          <td className="table-cell">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              request.status === 'approved' ? 'bg-green-100 text-green-800' :
                              request.status === 'rejected' ? 'bg-red-100 text-red-800' :
                              'bg-yellow-100 text-yellow-800'
                            }`}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </td>
                          <td className="table-cell">
                            {formatDate(request.requested_at)}
                          </td>
                          <td className="table-cell">
                            {request.status === 'pending' && (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveRequest(request.id)}
                                  className="p-2 text-green-600 hover:text-green-800"
                                  title="Approve request"
                                >
                                  <CheckCircle className="h-4 w-4" />
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(request.id)}
                                  className="p-2 text-red-600 hover:text-red-800"
                                  title="Reject request"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                            {request.status !== 'pending' && (
                              <span className="text-gray-500 text-sm">
                                {request.status === 'approved' ? 'Approved' : 'Rejected'}
                                {request.reviewed_at && ` on ${formatDate(request.reviewed_at)}`}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {registrationRequests.length === 0 && (
                        <tr>
                          <td colSpan={5} className="table-cell text-center text-gray-500">
                            No registration requests found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'admins' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Administrator Management</h2>
              
              {/* Add Admin Form */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Add New Administrator</h3>
                <form onSubmit={handleAddAdmin} className="flex gap-4">
                  <input
                    type="email"
                    placeholder="Administrator email"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="input-field flex-1"
                    required
                  />
                  <button 
                    type="submit" 
                    className="btn-primary"
                    disabled={addingAdmin}
                  >
                    {addingAdmin ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Adding...
                      </>
                    ) : (
                      <>
                        <Plus className="h-4 w-4 mr-2" />
                        Add Admin
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Admins List */}
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-black">Current Administrators</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Email</th>
                        <th className="table-header">Added Date</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin) => (
                        <tr key={admin.id}>
                          <td className="table-cell">
                            <div className="flex items-center gap-2">
                              <span>{admin.email}</span>
                              {admin.email === currentUserEmail && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            {formatDate(admin.created_at)}
                          </td>
                          <td className="table-cell">
                            {admin.email !== currentUserEmail && (
                              <button
                                onClick={() => handleRemoveAdmin(admin)}
                                className="p-2 text-red-600 hover:text-red-800"
                                title="Remove administrator"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                      {admins.length === 0 && (
                        <tr>
                          <td colSpan={3} className="table-cell text-center text-gray-500">
                            No administrators found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Integrations</h2>
              
              {/* Google Chat Integration */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4 flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2" />
                  Google Chat Integration
                </h3>
                
                {chatIntegration ? (
                  <div className="space-y-6">
                    {/* Configuration Form */}
                    <form onSubmit={handleSaveChatConfig} className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Webhook URL
                        </label>
                        <input
                          type="url"
                          placeholder="https://chat.googleapis.com/v1/spaces/..."
                          value={chatConfig.webhook_url}
                          onChange={(e) => setChatConfig(prev => ({ ...prev, webhook_url: e.target.value }))}
                          className="input-field"
                          required
                        />
                      </div>

                      {/* Notification Settings */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Notification Settings
                        </label>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={chatConfig.enabled}
                              onChange={(e) => setChatConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                              className="mr-2"
                            />
                            Enable integration
                          </label>
                          
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={chatConfig.notify_new_matches}
                              onChange={(e) => setChatConfig(prev => ({ ...prev, notify_new_matches: e.target.checked }))}
                              className="mr-2"
                            />
                            Notify on new matches
                          </label>
                          
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={chatConfig.notify_approved_schedules}
                              onChange={(e) => setChatConfig(prev => ({ ...prev, notify_approved_schedules: e.target.checked }))}
                              className="mr-2"
                            />
                            Notify on approved schedules
                          </label>
                          
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={chatConfig.notify_schedule_requests}
                              onChange={(e) => setChatConfig(prev => ({ ...prev, notify_schedule_requests: e.target.checked }))}
                              className="mr-2"
                            />
                            Notify on schedule requests
                          </label>
                          
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={chatConfig.notify_match_completions}
                              onChange={(e) => setChatConfig(prev => ({ ...prev, notify_match_completions: e.target.checked }))}
                              className="mr-2"
                            />
                            Notify on match completions
                          </label>
                        </div>
                      </div>

                      {/* Daily Summary Settings */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          Daily Summary
                        </label>
                        <div className="space-y-3">
                          <label className="flex items-center">
                            <input
                              type="checkbox"
                              checked={chatConfig.daily_summary_enabled}
                              onChange={(e) => setChatConfig(prev => ({ ...prev, daily_summary_enabled: e.target.checked }))}
                              className="mr-2"
                            />
                            Enable daily summary
                          </label>
                          
                          {chatConfig.daily_summary_enabled && (
                            <div className="ml-6 space-y-3">
                              <div>
                                <label className="block text-sm text-gray-600 mb-1">
                                  Summary Time
                                </label>
                                <input
                                  type="time"
                                  value={chatConfig.daily_summary_time}
                                  onChange={(e) => setChatConfig(prev => ({ ...prev, daily_summary_time: e.target.value }))}
                                  className="input-field w-32"
                                />
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={chatConfig.summary_include_streaks}
                                    onChange={(e) => setChatConfig(prev => ({ ...prev, summary_include_streaks: e.target.checked }))}
                                    className="mr-2"
                                  />
                                  Include streaks
                                </label>
                                
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={chatConfig.summary_include_rankings}
                                    onChange={(e) => setChatConfig(prev => ({ ...prev, summary_include_rankings: e.target.checked }))}
                                    className="mr-2"
                                  />
                                  Include rankings
                                </label>
                                
                                <label className="flex items-center">
                                  <input
                                    type="checkbox"
                                    checked={chatConfig.summary_include_schedule}
                                    onChange={(e) => setChatConfig(prev => ({ ...prev, summary_include_schedule: e.target.checked }))}
                                    className="mr-2"
                                  />
                                  Include schedule
                                </label>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          type="submit" 
                          className="btn-primary"
                          disabled={savingChatConfig}
                        >
                          {savingChatConfig ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Save Settings
                            </>
                          )}
                        </button>
                        
                        <button 
                          type="button"
                          onClick={handleTestChat}
                          disabled={testingChat}
                          className="btn-secondary"
                        >
                          {testingChat ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            'Test Integration'
                          )}
                        </button>
                        
                        <button 
                          type="button"
                          onClick={handleRemoveChatIntegration}
                          className="btn-danger"
                        >
                          Remove Integration
                        </button>
                      </div>
                    </form>

                    {/* Quick Actions */}
                    <div className="border-t pt-6">
                      <h4 className="text-md font-medium text-black mb-4">Quick Actions</h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Send Daily Summary */}
                        <div className="space-y-3">
                          <button 
                            onClick={handleSendDailySummary}
                            disabled={sendingDailySummary}
                            className="btn-secondary w-full"
                          >
                            {sendingDailySummary ? (
                              <>
                                <Clock className="h-4 w-4 mr-2 animate-spin" />
                                Sending...
                              </>
                            ) : (
                              'Send Daily Summary Now'
                            )}
                          </button>
                          
                          <button 
                            onClick={handlePreviewDailySummary}
                            disabled={previewingDailySummary}
                            className="btn-secondary w-full"
                          >
                            {previewingDailySummary ? (
                              <>
                                <Clock className="h-4 w-4 mr-2 animate-spin" />
                                Generating...
                              </>
                            ) : (
                              <>
                                <Eye className="h-4 w-4 mr-2" />
                                Preview Daily Summary
                              </>
                            )}
                          </button>
                        </div>

                        {/* Send Announcement */}
                        <div className="space-y-3">
                          <form onSubmit={handleSendAnnouncement}>
                            <textarea
                              placeholder="Type your announcement..."
                              value={announcementText}
                              onChange={(e) => setAnnouncementText(e.target.value)}
                              className="input-field mb-3"
                              rows={3}
                              required
                            />
                            <button 
                              type="submit"
                              disabled={sendingAnnouncement}
                              className="btn-primary w-full"
                            >
                              {sendingAnnouncement ? (
                                <>
                                  <Clock className="h-4 w-4 mr-2 animate-spin" />
                                  Sending...
                                </>
                              ) : (
                                'Send Announcement'
                              )}
                            </button>
                          </form>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                    <h4 className="text-lg font-medium text-gray-900 mb-2">No Google Chat Integration</h4>
                    <p className="text-gray-500 mb-6">
                      Connect your league to Google Chat to receive notifications about matches, schedules, and more.
                    </p>
                    <form onSubmit={handleSaveChatConfig} className="max-w-md mx-auto">
                      <input
                        type="url"
                        placeholder="https://chat.googleapis.com/v1/spaces/..."
                        value={chatConfig.webhook_url}
                        onChange={(e) => setChatConfig(prev => ({ ...prev, webhook_url: e.target.value }))}
                        className="input-field mb-4"
                        required
                      />
                      <button 
                        type="submit" 
                        className="btn-primary w-full"
                        disabled={savingChatConfig}
                      >
                        {savingChatConfig ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Setting up...
                          </>
                        ) : (
                          'Set up Google Chat Integration'
                        )}
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Daily Summary Preview Modal */}
        {showPreviewModal && dailySummaryPreview && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
              <div className="flex justify-between items-center p-6 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-black">Daily Summary Preview</h3>
                <button 
                  onClick={() => setShowPreviewModal(false)}
                  className="p-2 text-gray-600 hover:text-black"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-6 overflow-y-auto">
                <div className="bg-gray-50 p-4 rounded-lg whitespace-pre-wrap font-mono text-sm">
                  {dailySummaryPreview.message || 'No preview available'}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Match Edit Modal */}
      <MatchEditModal
        match={editingMatch}
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleUpdateMatch}
      />

      {/* Tournament Settings Modal */}
      <TournamentSettingsModal
        tournament={selectedTournamentForSettings}
        isOpen={isSettingsModalOpen}
        onClose={handleCloseTournamentSettings}
        onSave={handleSaveTournamentSettings}
        loading={savingTournamentSettings}
      />
    </div>
  )
}

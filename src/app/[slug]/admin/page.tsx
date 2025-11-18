'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ArrowLeft, Users, Calendar, Plus, Edit, Trash2, Save, X, Shuffle, Eye, Clock, Shield, CheckCircle, XCircle, MessageSquare, UserPlus, Settings, Calculator } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'

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
  in_current_season?: boolean
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

interface Season {
  id: string
  name: string
  slug: string
  description: string | null
  is_active: boolean
  is_finished: boolean
  start_date: string | null
  end_date: string | null
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



export default function AdminPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [league, setLeague] = useState<League | null>(null)
  const [participants, setParticipants] = useState<Participant[]>([])
  const [matches, setMatches] = useState<Match[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [seasons, setSeasons] = useState<Season[]>([])
  const [activeSeason, setActiveSeason] = useState<Season | null>(null)
  const [registrationRequests, setRegistrationRequests] = useState<RegistrationRequest[]>([])
  const [chatIntegration, setChatIntegration] = useState<ChatIntegration | null>(null)
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
  
  // Season forms state
  const [newSeason, setNewSeason] = useState({
    name: '',
    description: '',
    startDate: '',
    makeActive: false,
    convertExisting: false
  })
  const [addingSeason, setAddingSeason] = useState(false)
  
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
  
  const [newMatch, setNewMatch] = useState({
    player1Id: '',
    player2Id: '',
    scheduledAt: ''
  })
  
  const [editingMatch, setEditingMatch] = useState<string | null>(null)
  const [editMatchData, setEditMatchData] = useState({
    player1_score: '',
    player2_score: '',
    status: 'scheduled' as Match['status'],
    scheduled_at: ''
  })

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
      await fetchSeasons()
      await fetchRegistrationRequests()
      await fetchChatIntegration()
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push(`/${slug}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (leagueId: string) => {
    try {
      // Get active season
      const { data: activeSeasonData } = await supabase
        .from('seasons')
        .select('id')
        .eq('league_id', leagueId)
        .eq('is_active', true)
        .single()

      // Fetch all participants for the league
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('league_id', leagueId)
        .order('name')

      if (participantsData && activeSeasonData) {
        // Get participants in current season
        const { data: seasonParticipants } = await supabase
          .from('season_participants')
          .select('participant_id')
          .eq('season_id', activeSeasonData.id)

        const participantIds = new Set(seasonParticipants?.map(sp => sp.participant_id) || [])

        // Mark which participants are in current season
        const enhancedParticipants = participantsData.map(p => ({
          ...p,
          in_current_season: participantIds.has(p.id)
        }))

        setParticipants(enhancedParticipants)
      } else {
        setParticipants(participantsData || [])
      }

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

  const fetchSeasons = async () => {
    try {
      const response = await fetch(`/api/leagues/${slug}/seasons`)
      if (response.ok) {
        const data = await response.json()
        setSeasons(data.seasons)
        
        // Find the active season
        const active = data.seasons.find((s: Season) => s.is_active)
        setActiveSeason(active || null)
      }
    } catch (error) {
      console.error('Error fetching seasons:', error)
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



  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!league || !newParticipant.name.trim()) return

    if (!activeSeason) {
      alert('No active season found. Please create and activate a season first.')
      return
    }

    try {
      // First, add participant to league
      const { data: newParticipantData, error: participantError } = await supabase
        .from('participants')
        .insert({
          league_id: league.id,
          name: newParticipant.name.trim(),
          email: newParticipant.email.trim() || null
        })
        .select()
        .single()

      if (participantError) {
        alert('Error adding participant: ' + participantError.message)
        return
      }

      // Then, add participant to active season
      const { error: seasonParticipantError } = await supabase
        .from('season_participants')
        .insert({
          season_id: activeSeason.id,
          participant_id: newParticipantData.id
        })

      if (seasonParticipantError) {
        // If adding to season fails, remove the participant
        await supabase.from('participants').delete().eq('id', newParticipantData.id)
        alert('Error adding participant to season: ' + seasonParticipantError.message)
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
      const response = await fetch(`/api/leagues/${slug}/matches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          player1_id: newMatch.player1Id,
          player2_id: newMatch.player2Id,
          scheduled_at: newMatch.scheduledAt || undefined
        })
      })

      const data = await response.json()

      if (response.ok) {
        setNewMatch({ player1Id: '', player2Id: '', scheduledAt: '' })
        await fetchData(league.id)
        alert('Match created successfully!')
      } else {
        alert(data.error || 'Failed to create match')
      }
    } catch (error) {
      console.error('Error creating match:', error)
      alert('Failed to create match')
    }
  }

  const handleUpdateMatch = async (matchId: string) => {
    if (!league) return

    try {
      const updateData: any = {
        status: editMatchData.status,
        scheduled_at: editMatchData.scheduled_at ? new Date(editMatchData.scheduled_at).toISOString() : null
      }

      const completedAt = new Date().toISOString()
      const wasBeingCompleted = editMatchData.status === 'completed'

      if (wasBeingCompleted) {
        if (!editMatchData.player1_score || !editMatchData.player2_score) {
          alert('Please enter scores for both players')
          return
        }
        updateData.player1_score = parseInt(editMatchData.player1_score)
        updateData.player2_score = parseInt(editMatchData.player2_score)
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
              const player1Score = parseInt(editMatchData.player1_score!)
              const player2Score = parseInt(editMatchData.player2_score!)
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

      setEditingMatch(null)
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
    setEditingMatch(match.id)
    setEditMatchData({
      player1_score: match.player1_score?.toString() || '',
      player2_score: match.player2_score?.toString() || '',
      status: match.status,
      scheduled_at: match.scheduled_at ? new Date(match.scheduled_at).toISOString().slice(0, 16) : ''
    })
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

  // Season management functions
  const handleAddSeason = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSeason.name.trim()) return

    setAddingSeason(true)

    try {
      const response = await fetch(`/api/leagues/${slug}/seasons`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSeason)
      })

      const data = await response.json()

      if (response.ok) {
        setNewSeason({
          name: '',
          description: '',
          startDate: '',
          makeActive: false,
          convertExisting: false
        })
        await fetchSeasons()
        if (newSeason.makeActive) {
          await fetchData(league!.id)
        }
        alert('Season created successfully!')
      } else {
        alert(data.error || 'Failed to create season')
      }
    } catch (error) {
      console.error('Error creating season:', error)
      alert('Failed to create season')
    } finally {
      setAddingSeason(false)
    }
  }

  const handleActivateSeason = async (seasonSlug: string) => {
    if (!confirm('Are you sure you want to activate this season? This will deactivate the current active season.')) {
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/seasons/${seasonSlug}/activate`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        await fetchSeasons()
        await fetchData(league!.id)
        alert('Season activated successfully!')
      } else {
        alert(data.error || 'Failed to activate season')
      }
    } catch (error) {
      console.error('Error activating season:', error)
      alert('Failed to activate season')
    }
  }

  const handleFinishSeason = async (seasonSlug: string) => {
    if (!confirm('Are you sure you want to finish this season? This action cannot be undone.')) {
      return
    }

    try {
      const response = await fetch(`/api/leagues/${slug}/seasons/${seasonSlug}/finish`, {
        method: 'POST'
      })

      const data = await response.json()

      if (response.ok) {
        await fetchSeasons()
        alert('Season finished successfully!')
      } else {
        alert(data.error || 'Failed to finish season')
      }
    } catch (error) {
      console.error('Error finishing season:', error)
      alert('Failed to finish season')
    }
  }

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

  // Season participant management functions
  const handleAddToSeason = async (participantId: string) => {
    if (!activeSeason) {
      alert('No active season found')
      return
    }

    try {
      const { error } = await supabase
        .from('season_participants')
        .insert({
          season_id: activeSeason.id,
          participant_id: participantId
        })

      if (!error) {
        await fetchData(league!.id)
        alert('Participant added to current season successfully!')
      } else {
        if (error.code === '23505') { // Unique constraint violation
          alert('Participant is already in the current season')
        } else {
          alert('Error adding participant to season: ' + error.message)
        }
      }
    } catch (error) {
      console.error('Error adding participant to season:', error)
      alert('Failed to add participant to season')
    }
  }

  const handleRemoveFromSeason = async (participantId: string) => {
    if (!activeSeason) {
      alert('No active season found')
      return
    }

    if (!confirm('Are you sure you want to remove this participant from the current season?')) {
      return
    }

    try {
      const { error } = await supabase
        .from('season_participants')
        .delete()
        .eq('season_id', activeSeason.id)
        .eq('participant_id', participantId)

      if (!error) {
        await fetchData(league!.id)
        alert('Participant removed from current season successfully!')
      } else {
        alert('Error removing participant from season: ' + error.message)
      }
    } catch (error) {
      console.error('Error removing participant from season:', error)
      alert('Failed to remove participant from season')
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
            <Link href={`/${slug}`} className="btn-outline">
              View Public Page
            </Link>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-8">
            <button
              onClick={() => setActiveTab('participants')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'participants'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Users className="h-4 w-4 inline mr-2" />
              Participants
            </button>
            <button
              onClick={() => setActiveTab('matches')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'matches'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              Matches
            </button>
            <button
              onClick={() => setActiveTab('seasons')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'seasons'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="h-4 w-4 inline mr-2" />
              Seasons
            </button>
            <button
              onClick={() => setActiveTab('registration-requests')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'registration-requests'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <UserPlus className="h-4 w-4 inline mr-2" />
              Player Requests
            </button>
            <button
              onClick={() => setActiveTab('admins')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'admins'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Shield className="h-4 w-4 inline mr-2" />
              Administrators
            </button>
            <button
              onClick={() => setActiveTab('integrations')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'integrations'
                  ? 'border-black text-black'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Settings className="h-4 w-4 inline mr-2" />
              Integrations
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
                        <th className="table-header">Current Season</th>
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
                            {participant.in_current_season ? (
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                In Season
                              </span>
                            ) : (
                              <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                                Not in Season
                              </span>
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
                                  {participant.in_current_season ? (
                                    <button
                                      onClick={() => handleRemoveFromSeason(participant.id)}
                                      className="p-2 text-orange-600 hover:text-orange-800"
                                      title="Remove from current season"
                                    >
                                      <X className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleAddToSeason(participant.id)}
                                      className="p-2 text-green-600 hover:text-green-800"
                                      title="Add to current season"
                                    >
                                      <Plus className="h-4 w-4" />
                                    </button>
                                  )}
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
                          <td colSpan={3} className="table-cell text-center text-gray-500">
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

        {activeTab === 'admins' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Manage Administrators</h2>
              
              {/* Add Admin Form */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Add New Administrator</h3>
                <p className="text-gray-600 text-sm mb-4">
                  Add an email address to grant administrative access to this league. The user will be able to manage participants, matches, and other administrators.
                </p>
                <form onSubmit={handleAddAdmin} className="flex gap-4">
                  <input
                    type="email"
                    placeholder="Enter email address"
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

              {/* Current Admins List */}
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-black">Current Administrators</h3>
                  <p className="text-sm text-gray-600 mt-1">
                    All users listed below can access and manage this league's admin panel.
                  </p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Email</th>
                        <th className="table-header">Added On</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {admins.map((admin) => (
                        <tr key={admin.id}>
                          <td className="table-cell">
                            <div className="flex items-center">
                              <span>{admin.email}</span>
                              {admin.email === currentUserEmail && (
                                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                                  You
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            {new Date(admin.created_at).toLocaleDateString()}
                          </td>
                          <td className="table-cell">
                            {admin.email === currentUserEmail ? (
                              <span className="text-gray-500 text-sm">Cannot remove yourself</span>
                            ) : (
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
                            No administrators found
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

        {activeTab === 'seasons' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Manage Seasons</h2>
              
              {/* Current Active Season */}
              {activeSeason && (
                <div className="card p-6 mb-6">
                  <div className="flex justify-between items-center">
                    <div>
                      <h3 className="text-lg font-semibold text-black">Currently Active Season</h3>
                      <div className="mt-2">
                        <span className="text-xl font-bold text-black">{activeSeason.name}</span>
                        {activeSeason.description && (
                          <p className="text-gray-600 mt-1">{activeSeason.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <span className="px-3 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                        Active
                      </span>
                      {!activeSeason.is_finished && (
                        <button
                          onClick={() => handleFinishSeason(activeSeason.slug)}
                          className="btn-outline text-red-600 border-red-600 hover:bg-red-50"
                        >
                          Finish Season
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Add Season Form */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Create New Season</h3>
                <form onSubmit={handleAddSeason} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Season Name *
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., Season 2, Spring Tournament"
                        value={newSeason.name}
                        onChange={(e) => setNewSeason(prev => ({ ...prev, name: e.target.value }))}
                        className="input-field"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={newSeason.startDate}
                        onChange={(e) => setNewSeason(prev => ({ ...prev, startDate: e.target.value }))}
                        className="input-field"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      placeholder="Optional description for this season"
                      value={newSeason.description}
                      onChange={(e) => setNewSeason(prev => ({ ...prev, description: e.target.value }))}
                      className="input-field"
                      rows={3}
                    />
                  </div>

                  <div className="space-y-3">
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={newSeason.makeActive}
                        onChange={(e) => setNewSeason(prev => ({ ...prev, makeActive: e.target.checked }))}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700">Make this the active season</span>
                    </label>
                    
                    {newSeason.makeActive && (
                      <label className="flex items-center ml-6">
                        <input
                          type="checkbox"
                          checked={newSeason.convertExisting}
                          onChange={(e) => setNewSeason(prev => ({ ...prev, convertExisting: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Copy participants from current active season</span>
                      </label>
                    )}
                  </div>

                  <div className="flex gap-3">
                    <button 
                      type="submit" 
                      className="btn-primary"
                      disabled={addingSeason}
                    >
                      {addingSeason ? (
                        <>
                          <Clock className="h-4 w-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          Create Season
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>

              {/* All Seasons List */}
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-black">All Seasons</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Name</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Start Date</th>
                        <th className="table-header">End Date</th>
                        <th className="table-header">Created</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {seasons.map((season) => (
                        <tr key={season.id}>
                          <td className="table-cell">
                            <div>
                              <div className="font-medium text-black">{season.name}</div>
                              {season.description && (
                                <div className="text-sm text-gray-500">{season.description}</div>
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              {season.is_active && (
                                <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded-full">
                                  Active
                                </span>
                              )}
                              {season.is_finished && (
                                <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs font-medium rounded-full">
                                  Finished
                                </span>
                              )}
                              {!season.is_active && !season.is_finished && (
                                <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="table-cell">
                            {season.start_date ? new Date(season.start_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="table-cell">
                            {season.end_date ? new Date(season.end_date).toLocaleDateString() : '-'}
                          </td>
                          <td className="table-cell">
                            {new Date(season.created_at).toLocaleDateString()}
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              {!season.is_active && !season.is_finished && (
                                <button
                                  onClick={() => handleActivateSeason(season.slug)}
                                  className="text-sm bg-blue-100 hover:bg-blue-200 text-blue-800 px-3 py-2 rounded font-medium transition-colors border border-blue-200 hover:border-blue-300"
                                >
                                  Activate
                                </button>
                              )}
                              {season.is_active && !season.is_finished && (
                                <button
                                  onClick={() => handleFinishSeason(season.slug)}
                                  className="text-sm bg-red-100 hover:bg-red-200 text-red-800 px-3 py-2 rounded font-medium transition-colors border border-red-200 hover:border-red-300"
                                >
                                  Finish
                                </button>
                              )}
                              {season.is_finished && (
                                <span className="text-sm text-gray-500">Finished</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {seasons.length === 0 && (
                        <tr>
                          <td colSpan={6} className="table-cell text-center text-gray-500">
                            No seasons yet
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

        {activeTab === 'matches' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Manage Matches</h2>
              
              {/* Add Match Form */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Schedule New Match</h3>
                <form onSubmit={handleAddMatch} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <select
                    value={newMatch.player1Id}
                    onChange={(e) => setNewMatch(prev => ({ ...prev, player1Id: e.target.value }))}
                    className="input-field"
                    required
                  >
                    <option value="">Select Player 1</option>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <select
                    value={newMatch.player2Id}
                    onChange={(e) => setNewMatch(prev => ({ ...prev, player2Id: e.target.value }))}
                    className="input-field"
                    required
                  >
                    <option value="">Select Player 2</option>
                    {participants.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <input
                    type="datetime-local"
                    value={newMatch.scheduledAt}
                    onChange={(e) => setNewMatch(prev => ({ ...prev, scheduledAt: e.target.value }))}
                    className="input-field"
                  />
                  <button type="submit" className="btn-primary">
                    <Plus className="h-4 w-4 mr-2" />
                    Schedule Match
                  </button>
                </form>
              </div>

              {/* Auto Draw Section */}
              <div className="card p-6 mb-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold text-black">Auto Draw Tournament</h3>
                  {!showAutoDraw && (
                    <button
                      onClick={() => setShowAutoDraw(true)}
                      className="btn-primary"
                      disabled={participants.length < 2}
                    >
                      <Shuffle className="h-4 w-4 mr-2" />
                      Generate All Matches
                    </button>
                  )}
                </div>

                {participants.length < 2 && (
                  <p className="text-gray-600 text-sm mb-4">
                    Add at least 2 participants to use auto draw feature
                  </p>
                )}

                {showAutoDraw && (
                  <div className="space-y-6">
                    {/* Clear Existing Option */}
                    <div>
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={autoDrawConfig.clearExisting}
                          onChange={(e) => setAutoDrawConfig(prev => ({ ...prev, clearExisting: e.target.checked }))}
                          className="mr-2"
                        />
                        <span className="text-sm text-gray-700">Clear existing matches first</span>
                      </label>
                      {matches.length > 0 && (
                        <p className="text-sm text-gray-500 ml-6">
                          This will delete all {matches.length} existing match(es)
                        </p>
                      )}
                    </div>

                    {/* Schedule Options */}
                    <div>
                      <h4 className="font-medium text-black mb-3">Schedule Options</h4>
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="scheduleOption"
                            checked={!autoDrawConfig.autoSchedule}
                            onChange={() => setAutoDrawConfig(prev => ({ ...prev, autoSchedule: false }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">No automatic scheduling</span>
                        </label>
                        <label className="flex items-center">
                          <input
                            type="radio"
                            name="scheduleOption"
                            checked={autoDrawConfig.autoSchedule}
                            onChange={() => setAutoDrawConfig(prev => ({ ...prev, autoSchedule: true }))}
                            className="mr-2"
                          />
                          <span className="text-sm text-gray-700">Automatic scheduling</span>
                        </label>
                      </div>
                    </div>

                    {/* Automatic Scheduling Options */}
                    {autoDrawConfig.autoSchedule && (
                      <div className="border-l-4 border-blue-500 pl-4 space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Start Date
                            </label>
                            <input
                              type="date"
                              value={autoDrawConfig.startDate}
                              onChange={(e) => setAutoDrawConfig(prev => ({ ...prev, startDate: e.target.value }))}
                              className="input-field"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Start Time
                            </label>
                            <input
                              type="time"
                              value={autoDrawConfig.startTime}
                              onChange={(e) => setAutoDrawConfig(prev => ({ ...prev, startTime: e.target.value }))}
                              className="input-field"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Match Interval
                            </label>
                            <select
                              value={autoDrawConfig.intervalDays}
                              onChange={(e) => setAutoDrawConfig(prev => ({ ...prev, intervalDays: parseInt(e.target.value) }))}
                              className="input-field"
                            >
                              <option value={1}>Daily</option>
                              <option value={2}>Every 2 days</option>
                              <option value={3}>Every 3 days</option>
                              <option value={7}>Weekly</option>
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Days of Week
                          </label>
                          <div className="flex gap-2">
                            {[0, 1, 2, 3, 4, 5, 6].map(day => (
                              <button
                                key={day}
                                type="button"
                                onClick={() => handleDayOfWeekToggle(day)}
                                className={`px-3 py-2 rounded text-sm font-medium ${
                                  autoDrawConfig.daysOfWeek.includes(day)
                                    ? 'bg-black text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                              >
                                {getDayName(day)}
                              </button>
                            ))}
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Select which days matches can be scheduled
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                      <button
                        onClick={handlePreviewAutoDraw}
                        className="btn-outline"
                        disabled={autoDrawConfig.autoSchedule && !autoDrawConfig.startDate}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        Preview Matches
                      </button>
                      <button
                        onClick={handleGenerateAutoDraw}
                        className="btn-primary"
                        disabled={isGeneratingDraw || (autoDrawConfig.autoSchedule && !autoDrawConfig.startDate)}
                      >
                        {isGeneratingDraw ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Shuffle className="h-4 w-4 mr-2" />
                            Generate Tournament
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowAutoDraw(false)
                          setShowPreview(false)
                          setAutoDrawPreview(null)
                        }}
                        className="btn-outline"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                {/* Preview Modal */}
                {showPreview && autoDrawPreview && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full m-4 max-h-[90vh] overflow-hidden">
                      <div className="p-6 border-b border-gray-200">
                        <h3 className="text-lg font-semibold text-black">Match Preview</h3>
                        <p className="text-sm text-gray-600 mt-1">
                          {autoDrawPreview.totalMatches} matches will be created for {autoDrawPreview.participants} participants
                          {autoDrawPreview.estimatedDuration && ` (${autoDrawPreview.estimatedDuration})`}
                        </p>
                      </div>
                      <div className="p-6 overflow-y-auto max-h-96">
                        <div className="space-y-2">
                          {autoDrawPreview.matches.map((match: any, index: number) => (
                            <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                              <span className="font-medium">
                                {match.player1_name} vs {match.player2_name}
                              </span>
                              <span className="text-sm text-gray-600">
                                {match.scheduled_at ? formatPreviewDate(match.scheduled_at) : 'No date'}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                      <div className="p-6 border-t border-gray-200 flex gap-3">
                        <button
                          onClick={handleGenerateAutoDraw}
                          className="btn-primary"
                          disabled={isGeneratingDraw}
                        >
                          {isGeneratingDraw ? 'Generating...' : 'Confirm & Generate'}
                        </button>
                        <button
                          onClick={() => setShowPreview(false)}
                          className="btn-outline"
                        >
                          Back to Config
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Matches List */}
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-black">All Matches</h3>
                </div>
                <div className="overflow-x-auto">
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
                      {matches.map((match) => (
                        <tr key={match.id}>
                          <td className="table-cell">
                            {match.player1.name} vs {match.player2.name}
                          </td>
                          <td className="table-cell">
                            {editingMatch === match.id ? (
                              <div className="flex gap-2">
                                <input
                                  type="number"
                                  placeholder="P1"
                                  value={editMatchData.player1_score}
                                  onChange={(e) => setEditMatchData(prev => ({ ...prev, player1_score: e.target.value }))}
                                  className="input-field w-16"
                                  min="0"
                                />
                                <span>-</span>
                                <input
                                  type="number"
                                  placeholder="P2"
                                  value={editMatchData.player2_score}
                                  onChange={(e) => setEditMatchData(prev => ({ ...prev, player2_score: e.target.value }))}
                                  className="input-field w-16"
                                  min="0"
                                />
                              </div>
                            ) : (
                              match.status === 'completed' 
                                ? `${match.player1_score} - ${match.player2_score}`
                                : '-'
                            )}
                          </td>
                          <td className="table-cell">
                            {editingMatch === match.id ? (
                              <select
                                value={editMatchData.status}
                                onChange={(e) => setEditMatchData(prev => ({ ...prev, status: e.target.value as Match['status'] }))}
                                className="input-field"
                              >
                                <option value="scheduled">Scheduled</option>
                                <option value="in_progress">In Progress</option>
                                <option value="completed">Completed</option>
                                <option value="cancelled">Cancelled</option>
                              </select>
                            ) : (
                              <span className={`badge-${
                                match.status === 'completed' ? 'green' :
                                match.status === 'in_progress' ? 'yellow' :
                                match.status === 'cancelled' ? 'red' : 'gray'
                              }`}>
                                {match.status.replace('_', ' ')}
                              </span>
                            )}
                          </td>
                          <td className="table-cell">
                            {editingMatch === match.id ? (
                              <input
                                type="datetime-local"
                                value={editMatchData.scheduled_at}
                                onChange={(e) => setEditMatchData(prev => ({ ...prev, scheduled_at: e.target.value }))}
                                className="input-field"
                              />
                            ) : (
                              match.scheduled_at ? formatDate(match.scheduled_at) : '-'
                            )}
                          </td>
                          <td className="table-cell">
                            <div className="flex gap-2">
                              {editingMatch === match.id ? (
                                <>
                                  <button
                                    onClick={() => handleUpdateMatch(match.id)}
                                    className="p-2 text-green-600 hover:text-green-800"
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingMatch(null)}
                                    className="p-2 text-gray-600 hover:text-gray-800"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditingMatch(match)}
                                    className="p-2 text-blue-600 hover:text-blue-800"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteMatch(match.id)}
                                    className="p-2 text-red-600 hover:text-red-800"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {matches.length === 0 && (
                        <tr>
                          <td colSpan={5} className="table-cell text-center text-gray-500">
                            No matches yet
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

        {activeTab === 'registration-requests' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Player Registration Requests</h2>
              <p className="text-gray-600 mb-6">
                Review and manage player registration requests. Users can request to claim a player profile by registering with their email.
              </p>
              
              {/* Registration Requests List */}
              <div className="card">
                <div className="p-6 border-b border-gray-200">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-black">Pending Requests</h3>
                    <span className="text-sm text-gray-500">
                      {registrationRequests.filter(r => r.status === 'pending').length} pending requests
                    </span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Player</th>
                        <th className="table-header">Requesting User</th>
                        <th className="table-header">Status</th>
                        <th className="table-header">Requested</th>
                        <th className="table-header">Reviewed</th>
                        <th className="table-header">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrationRequests.map((request) => (
                        <tr key={request.id}>
                          <td className="table-cell">
                            <div className="font-medium text-black">{request.player.name}</div>
                          </td>
                          <td className="table-cell">
                            <div className="text-sm">{request.claimer_email}</div>
                          </td>
                          <td className="table-cell">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              request.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                              request.status === 'approved' ? 'bg-green-100 text-green-800' :
                              'bg-red-100 text-red-800'
                            }`}>
                              {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                            </span>
                          </td>
                          <td className="table-cell">
                            <div className="text-sm text-gray-600">
                              {new Date(request.requested_at).toLocaleDateString()}
                              <div className="text-xs text-gray-400">
                                {new Date(request.requested_at).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td className="table-cell">
                            {request.reviewed_at ? (
                              <div className="text-sm text-gray-600">
                                {new Date(request.reviewed_at).toLocaleDateString()}
                                <div className="text-xs text-gray-400">
                                  {new Date(request.reviewed_at).toLocaleTimeString()}
                                </div>
                                {request.reviewed_by && (
                                  <div className="text-xs text-gray-400">
                                    by {request.reviewed_by}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </td>
                          <td className="table-cell">
                            {request.status === 'pending' ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleApproveRequest(request.id)}
                                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-100 border border-green-300 rounded-md hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                                  title="Approve request"
                                >
                                  <CheckCircle className="h-4 w-4 mr-1" />
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleRejectRequest(request.id)}
                                  className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-100 border border-red-300 rounded-md hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                                  title="Reject request"
                                >
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject
                                </button>
                              </div>
                            ) : (
                              <span className="text-gray-500 text-sm">
                                {request.status === 'approved' ? 'Approved' : 'Rejected'}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      {registrationRequests.length === 0 && (
                        <tr>
                          <td colSpan={6} className="table-cell text-center text-gray-500">
                            <div className="py-8">
                              <UserPlus className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                              <p className="text-lg font-medium text-gray-900 mb-2">No registration requests</p>
                              <p className="text-gray-500">
                                When users request to claim a player profile, they will appear here for review.
                              </p>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Summary Statistics */}
              {registrationRequests.length > 0 && (
                <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="card p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-yellow-600">
                        {registrationRequests.filter(r => r.status === 'pending').length}
                      </div>
                      <div className="text-sm text-gray-600">Pending</div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">
                        {registrationRequests.filter(r => r.status === 'approved').length}
                      </div>
                      <div className="text-sm text-gray-600">Approved</div>
                    </div>
                  </div>
                  <div className="card p-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-red-600">
                        {registrationRequests.filter(r => r.status === 'rejected').length}
                      </div>
                      <div className="text-sm text-gray-600">Rejected</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'integrations' && (
          <div>
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-black mb-4">Google Chat Integration</h2>
              <p className="text-gray-600 mb-6">
                Configure Google Chat notifications to automatically post updates about new matches and schedule confirmations to your Google Chat space.
              </p>
              
              {/* Chat Integration Form */}
              <div className="card p-6 mb-6">
                <h3 className="text-lg font-semibold text-black mb-4">Configuration</h3>
                <form onSubmit={handleSaveChatConfig} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Google Chat Webhook URL *
                    </label>
                    <input
                      type="url"
                      placeholder="https://chat.googleapis.com/v1/spaces/..."
                      value={chatConfig.webhook_url}
                      onChange={(e) => setChatConfig(prev => ({ ...prev, webhook_url: e.target.value }))}
                      className="input-field"
                      required
                    />
                    <p className="text-sm text-gray-500 mt-1">
                      Create a webhook in your Google Chat space and paste the URL here.
                    </p>
                  </div>

                  <div className="space-y-4">
                    <h4 className="font-medium text-gray-900">Notification Settings</h4>
                    
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        checked={chatConfig.enabled}
                        onChange={(e) => setChatConfig(prev => ({ ...prev, enabled: e.target.checked }))}
                        className="mr-3"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-700">Enable Google Chat Integration</span>
                        <p className="text-xs text-gray-500">Master switch for all notifications</p>
                      </div>
                    </label>

                    {chatConfig.enabled && (
                      <div className="ml-6 space-y-3 border-l-2 border-gray-200 pl-4">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={chatConfig.notify_new_matches}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, notify_new_matches: e.target.checked }))}
                            className="mr-3"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-700">New Match Created</span>
                            <p className="text-xs text-gray-500">Notify when new matches are created (auto-draw or manual)</p>
                          </div>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={chatConfig.notify_approved_schedules}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, notify_approved_schedules: e.target.checked }))}
                            className="mr-3"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-700">Schedule Confirmed</span>
                            <p className="text-xs text-gray-500">Notify when players confirm a match schedule</p>
                          </div>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={chatConfig.notify_schedule_requests}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, notify_schedule_requests: e.target.checked }))}
                            className="mr-3"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-700">Schedule Requests</span>
                            <p className="text-xs text-gray-500">Notify when someone sends a schedule request for a match</p>
                          </div>
                        </label>

                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={chatConfig.notify_match_completions}
                            onChange={(e) => setChatConfig(prev => ({ ...prev, notify_match_completions: e.target.checked }))}
                            className="mr-3"
                          />
                          <div>
                            <span className="text-sm font-medium text-gray-700">Match Completed</span>
                            <p className="text-xs text-gray-500">Notify when matches are completed with final scores</p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Daily Summary Settings */}
                  {chatConfig.enabled && (
                    <div className="space-y-4 border-t border-gray-200 pt-6">
                      <h4 className="font-medium text-gray-900">Daily Summary Settings</h4>
                      
                      <label className="flex items-center">
                        <input
                          type="checkbox"
                          checked={chatConfig.daily_summary_enabled}
                          onChange={(e) => setChatConfig(prev => ({ ...prev, daily_summary_enabled: e.target.checked }))}
                          className="mr-3"
                        />
                        <div>
                          <span className="text-sm font-medium text-gray-700">Enable Daily Summary</span>
                          <p className="text-xs text-gray-500">Automatically send daily league summaries</p>
                        </div>
                      </label>

                      {chatConfig.daily_summary_enabled && (
                        <div className="ml-6 space-y-4 border-l-2 border-gray-200 pl-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Send Time (WIB)
                            </label>
                            <input
                              type="time"
                              value={chatConfig.daily_summary_time}
                              onChange={(e) => setChatConfig(prev => ({ ...prev, daily_summary_time: e.target.value }))}
                              className="input-field w-32"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              Daily summary will be sent at this time (Indonesia Western Time)
                            </p>
                          </div>

                          <div>
                            <span className="block text-sm font-medium text-gray-700 mb-3">Include in Summary</span>
                            <div className="space-y-2">
                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={chatConfig.summary_include_streaks}
                                  onChange={(e) => setChatConfig(prev => ({ ...prev, summary_include_streaks: e.target.checked }))}
                                  className="mr-3"
                                />
                                <div>
                                  <span className="text-sm text-gray-700">Winning Streak Monster</span>
                                  <p className="text-xs text-gray-500">Show player with longest current winning streak</p>
                                </div>
                              </label>

                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={chatConfig.summary_include_rankings}
                                  onChange={(e) => setChatConfig(prev => ({ ...prev, summary_include_rankings: e.target.checked }))}
                                  className="mr-3"
                                />
                                <div>
                                  <span className="text-sm text-gray-700">Current Rankings</span>
                                  <p className="text-xs text-gray-500">Show top 3 players in the league</p>
                                </div>
                              </label>

                              <label className="flex items-center">
                                <input
                                  type="checkbox"
                                  checked={chatConfig.summary_include_schedule}
                                  onChange={(e) => setChatConfig(prev => ({ ...prev, summary_include_schedule: e.target.checked }))}
                                  className="mr-3"
                                />
                                <div>
                                  <span className="text-sm text-gray-700">Today's Match Schedule</span>
                                  <p className="text-xs text-gray-500">Show matches scheduled for today</p>
                                </div>
                              </label>
                            </div>
                          </div>

                          {chatIntegration && (
                            <div className="mt-4">
                              <div className="flex gap-3">
                                <button
                                  type="button"
                                  onClick={handlePreviewDailySummary}
                                  className="btn-outline"
                                  disabled={previewingDailySummary}
                                >
                                  {previewingDailySummary ? (
                                    <>
                                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                                      Generating...
                                    </>
                                  ) : (
                                    <>
                                      <Eye className="h-4 w-4 mr-2" />
                                      Preview Summary
                                    </>
                                  )}
                                </button>
                                <button
                                  type="button"
                                  onClick={handleSendDailySummary}
                                  className="btn-outline"
                                  disabled={sendingDailySummary}
                                >
                                  {sendingDailySummary ? (
                                    <>
                                      <Clock className="h-4 w-4 mr-2 animate-spin" />
                                      Sending...
                                    </>
                                  ) : (
                                    <>
                                      <MessageSquare className="h-4 w-4 mr-2" />
                                      Send Summary Now
                                    </>
                                  )}
                                </button>
                              </div>
                              {chatIntegration.last_summary_sent && (
                                <p className="text-xs text-gray-500 mt-2">
                                  Last sent: {new Date(chatIntegration.last_summary_sent).toLocaleString('en-US', { timeZone: 'Asia/Jakarta' })} WIB
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
                          Save Configuration
                        </>
                      )}
                    </button>
                    
                    {chatIntegration && (
                      <>
                        <button 
                          type="button"
                          onClick={handleTestChat}
                          className="btn-outline"
                          disabled={testingChat || !chatConfig.enabled}
                        >
                          {testingChat ? (
                            <>
                              <Clock className="h-4 w-4 mr-2 animate-spin" />
                              Testing...
                            </>
                          ) : (
                            <>
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Send Test
                            </>
                          )}
                        </button>
                        
                        <button
                          type="button"
                          onClick={handleRemoveChatIntegration}
                          className="btn-outline text-red-600 border-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Remove Integration
                        </button>
                      </>
                    )}
                  </div>
                </form>
              </div>

              {/* Custom Announcement Section */}
              {chatIntegration && chatIntegration.enabled && (
                <div className="card p-6 mb-6">
                  <h3 className="text-lg font-semibold text-black mb-4">Send Custom Announcement</h3>
                  <p className="text-gray-600 mb-4">
                    Send a custom announcement to your Google Chat space. This will appear as a league announcement card.
                  </p>
                  
                  <form onSubmit={handleSendAnnouncement} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Announcement Message *
                      </label>
                      <textarea
                        placeholder="Enter your announcement message here..."
                        value={announcementText}
                        onChange={(e) => setAnnouncementText(e.target.value)}
                        className="input-field"
                        rows={4}
                        maxLength={2000}
                        required
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Plain text only (no special formatting)</span>
                        <span>{announcementText.length}/2000 characters</span>
                      </div>
                    </div>
                    
                    <div className="flex gap-3">
                      <button 
                        type="submit" 
                        className="btn-primary"
                        disabled={sendingAnnouncement || !announcementText.trim()}
                      >
                        {sendingAnnouncement ? (
                          <>
                            <Clock className="h-4 w-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Send Announcement
                          </>
                        )}
                      </button>
                      
                      {announcementText.trim() && (
                        <button
                          type="button"
                          onClick={() => setAnnouncementText('')}
                          className="btn-outline"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </form>
                  
                  <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-1">Preview</h4>
                    <p className="text-sm text-blue-700">
                      Your announcement will appear as a rich card with "📢 League Announcement" header, your message, timestamp, and a "View League" button.
                    </p>
                  </div>
                </div>
              )}

              {/* Integration Status */}
              <div className="card p-6">
                <h3 className="text-lg font-semibold text-black mb-4">Integration Status</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Configuration Status</span>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      chatIntegration 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {chatIntegration ? 'Configured' : 'Not Configured'}
                    </span>
                  </div>
                  
                  {chatIntegration && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Integration Status</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          chatIntegration.enabled 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {chatIntegration.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">New Match Notifications</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          chatIntegration.notify_new_matches 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {chatIntegration.notify_new_matches ? 'On' : 'Off'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Schedule Confirmation Notifications</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          chatIntegration.notify_approved_schedules 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {chatIntegration.notify_approved_schedules ? 'On' : 'Off'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Schedule Request Notifications</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          chatIntegration.notify_schedule_requests 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {chatIntegration.notify_schedule_requests ? 'On' : 'Off'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Match Completion Notifications</span>
                        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                          chatIntegration.notify_match_completions 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {chatIntegration.notify_match_completions ? 'On' : 'Off'}
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-700">Last Updated</span>
                        <span className="text-xs text-gray-500">
                          {new Date(chatIntegration.updated_at).toLocaleString()}
                        </span>
                      </div>
                    </>
                  )}
                </div>
                
                {!chatIntegration && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-medium text-blue-900 mb-2">Getting Started</h4>
                    <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
                      <li>Create a Google Chat space or use an existing one</li>
                      <li>Add a webhook to the space (Chat settings → Webhooks)</li>
                      <li>Copy the webhook URL and paste it above</li>
                      <li>Configure your notification preferences</li>
                      <li>Save and test the configuration</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}


      </main>
      
      {/* Daily Summary Preview Modal */}
      {showPreviewModal && dailySummaryPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full m-4 max-h-[90vh] overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-black">Daily Summary Preview</h3>
                <button
                  onClick={() => {
                    setShowPreviewModal(false)
                    setDailySummaryPreview(null)
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="text-sm text-gray-600 mt-1">
                This is how the notification will appear in Google Chat
              </p>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {/* Mock Google Chat Card UI */}
              <div className="border border-gray-200 rounded-lg bg-gray-50 p-4 max-w-md">
                <div className="border-b border-gray-200 pb-3 mb-4">
                  <h4 className="font-semibold text-gray-900 text-lg">
                    {dailySummaryPreview.title}
                  </h4>
                  <p className="text-sm text-gray-600 mt-1">
                    {dailySummaryPreview.subtitle}
                  </p>
                </div>
                
                <div className="space-y-4">
                  {dailySummaryPreview.sections.map((section: any, index: number) => (
                    <div key={index} className="space-y-2">
                      <h5 className="font-medium text-gray-900 text-base">
                        {section.title}
                      </h5>
                      <div className="text-sm text-gray-700 whitespace-pre-line bg-white rounded border p-3">
                        {section.content}
                      </div>
                    </div>
                  ))}
                  
                  <div className="border-t border-gray-200 pt-3 mt-4">
                    <button className="bg-blue-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-blue-700">
                      View League
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 bg-gray-50">
              <div className="flex justify-between items-center">
                <p className="text-sm text-gray-600">
                  Ready to send this notification?
                </p>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                      setDailySummaryPreview(null)
                    }}
                    className="btn-outline"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setShowPreviewModal(false)
                      setDailySummaryPreview(null)
                      handleSendDailySummary()
                    }}
                    className="btn-primary"
                    disabled={sendingDailySummary}
                  >
                    {sendingDailySummary ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <MessageSquare className="h-4 w-4 mr-2" />
                        Send Now
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

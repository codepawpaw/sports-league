'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ArrowLeft, Users, Calendar, Plus, Edit, Trash2, Save, X, Shuffle, Eye, Clock, Shield, CheckCircle, XCircle, MessageSquare, UserPlus } from 'lucide-react'
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
    } catch (error) {
      console.error('Error checking admin access:', error)
      router.push(`/${slug}`)
    } finally {
      setLoading(false)
    }
  }

  const fetchData = async (leagueId: string) => {
    try {
      // Fetch participants
      const { data: participantsData } = await supabase
        .from('participants')
        .select('*')
        .eq('league_id', leagueId)
        .order('name')

      if (participantsData) {
        setParticipants(participantsData)
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



  const handleAddParticipant = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!league || !newParticipant.name.trim()) return

    try {
      const { error } = await supabase
        .from('participants')
        .insert({
          league_id: league.id,
          name: newParticipant.name.trim(),
          email: newParticipant.email.trim() || null
        })

      if (!error) {
        setNewParticipant({ name: '', email: '' })
        await fetchData(league.id)
      } else {
        alert('Error adding participant: ' + error.message)
      }
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
      const { error } = await supabase
        .from('matches')
        .insert({
          league_id: league.id,
          player1_id: newMatch.player1Id,
          player2_id: newMatch.player2Id,
          scheduled_at: newMatch.scheduledAt ? new Date(newMatch.scheduledAt).toISOString() : null,
          status: 'scheduled'
        })

      if (!error) {
        setNewMatch({ player1Id: '', player2Id: '', scheduledAt: '' })
        await fetchData(league.id)
      } else {
        alert('Error creating match: ' + error.message)
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

      if (editMatchData.status === 'completed') {
        if (!editMatchData.player1_score || !editMatchData.player2_score) {
          alert('Please enter scores for both players')
          return
        }
        updateData.player1_score = parseInt(editMatchData.player1_score)
        updateData.player2_score = parseInt(editMatchData.player2_score)
        updateData.completed_at = new Date().toISOString()
      }

      const { error } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', matchId)

      if (!error) {
        setEditingMatch(null)
        await fetchData(league.id)
      } else {
        alert('Error updating match: ' + error.message)
      }
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
                                  >
                                    <Save className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => setEditingParticipant(null)}
                                    className="p-2 text-gray-600 hover:text-gray-800"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => startEditingParticipant(participant)}
                                    className="p-2 text-blue-600 hover:text-blue-800"
                                  >
                                    <Edit className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteParticipant(participant.id)}
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


      </main>
    </div>
  )
}

'use client'

import { useEffect, useState } from 'react'
import { Plus, Trash2, Lock, Unlock, RefreshCw, X } from 'lucide-react'

interface Participant {
  id: string
  name: string
  email: string | null
}

interface AdminPollOption {
  id: string
  label: string
  participant_id: string | null
  display_order: number
  vote_count: number
}

interface AdminPoll {
  id: string
  title: string
  description: string | null
  poll_type: 'custom' | 'predefined_players'
  status: 'open' | 'closed'
  created_by: string | null
  created_at: string
  total_votes: number
  options: AdminPollOption[]
}

interface VotingAdminPanelProps {
  slug: string
  participants: Participant[]
}

type PollType = 'custom' | 'predefined_players'

interface FormState {
  title: string
  description: string
  poll_type: PollType
  customOptions: string[]
  selectedParticipantIds: string[]
}

const emptyForm: FormState = {
  title: '',
  description: '',
  poll_type: 'custom',
  customOptions: ['', ''],
  selectedParticipantIds: []
}

export default function VotingAdminPanel({ slug, participants }: VotingAdminPanelProps) {
  const [polls, setPolls] = useState<AdminPoll[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<FormState>(emptyForm)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()
  }, [slug])

  const fetchPolls = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leagues/${slug}/polls`, {
        method: 'GET',
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setPolls(data.polls || [])
      }
    } catch (err) {
      console.error('Error loading polls:', err)
    } finally {
      setLoading(false)
    }
  }

  const resetForm = () => {
    setForm(emptyForm)
    setError(null)
  }

  const addCustomOption = () => {
    setForm((prev) => ({ ...prev, customOptions: [...prev.customOptions, ''] }))
  }

  const updateCustomOption = (index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      customOptions: prev.customOptions.map((opt, i) => (i === index ? value : opt))
    }))
  }

  const removeCustomOption = (index: number) => {
    setForm((prev) => ({
      ...prev,
      customOptions: prev.customOptions.filter((_, i) => i !== index)
    }))
  }

  const toggleParticipant = (id: string) => {
    setForm((prev) => ({
      ...prev,
      selectedParticipantIds: prev.selectedParticipantIds.includes(id)
        ? prev.selectedParticipantIds.filter((p) => p !== id)
        : [...prev.selectedParticipantIds, id]
    }))
  }

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccessMessage(null)

    if (!form.title.trim()) {
      setError('Title is required')
      return
    }

    let options: Array<{ label?: string; participant_id?: string }>
    if (form.poll_type === 'custom') {
      const cleaned = form.customOptions.map((o) => o.trim()).filter((o) => o.length > 0)
      if (cleaned.length < 2) {
        setError('Provide at least two non-empty options')
        return
      }
      options = cleaned.map((label) => ({ label }))
    } else {
      if (form.selectedParticipantIds.length < 2) {
        setError('Select at least two players')
        return
      }
      options = form.selectedParticipantIds.map((id) => ({ participant_id: id }))
    }

    setSubmitting(true)
    try {
      const response = await fetch(`/api/leagues/${slug}/polls`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          poll_type: form.poll_type,
          options
        })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to create poll')
      }

      setSuccessMessage('Poll created')
      resetForm()
      setShowForm(false)
      await fetchPolls()
    } catch (err: any) {
      setError(err.message || 'Failed to create poll')
    } finally {
      setSubmitting(false)
    }
  }

  const togglePollStatus = async (poll: AdminPoll) => {
    const nextStatus = poll.status === 'open' ? 'closed' : 'open'
    try {
      const response = await fetch(`/api/leagues/${slug}/polls/${poll.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: nextStatus })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update poll')
      }

      await fetchPolls()
    } catch (err: any) {
      setError(err.message || 'Failed to update poll')
    }
  }

  const deletePoll = async (poll: AdminPoll) => {
    if (!confirm(`Delete poll "${poll.title}"? This cannot be undone.`)) return

    try {
      const response = await fetch(`/api/leagues/${slug}/polls/${poll.id}`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete poll')
      }

      await fetchPolls()
    } catch (err: any) {
      setError(err.message || 'Failed to delete poll')
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-black">Voting & Polls</h2>
          <p className="text-sm text-gray-600 mt-1">
            Create polls shown on the league homepage. Use a Custom poll for free-form
            options (e.g. favorite ball brand), or a Player poll to vote between existing
            players.
          </p>
        </div>
        <button
          onClick={() => {
            resetForm()
            setShowForm((s) => !s)
          }}
          className="btn-primary inline-flex items-center"
        >
          {showForm ? (
            <>
              <X className="h-4 w-4 mr-2" /> Cancel
            </>
          ) : (
            <>
              <Plus className="h-4 w-4 mr-2" /> New Poll
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
          {error}
        </div>
      )}
      {successMessage && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-2">
          {successMessage}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleCreatePoll} className="card p-6 mb-6 space-y-4">
          <h3 className="text-lg font-semibold text-black">Create Poll</h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              className="input-field w-full"
              placeholder="e.g. Most favorite ball brand"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description (optional)
            </label>
            <textarea
              value={form.description}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="input-field w-full"
              rows={2}
              placeholder="A short explanation of the poll"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Poll Type</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setForm((prev) => ({ ...prev, poll_type: 'custom' }))}
                className={`border rounded-lg p-4 text-left transition-colors ${
                  form.poll_type === 'custom'
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-black">Custom</div>
                <div className="text-sm text-gray-600 mt-1">
                  Define your own options (e.g. ATP vs Dunlop balls).
                </div>
              </button>
              <button
                type="button"
                onClick={() =>
                  setForm((prev) => ({ ...prev, poll_type: 'predefined_players' }))
                }
                className={`border rounded-lg p-4 text-left transition-colors ${
                  form.poll_type === 'predefined_players'
                    ? 'border-black bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="font-semibold text-black">Players</div>
                <div className="text-sm text-gray-600 mt-1">
                  Pick players from the league as options (e.g. favorite to win).
                </div>
              </button>
            </div>
          </div>

          {form.poll_type === 'custom' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Options</label>
              <div className="space-y-2">
                {form.customOptions.map((opt, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      type="text"
                      value={opt}
                      onChange={(e) => updateCustomOption(index, e.target.value)}
                      placeholder={`Option ${index + 1}`}
                      className="input-field flex-1"
                    />
                    {form.customOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => removeCustomOption(index)}
                        className="p-2 text-red-600 hover:text-red-800"
                        aria-label="Remove option"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addCustomOption}
                className="mt-2 inline-flex items-center text-sm text-gray-700 hover:text-black"
              >
                <Plus className="h-4 w-4 mr-1" /> Add option
              </button>
            </div>
          )}

          {form.poll_type === 'predefined_players' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select players ({form.selectedParticipantIds.length} selected)
              </label>
              {participants.length === 0 ? (
                <p className="text-sm text-gray-500">No participants in this league yet.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100">
                  {participants.map((p) => {
                    const checked = form.selectedParticipantIds.includes(p.id)
                    return (
                      <label
                        key={p.id}
                        className="flex items-center px-3 py-2 cursor-pointer hover:bg-gray-50"
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleParticipant(p.id)}
                          className="mr-3"
                        />
                        <span className="text-sm text-black">{p.name}</span>
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                resetForm()
                setShowForm(false)
              }}
              className="btn-secondary"
            >
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Creating…' : 'Create Poll'}
            </button>
          </div>
        </form>
      )}

      <div className="card">
        <div className="p-6 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-black">Existing Polls</h3>
          <button
            onClick={fetchPolls}
            className="inline-flex items-center text-sm text-gray-700 hover:text-black"
          >
            <RefreshCw className="h-4 w-4 mr-1" /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="p-6 text-gray-500 flex items-center">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Loading polls…
          </div>
        ) : polls.length === 0 ? (
          <div className="p-6 text-gray-500 text-center">No polls yet.</div>
        ) : (
          <div className="divide-y divide-gray-100">
            {polls.map((poll) => (
              <div key={poll.id} className="p-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-lg font-semibold text-black">{poll.title}</h4>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                          poll.poll_type === 'predefined_players'
                            ? 'bg-blue-50 text-blue-700 border-blue-200'
                            : 'bg-purple-50 text-purple-700 border-purple-200'
                        }`}
                      >
                        {poll.poll_type === 'predefined_players' ? 'Players' : 'Custom'}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full border ${
                          poll.status === 'open'
                            ? 'bg-green-50 text-green-700 border-green-200'
                            : 'bg-gray-100 text-gray-700 border-gray-200'
                        }`}
                      >
                        {poll.status === 'open' ? 'Open' : 'Closed'}
                      </span>
                    </div>
                    {poll.description && (
                      <p className="text-sm text-gray-600 mt-1">{poll.description}</p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      {poll.total_votes} {poll.total_votes === 1 ? 'vote' : 'votes'}
                      {poll.created_by ? ` • created by ${poll.created_by}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <button
                      onClick={() => togglePollStatus(poll)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50"
                    >
                      {poll.status === 'open' ? (
                        <>
                          <Lock className="h-4 w-4 mr-1" /> Close
                        </>
                      ) : (
                        <>
                          <Unlock className="h-4 w-4 mr-1" /> Reopen
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => deletePoll(poll)}
                      className="p-2 text-red-600 hover:text-red-800"
                      title="Delete poll"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-3 space-y-2">
                  {poll.options.map((option) => {
                    const percent =
                      poll.total_votes > 0
                        ? Math.round((option.vote_count / poll.total_votes) * 100)
                        : 0
                    return (
                      <div
                        key={option.id}
                        className="relative border border-gray-200 rounded-lg overflow-hidden"
                      >
                        <div
                          className="absolute inset-y-0 left-0 bg-gray-100"
                          style={{ width: `${percent}%` }}
                        />
                        <div className="relative flex items-center justify-between px-4 py-2">
                          <span className="text-sm font-medium text-black truncate">
                            {option.label}
                          </span>
                          <span className="text-sm text-gray-700 ml-3 flex-shrink-0">
                            {percent}%{' '}
                            <span className="text-gray-500">({option.vote_count})</span>
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

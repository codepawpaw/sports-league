'use client'

import { useEffect, useState } from 'react'
import { Vote, CheckCircle2, Lock, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'

const VISIBLE_OPTIONS_LIMIT = 3

interface PollOption {
  id: string
  label: string
  participant_id: string | null
  display_order: number
  vote_count: number
}

interface Poll {
  id: string
  title: string
  description: string | null
  poll_type: 'custom' | 'predefined_players'
  status: 'open' | 'closed'
  created_at: string
  total_votes: number
  my_option_id: string | null
  options: PollOption[]
}

interface VotingSectionProps {
  slug: string
  currentUser: any
}

export default function VotingSection({ slug, currentUser }: VotingSectionProps) {
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submittingPollId, setSubmittingPollId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    fetchPolls()
  }, [slug, currentUser?.id])

  const fetchPolls = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await fetch(`/api/leagues/${slug}/polls`, {
        method: 'GET',
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      })

      if (!response.ok) {
        throw new Error('Failed to load polls')
      }

      const data = await response.json()
      setPolls(data.polls || [])
    } catch (err) {
      console.error('Error loading polls:', err)
      setError('Failed to load polls')
    } finally {
      setLoading(false)
    }
  }

  const submitVote = async (pollId: string, optionId: string) => {
    if (!currentUser) {
      setActionError('You need to log in to vote')
      return
    }
    setSubmittingPollId(pollId)
    setActionError(null)
    try {
      const response = await fetch(`/api/leagues/${slug}/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ option_id: optionId })
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to record vote')
      }

      await fetchPolls()
    } catch (err: any) {
      console.error('Vote error:', err)
      setActionError(err.message || 'Failed to record vote')
    } finally {
      setSubmittingPollId(null)
    }
  }

  const retractVote = async (pollId: string) => {
    if (!currentUser) return
    setSubmittingPollId(pollId)
    setActionError(null)
    try {
      const response = await fetch(`/api/leagues/${slug}/polls/${pollId}/vote`, {
        method: 'DELETE'
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove vote')
      }

      await fetchPolls()
    } catch (err: any) {
      console.error('Retract vote error:', err)
      setActionError(err.message || 'Failed to remove vote')
    } finally {
      setSubmittingPollId(null)
    }
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-6">
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center text-gray-600">
            <RefreshCw className="h-4 w-4 animate-spin mr-2" />
            Loading community polls...
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return null
  }

  if (polls.length === 0) {
    return null
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 my-6">
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center">
            <Vote className="h-5 w-5 text-black mr-2" />
            <div>
              <h2 className="text-xl font-bold text-black">Community Polls</h2>
              <p className="text-sm text-gray-600 mt-1">
                Cast your vote on what the league thinks
              </p>
            </div>
          </div>
        </div>

        {actionError && (
          <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2">
            {actionError}
          </div>
        )}

        <div className="divide-y divide-gray-100">
          {polls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              currentUser={currentUser}
              submitting={submittingPollId === poll.id}
              onVote={(optionId) => submitVote(poll.id, optionId)}
              onRetract={() => retractVote(poll.id)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PollCard({
  poll,
  currentUser,
  submitting,
  onVote,
  onRetract
}: {
  poll: Poll
  currentUser: any
  submitting: boolean
  onVote: (optionId: string) => void
  onRetract: () => void
}) {
  const isClosed = poll.status === 'closed'
  const hasVoted = !!poll.my_option_id
  const canVote = !isClosed && !hasVoted && !!currentUser
  const totalVotes = poll.total_votes
  const [expanded, setExpanded] = useState(false)

  const sortedOptions = [...poll.options].sort((a, b) => {
    if (b.vote_count !== a.vote_count) return b.vote_count - a.vote_count
    return a.display_order - b.display_order
  })

  const myOptionIndex = poll.my_option_id
    ? sortedOptions.findIndex((o) => o.id === poll.my_option_id)
    : -1
  const needsExpandForMyVote =
    !expanded && myOptionIndex >= VISIBLE_OPTIONS_LIMIT

  const hasOverflow = sortedOptions.length > VISIBLE_OPTIONS_LIMIT
  const visibleOptions =
    expanded || !hasOverflow
      ? sortedOptions
      : sortedOptions.slice(0, VISIBLE_OPTIONS_LIMIT)
  const hiddenCount = sortedOptions.length - visibleOptions.length

  return (
    <div className="p-6">
      <div className="flex items-start justify-between gap-4 mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-black">{poll.title}</h3>
            <span
              className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                poll.poll_type === 'predefined_players'
                  ? 'bg-blue-50 text-blue-700 border border-blue-200'
                  : 'bg-purple-50 text-purple-700 border border-purple-200'
              }`}
            >
              {poll.poll_type === 'predefined_players' ? 'Players' : 'Custom'}
            </span>
            {isClosed && (
              <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                <Lock className="h-3 w-3 mr-1" /> Closed
              </span>
            )}
          </div>
          {poll.description && (
            <p className="text-sm text-gray-600 mt-1">{poll.description}</p>
          )}
        </div>
        <div className="text-right text-xs text-gray-500 whitespace-nowrap">
          {totalVotes} {totalVotes === 1 ? 'vote' : 'votes'}
        </div>
      </div>

      <div className="space-y-2 mt-4">
        {visibleOptions.map((option) => {
          const isSelected = poll.my_option_id === option.id
          const percent = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0

          const baseClasses = `relative w-full text-left border rounded-lg overflow-hidden transition-colors ${
            isSelected ? 'border-green-400' : 'border-gray-200'
          } ${canVote ? 'hover:border-green-300 cursor-pointer' : ''}`

          const body = (
            <>
              <div
                className={`absolute inset-y-0 left-0 ${
                  isSelected ? 'bg-green-100' : 'bg-gray-100'
                }`}
                style={{ width: `${percent}%` }}
              />
              <div className="relative flex items-center justify-between px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
                  )}
                  <span className="font-medium text-black truncate">{option.label}</span>
                </div>
                <div className="text-sm text-gray-700 font-medium ml-3 flex-shrink-0">
                  {percent}% <span className="text-gray-500">({option.vote_count})</span>
                </div>
              </div>
            </>
          )

          if (canVote) {
            return (
              <button
                key={option.id}
                onClick={() => onVote(option.id)}
                disabled={submitting}
                className={`${baseClasses} disabled:opacity-60 disabled:cursor-not-allowed`}
              >
                {body}
              </button>
            )
          }

          return (
            <div key={option.id} className={baseClasses}>
              {body}
            </div>
          )
        })}

        {hasOverflow && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="w-full inline-flex items-center justify-center gap-1 text-sm text-gray-600 hover:text-black border border-dashed border-gray-200 rounded-lg px-4 py-2 transition-colors"
          >
            {expanded ? (
              <>
                Show less <ChevronUp className="h-4 w-4" />
              </>
            ) : (
              <>
                {needsExpandForMyVote
                  ? `Show all ${sortedOptions.length} options (your vote is in here)`
                  : `Show ${hiddenCount} more option${hiddenCount === 1 ? '' : 's'}`}
                <ChevronDown className="h-4 w-4" />
              </>
            )}
          </button>
        )}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        {!currentUser ? (
          <p className="text-gray-500">Log in to cast your vote.</p>
        ) : isClosed ? (
          <p className="text-gray-500">This poll is closed.</p>
        ) : hasVoted ? (
          <button
            onClick={onRetract}
            disabled={submitting}
            className="text-gray-600 hover:text-black underline disabled:opacity-60"
          >
            Change vote
          </button>
        ) : (
          <p className="text-gray-500">Pick one option above.</p>
        )}
      </div>
    </div>
  )
}

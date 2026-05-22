import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

interface RawPollRow {
  id: string
  league_id: string
  title: string
  description: string | null
  poll_type: 'custom' | 'predefined_players'
  status: 'open' | 'closed'
  created_by: string | null
  created_at: string
  updated_at: string
  options: Array<{
    id: string
    label: string
    participant_id: string | null
    display_order: number
  }>
  votes: Array<{
    id: string
    option_id: string
    voter_email: string
  }>
}

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user } } = await supabase.auth.getUser()
    const voterEmail = user?.email || null

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const { data: polls, error: pollsError } = await supabase
      .from('league_polls')
      .select(`
        id,
        league_id,
        title,
        description,
        poll_type,
        status,
        created_by,
        created_at,
        updated_at,
        options:league_poll_options(id, label, participant_id, display_order),
        votes:league_poll_votes(id, option_id, voter_email)
      `)
      .eq('league_id', league.id)
      .order('created_at', { ascending: false })

    if (pollsError) {
      console.error('Error fetching polls:', pollsError)
      return NextResponse.json({ error: 'Failed to fetch polls' }, { status: 500 })
    }

    const formatted = ((polls as RawPollRow[]) || []).map((poll) => {
      const sortedOptions = [...(poll.options || [])].sort(
        (a, b) => a.display_order - b.display_order
      )
      const voteCounts: Record<string, number> = {}
      for (const opt of sortedOptions) voteCounts[opt.id] = 0
      let myOptionId: string | null = null
      for (const v of poll.votes || []) {
        voteCounts[v.option_id] = (voteCounts[v.option_id] || 0) + 1
        if (voterEmail && v.voter_email === voterEmail) {
          myOptionId = v.option_id
        }
      }
      const totalVotes = (poll.votes || []).length

      return {
        id: poll.id,
        title: poll.title,
        description: poll.description,
        poll_type: poll.poll_type,
        status: poll.status,
        created_by: poll.created_by,
        created_at: poll.created_at,
        total_votes: totalVotes,
        my_option_id: myOptionId,
        options: sortedOptions.map((opt) => ({
          id: opt.id,
          label: opt.label,
          participant_id: opt.participant_id,
          display_order: opt.display_order,
          vote_count: voteCounts[opt.id] || 0
        }))
      }
    })

    return NextResponse.json({ polls: formatted })
  } catch (error) {
    console.error('Error in GET polls:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const { data: admin } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    let allowed = !!admin
    if (!allowed) {
      const { data: editor } = await supabase
        .from('league_editors')
        .select('id')
        .eq('league_id', league.id)
        .eq('email', user.email)
        .single()
      allowed = !!editor
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      title,
      description,
      poll_type,
      options
    }: {
      title?: string
      description?: string | null
      poll_type?: 'custom' | 'predefined_players'
      options?: Array<{ label?: string; participant_id?: string | null }>
    } = body

    if (!title || !title.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 })
    }

    if (poll_type !== 'custom' && poll_type !== 'predefined_players') {
      return NextResponse.json({ error: 'Invalid poll type' }, { status: 400 })
    }

    if (!Array.isArray(options) || options.length < 2) {
      return NextResponse.json({ error: 'At least two options are required' }, { status: 400 })
    }

    let normalizedOptions: Array<{ label: string; participant_id: string | null }> = []

    if (poll_type === 'custom') {
      normalizedOptions = options
        .map((o) => ({
          label: (o.label || '').trim(),
          participant_id: null as string | null
        }))
        .filter((o) => o.label.length > 0)

      if (normalizedOptions.length < 2) {
        return NextResponse.json(
          { error: 'At least two non-empty option labels are required' },
          { status: 400 }
        )
      }
    } else {
      const participantIds = options
        .map((o) => o.participant_id)
        .filter((id): id is string => typeof id === 'string' && id.length > 0)

      if (participantIds.length < 2) {
        return NextResponse.json(
          { error: 'At least two players must be selected' },
          { status: 400 }
        )
      }

      const { data: participants, error: participantsError } = await supabase
        .from('participants')
        .select('id, name')
        .eq('league_id', league.id)
        .in('id', participantIds)

      if (participantsError) {
        console.error('Error verifying participants:', participantsError)
        return NextResponse.json({ error: 'Failed to validate players' }, { status: 500 })
      }

      const participantMap = new Map((participants || []).map((p) => [p.id, p.name]))
      normalizedOptions = participantIds
        .filter((id) => participantMap.has(id))
        .map((id) => ({
          label: participantMap.get(id) as string,
          participant_id: id
        }))

      if (normalizedOptions.length < 2) {
        return NextResponse.json(
          { error: 'Selected players are not valid participants in this league' },
          { status: 400 }
        )
      }
    }

    const { data: newPoll, error: insertPollError } = await supabase
      .from('league_polls')
      .insert({
        league_id: league.id,
        title: title.trim(),
        description: (description || '').trim() || null,
        poll_type,
        status: 'open',
        created_by: user.email
      })
      .select('id')
      .single()

    if (insertPollError || !newPoll) {
      console.error('Error creating poll:', insertPollError)
      return NextResponse.json({ error: 'Failed to create poll' }, { status: 500 })
    }

    const optionsRows = normalizedOptions.map((opt, index) => ({
      poll_id: newPoll.id,
      label: opt.label,
      participant_id: opt.participant_id,
      display_order: index
    }))

    const { error: insertOptionsError } = await supabase
      .from('league_poll_options')
      .insert(optionsRows)

    if (insertOptionsError) {
      console.error('Error creating poll options:', insertOptionsError)
      await supabase.from('league_polls').delete().eq('id', newPoll.id)
      return NextResponse.json({ error: 'Failed to create poll options' }, { status: 500 })
    }

    return NextResponse.json({
      message: 'Poll created successfully',
      poll_id: newPoll.id
    })
  } catch (error) {
    console.error('Error in POST polls:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { GoogleChatNotifier } from '@/lib/googleChat'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; pollId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', params.slug)
      .single()

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const { data: poll } = await supabase
      .from('league_polls')
      .select('id, league_id, status, title')
      .eq('id', params.pollId)
      .single()

    if (!poll || poll.league_id !== league.id) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    if (poll.status !== 'open') {
      return NextResponse.json({ error: 'Voting is closed for this poll' }, { status: 400 })
    }

    const { option_id } = await request.json()
    if (!option_id || typeof option_id !== 'string') {
      return NextResponse.json({ error: 'Option ID is required' }, { status: 400 })
    }

    const { data: option } = await supabase
      .from('league_poll_options')
      .select('id, poll_id, label')
      .eq('id', option_id)
      .single()

    if (!option || option.poll_id !== poll.id) {
      return NextResponse.json({ error: 'Invalid option for this poll' }, { status: 400 })
    }

    const { data: existingVote } = await supabase
      .from('league_poll_votes')
      .select('id, option_id')
      .eq('poll_id', poll.id)
      .eq('voter_email', user.email)
      .single()

    const isVoteChange = !!existingVote
    const isSameOption = existingVote?.option_id === option_id

    if (existingVote) {
      const { error: updateError } = await supabase
        .from('league_poll_votes')
        .update({
          option_id,
          voter_user_id: user.id
        })
        .eq('id', existingVote.id)

      if (updateError) {
        console.error('Error updating vote:', updateError)
        return NextResponse.json({ error: 'Failed to update vote' }, { status: 500 })
      }
    } else {
      const { error: insertError } = await supabase
        .from('league_poll_votes')
        .insert({
          poll_id: poll.id,
          option_id,
          voter_email: user.email,
          voter_user_id: user.id
        })

      if (insertError) {
        console.error('Error inserting vote:', insertError)
        return NextResponse.json({ error: 'Failed to cast vote' }, { status: 500 })
      }
    }

    if (!isSameOption) {
      try {
        const { data: chatIntegration } = await supabase
          .from('league_chat_integrations')
          .select('webhook_url, enabled')
          .eq('league_id', league.id)
          .single()

        if (chatIntegration?.enabled && chatIntegration?.webhook_url) {
          const { data: participant } = await supabase
            .from('participants')
            .select('name')
            .eq('league_id', league.id)
            .eq('email', user.email)
            .maybeSingle()

          const { count: totalVotes } = await supabase
            .from('league_poll_votes')
            .select('id', { count: 'exact', head: true })
            .eq('poll_id', poll.id)

          const appUrl =
            process.env.NEXT_PUBLIC_APP_URL || `${new URL(request.url).origin}`

          await GoogleChatNotifier.notifyNewVote(chatIntegration.webhook_url, {
            leagueName: league.name,
            pollTitle: poll.title,
            optionLabel: option.label,
            voterName: participant?.name || user.email,
            totalVotes: totalVotes ?? 0,
            isVoteChange,
            leagueSlug: params.slug,
            appUrl
          })
        }
      } catch (notifyError) {
        console.error('Failed to send vote notification:', notifyError)
      }
    }

    return NextResponse.json({ message: 'Vote recorded' })
  } catch (error) {
    console.error('Error in POST vote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; pollId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user || !user.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: league } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', params.slug)
      .single()

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const { data: poll } = await supabase
      .from('league_polls')
      .select('id, league_id, status')
      .eq('id', params.pollId)
      .single()

    if (!poll || poll.league_id !== league.id) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
    }

    if (poll.status !== 'open') {
      return NextResponse.json({ error: 'Voting is closed for this poll' }, { status: 400 })
    }

    const { error: deleteError } = await supabase
      .from('league_poll_votes')
      .delete()
      .eq('poll_id', poll.id)
      .eq('voter_email', user.email)

    if (deleteError) {
      console.error('Error removing vote:', deleteError)
      return NextResponse.json({ error: 'Failed to remove vote' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Vote removed' })
  } catch (error) {
    console.error('Error in DELETE vote:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

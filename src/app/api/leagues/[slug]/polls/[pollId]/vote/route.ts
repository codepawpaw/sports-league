import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

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

    const { option_id } = await request.json()
    if (!option_id || typeof option_id !== 'string') {
      return NextResponse.json({ error: 'Option ID is required' }, { status: 400 })
    }

    const { data: option } = await supabase
      .from('league_poll_options')
      .select('id, poll_id')
      .eq('id', option_id)
      .single()

    if (!option || option.poll_id !== poll.id) {
      return NextResponse.json({ error: 'Invalid option for this poll' }, { status: 400 })
    }

    const { data: existingVote } = await supabase
      .from('league_poll_votes')
      .select('id')
      .eq('poll_id', poll.id)
      .eq('voter_email', user.email)
      .single()

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

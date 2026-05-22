import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

export async function PATCH(
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
      .select('id, league_id')
      .eq('id', params.pollId)
      .single()

    if (!poll || poll.league_id !== league.id) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
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
    const updates: { status?: 'open' | 'closed'; title?: string; description?: string | null } = {}

    if (body.status === 'open' || body.status === 'closed') {
      updates.status = body.status
    }
    if (typeof body.title === 'string' && body.title.trim()) {
      updates.title = body.title.trim()
    }
    if (typeof body.description === 'string') {
      updates.description = body.description.trim() || null
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    const { error: updateError } = await supabase
      .from('league_polls')
      .update(updates)
      .eq('id', params.pollId)

    if (updateError) {
      console.error('Error updating poll:', updateError)
      return NextResponse.json({ error: 'Failed to update poll' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Poll updated successfully' })
  } catch (error) {
    console.error('Error in PATCH poll:', error)
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
      .select('id, league_id')
      .eq('id', params.pollId)
      .single()

    if (!poll || poll.league_id !== league.id) {
      return NextResponse.json({ error: 'Poll not found' }, { status: 404 })
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

    const { error: deleteError } = await supabase
      .from('league_polls')
      .delete()
      .eq('id', params.pollId)

    if (deleteError) {
      console.error('Error deleting poll:', deleteError)
      return NextResponse.json({ error: 'Failed to delete poll' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Poll deleted successfully' })
  } catch (error) {
    console.error('Error in DELETE poll:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

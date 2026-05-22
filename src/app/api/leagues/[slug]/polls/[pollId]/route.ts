import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export const dynamic = 'force-dynamic'
export const fetchCache = 'force-no-store'
export const revalidate = 0

async function checkAdminOrEditor(
  supabase: ReturnType<typeof createRouteHandlerClient>,
  leagueId: string,
  email: string | undefined
): Promise<boolean> {
  if (!email) return false

  const { data: admin } = await supabase
    .from('league_admins')
    .select('id')
    .eq('league_id', leagueId)
    .eq('email', email)
    .single()
  if (admin) return true

  const { data: editor } = await supabase
    .from('league_editors')
    .select('id')
    .eq('league_id', leagueId)
    .eq('email', email)
    .single()
  return !!editor
}

async function ensurePollBelongsToLeague(
  supabase: ReturnType<typeof createRouteHandlerClient>,
  pollId: string,
  slug: string
) {
  const { data: league } = await supabase
    .from('leagues')
    .select('id')
    .eq('slug', slug)
    .single()

  if (!league) return { error: 'League not found', status: 404 as const }

  const { data: poll } = await supabase
    .from('league_polls')
    .select('id, league_id')
    .eq('id', pollId)
    .single()

  if (!poll || poll.league_id !== league.id) {
    return { error: 'Poll not found', status: 404 as const }
  }

  return { league, poll }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { slug: string; pollId: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await ensurePollBelongsToLeague(supabase, params.pollId, params.slug)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const allowed = await checkAdminOrEditor(supabase, result.league.id, user.email)
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
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const result = await ensurePollBelongsToLeague(supabase, params.pollId, params.slug)
    if ('error' in result) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const allowed = await checkAdminOrEditor(supabase, result.league.id, user.email)
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

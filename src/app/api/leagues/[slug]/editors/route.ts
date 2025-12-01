import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Verify user is admin (only admins can view editors)
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all editors for this league
    const { data: editors, error: editorsError } = await supabase
      .from('league_editors')
      .select('id, email, created_at')
      .eq('league_id', league.id)
      .order('created_at', { ascending: true })

    if (editorsError) {
      return NextResponse.json({ error: 'Failed to fetch editors' }, { status: 500 })
    }

    return NextResponse.json({ editors })
  } catch (error) {
    console.error('Error fetching editors:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { email } = await request.json()

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
    }

    // Get league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Verify user is admin (only admins can add editors)
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if email is already an admin
    const { data: existingAdmin } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', email.trim())
      .single()

    if (existingAdmin) {
      return NextResponse.json({ error: 'User is already an administrator. Admins have higher privileges than editors.' }, { status: 400 })
    }

    // Check if email is already an editor
    const { data: existingEditor } = await supabase
      .from('league_editors')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', email.trim())
      .single()

    if (existingEditor) {
      return NextResponse.json({ error: 'User is already an editor' }, { status: 400 })
    }

    // Add new editor
    const { data: newEditor, error: insertError } = await supabase
      .from('league_editors')
      .insert({
        league_id: league.id,
        email: email.trim()
      })
      .select('id, email, created_at')
      .single()

    if (insertError) {
      console.error('Error adding editor:', insertError)
      return NextResponse.json({ error: 'Failed to add editor' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Editor added successfully',
      editor: newEditor
    })
  } catch (error) {
    console.error('Error adding editor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    const supabase = createRouteHandlerClient({ cookies })
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const editorId = searchParams.get('id')
    const editorEmail = searchParams.get('email')

    if (!editorId || !editorEmail) {
      return NextResponse.json({ error: 'Editor ID and email are required' }, { status: 400 })
    }

    // Get league
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id, name')
      .eq('slug', params.slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Verify user is admin (only admins can remove editors)
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Verify editor exists and belongs to this league
    const { data: targetEditor } = await supabase
      .from('league_editors')
      .select('id, email')
      .eq('id', editorId)
      .eq('league_id', league.id)
      .single()

    if (!targetEditor) {
      return NextResponse.json({ error: 'Editor not found' }, { status: 404 })
    }

    // Remove editor
    const { error: deleteError } = await supabase
      .from('league_editors')
      .delete()
      .eq('id', editorId)

    if (deleteError) {
      console.error('Error removing editor:', deleteError)
      return NextResponse.json({ error: 'Failed to remove editor' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Editor removed successfully'
    })
  } catch (error) {
    console.error('Error removing editor:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

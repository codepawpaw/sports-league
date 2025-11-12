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

    // Verify user is admin
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all admins for this league
    const { data: admins, error: adminsError } = await supabase
      .from('league_admins')
      .select('id, email, created_at')
      .eq('league_id', league.id)
      .order('created_at', { ascending: true })

    if (adminsError) {
      return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
    }

    return NextResponse.json({ admins })
  } catch (error) {
    console.error('Error fetching admins:', error)
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

    // Verify user is admin
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
      return NextResponse.json({ error: 'User is already an administrator' }, { status: 400 })
    }

    // Add new admin
    const { data: newAdmin, error: insertError } = await supabase
      .from('league_admins')
      .insert({
        league_id: league.id,
        email: email.trim()
      })
      .select('id, email, created_at')
      .single()

    if (insertError) {
      console.error('Error adding admin:', insertError)
      return NextResponse.json({ error: 'Failed to add administrator' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Administrator added successfully',
      admin: newAdmin
    })
  } catch (error) {
    console.error('Error adding admin:', error)
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
    const adminId = searchParams.get('id')
    const adminEmail = searchParams.get('email')

    if (!adminId || !adminEmail) {
      return NextResponse.json({ error: 'Admin ID and email are required' }, { status: 400 })
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

    // Verify user is admin
    const { data: adminCheck } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (!adminCheck) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Prevent self-removal
    if (adminEmail === user.email) {
      return NextResponse.json({ error: 'You cannot remove yourself as administrator' }, { status: 400 })
    }

    // Verify admin exists and belongs to this league
    const { data: targetAdmin } = await supabase
      .from('league_admins')
      .select('id, email')
      .eq('id', adminId)
      .eq('league_id', league.id)
      .single()

    if (!targetAdmin) {
      return NextResponse.json({ error: 'Administrator not found' }, { status: 404 })
    }

    // Remove admin
    const { error: deleteError } = await supabase
      .from('league_admins')
      .delete()
      .eq('id', adminId)

    if (deleteError) {
      console.error('Error removing admin:', deleteError)
      return NextResponse.json({ error: 'Failed to remove administrator' }, { status: 500 })
    }

    return NextResponse.json({ 
      message: 'Administrator removed successfully'
    })
  } catch (error) {
    console.error('Error removing admin:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

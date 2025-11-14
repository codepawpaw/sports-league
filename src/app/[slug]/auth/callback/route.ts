import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get('code')
  const slug = params.slug

  if (code) {
    const supabase = createRouteHandlerClient({ cookies })
    
    try {
      const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error('Auth error:', error)
        return NextResponse.redirect(`${requestUrl.origin}/${slug}/auth?error=auth_error`)
      }

      if (session) {
        // Check if user is admin for this league
        const { data: leagueData } = await supabase
          .from('leagues')
          .select('id')
          .eq('slug', slug)
          .single()

        if (leagueData) {
          const { data: isAdmin } = await supabase
            .from('league_admins')
            .select('id')
            .eq('league_id', leagueData.id)
            .eq('email', session.user.email)
            .single()

          if (isAdmin) {
            return NextResponse.redirect(`${requestUrl.origin}/${slug}/admin`)
          } else {
            return NextResponse.redirect(`${requestUrl.origin}/${slug}`)
          }
        }
      }
    } catch (error) {
      console.error('Callback error:', error)
      return NextResponse.redirect(`${requestUrl.origin}/${slug}/auth?error=callback_error`)
    }
  }

  // If no code or something went wrong, redirect back to auth page
  return NextResponse.redirect(`${requestUrl.origin}/${slug}/auth`)
}

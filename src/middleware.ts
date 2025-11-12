import { createMiddlewareClient } from '@supabase/auth-helpers-nextjs'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export async function middleware(req: NextRequest) {
  const res = NextResponse.next()
  const supabase = createMiddlewareClient({ req, res })
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Get the pathname
  const pathname = req.nextUrl.pathname

  // Handle admin routes - check if user is admin for the league
  if (pathname.includes('/admin')) {
    if (!session) {
      // Redirect to login if not authenticated
      const redirectUrl = req.nextUrl.clone()
      redirectUrl.pathname = '/auth/signin'
      redirectUrl.searchParams.set('redirectTo', pathname)
      return NextResponse.redirect(redirectUrl)
    }

    // Extract league slug from pathname (e.g., /wta-league/admin -> wta-league)
    const pathParts = pathname.split('/')
    const leagueSlug = pathParts[1]
    
    if (leagueSlug) {
      // Check if user is admin for this league
      const { data: league } = await supabase
        .from('leagues')
        .select('id')
        .eq('slug', leagueSlug)
        .single()

      if (league) {
        const { data: isAdmin } = await supabase
          .from('league_admins')
          .select('id')
          .eq('league_id', league.id)
          .eq('email', session.user.email)
          .single()

        if (!isAdmin) {
          // Redirect to league homepage if not admin
          const redirectUrl = req.nextUrl.clone()
          redirectUrl.pathname = `/${leagueSlug}`
          return NextResponse.redirect(redirectUrl)
        }
      }
    }
  }

  return res
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}

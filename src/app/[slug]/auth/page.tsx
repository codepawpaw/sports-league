'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ArrowLeft } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function AuthPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string
  const supabase = createSupabaseComponentClient()
  
  const [league, setLeague] = useState<{ name: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchLeague()
    
    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
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
            router.push(`/${slug}/admin`)
          } else {
            router.push(`/${slug}`)
          }
        }
      }
    })

    return () => subscription.unsubscribe()
  }, [slug, supabase, router])

  const fetchLeague = async () => {
    try {
      const { data: leagueData } = await supabase
        .from('leagues')
        .select('name')
        .eq('slug', slug)
        .single()

      if (leagueData) {
        setLeague(leagueData)
      }
    } catch (error) {
      console.error('Error fetching league:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href={`/${slug}`} className="flex items-center text-black hover:text-gray-600">
                <ArrowLeft className="h-5 w-5 mr-2" />
                <Trophy className="h-8 w-8 mr-3" />
                <span className="text-xl font-bold">
                  {league?.name || 'League'}
                </span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-4">Sign In</h1>
          <p className="text-gray-600">
            Sign in with Google to access <strong>{league?.name}</strong>
          </p>
        </div>

        <div className="card p-6">
          <Auth
            supabaseClient={supabase}
            appearance={{ 
              theme: ThemeSupa,
              style: {
                button: {
                  background: '#000000',
                  color: 'white',
                  borderRadius: '8px',
                  border: 'none',
                  padding: '12px 24px',
                  fontSize: '16px',
                  fontWeight: '500'
                },
                anchor: {
                  color: '#000000'
                }
              }
            }}
            providers={['google']}
            redirectTo={`${window.location.origin}/${slug}/auth/callback`}
            onlyThirdPartyProviders
            showLinks={false}
          />
          
          <div className="mt-6 text-center text-sm text-gray-500">
            Your Google account email will be used to identify you in the league.
          </div>
        </div>

        <div className="text-center mt-6">
          <Link href={`/${slug}`} className="text-black hover:text-gray-600">
            ← Back to league homepage
          </Link>
        </div>
      </main>
    </div>
  )
}

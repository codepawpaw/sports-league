'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'
import { Auth } from '@supabase/auth-ui-react'
import { ThemeSupa } from '@supabase/auth-ui-shared'

export default function AuthPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirectTo = searchParams.get('redirectTo') || '/'
  const supabase = createSupabaseComponentClient()

  useEffect(() => {
    // Check if user is already authenticated
    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push(redirectTo)
      }
    }
    
    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_IN' && session) {
        router.push(redirectTo)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router, redirectTo])

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center text-black hover:text-gray-600">
                <Trophy className="h-8 w-8 mr-3" />
                <span className="text-xl font-bold">Sports League Platform</span>
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
            Sign in with Google to create and manage sports leagues
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
            redirectTo={`${window.location.origin}/auth`}
            onlyThirdPartyProviders
            showLinks={false}
          />
        </div>

        <div className="text-center mt-6">
          <Link href="/" className="text-black hover:text-gray-600">
            ← Back to homepage
          </Link>
        </div>
      </main>
    </div>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus, Search, Users, Trophy, LogOut, Settings } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'

export default function HomePage() {
  const supabase = createSupabaseComponentClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [userLeagues, setUserLeagues] = useState<any[]>([])

  useEffect(() => {
    // Check initial auth state
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      setUser(session?.user || null)
      if (session?.user) {
        await fetchUserLeagues()
      } else {
        setUserLeagues([])
      }
      setLoading(false)
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      setUser(session?.user || null)
      if (session?.user) {
        await fetchUserLeagues()
      } else {
        setUserLeagues([])
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase])

  const fetchUserLeagues = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const response = await fetch('/api/user/leagues', {
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      })
      
      if (response.ok) {
        const leagues = await response.json()
        setUserLeagues(leagues)
      } else {
        setUserLeagues([])
      }
    } catch (error) {
      console.error('Error fetching user leagues:', error)
      setUserLeagues([])
    }
  }

  const handleSignOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Trophy className="h-8 w-8 text-black mr-3" />
              <h1 className="text-xl font-bold text-black">Sports League Platform</h1>
            </div>
            {!loading && (
              <div className="flex items-center gap-4">
                {user ? (
                  <>
                    <span className="text-sm text-gray-600">Welcome, {user.email}</span>
                    <button
                      onClick={handleSignOut}
                      className="flex items-center gap-2 text-gray-600 hover:text-black transition-colors"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </button>
                  </>
                ) : (
                  <Link href="/auth" className="text-black hover:text-gray-600 transition-colors">
                    Sign In
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold text-black mb-6">
            Create and Manage
            <br />
            Sports Leagues
          </h2>
          <p className="text-xl text-gray-600 mb-8 max-w-2xl mx-auto">
            The ultimate platform for organizing sports tournaments, tracking matches, and managing rankings with professional-grade tools.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            {!loading && (
              user ? (
                userLeagues.length > 0 ? (
                  <Link href={`/${userLeagues[0].slug}/admin`} className="btn-primary">
                    Go to Admin Panel
                  </Link>
                ) : (
                  <Link href="/create-league" className="btn-primary">
                    Create New League
                  </Link>
                )
              ) : (
                <Link href="/auth?redirectTo=/create-league" className="btn-primary">
                  Sign In to Create League
                </Link>
              )
            )}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search existing league..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-3 w-80 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.trim()) {
                    window.location.href = `/${searchQuery.toLowerCase().replace(/\s+/g, '-')}`
                  }
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h3 className="text-3xl font-bold text-black mb-4">
              Everything You Need for League Management
            </h3>
            <p className="text-lg text-gray-600">
              Professional tools inspired by ATP Tour standards
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold text-black mb-2">Player Management</h4>
              <p className="text-gray-600">
                Add and manage participants with ease. Track player statistics and performance.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold text-black mb-2">Match Scheduling</h4>
              <p className="text-gray-600">
                Create match schedules, set custom scoring rules, and track results in real-time.
              </p>
            </div>
            
            <div className="text-center">
              <div className="bg-black rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Search className="h-8 w-8 text-white" />
              </div>
              <h4 className="text-xl font-semibold text-black mb-2">Live Rankings</h4>
              <p className="text-gray-600">
                Automatic ranking calculations and public league pages for transparency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h3 className="text-3xl font-bold text-black mb-4">
            Ready to Start Your League?
          </h3>
          <p className="text-lg text-gray-600 mb-8">
            Join hundreds of organizers who trust our platform for their sports leagues.
          </p>
          {!loading && (
            user ? (
              userLeagues.length > 0 ? (
                <Link href={`/${userLeagues[0].slug}/admin`} className="btn-primary">
                  Manage Your League
                </Link>
              ) : (
                <Link href="/create-league" className="btn-primary">
                  Get Started Now
                </Link>
              )
            ) : (
              <Link href="/auth?redirectTo=/create-league" className="btn-primary">
                Sign In to Get Started
              </Link>
            )
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="flex items-center justify-center mb-4">
            <Trophy className="h-6 w-6 mr-2" />
            <span className="font-semibold">Sports League Platform</span>
          </div>
          <p className="text-gray-400">
            Professional sports league management made simple
          </p>
        </div>
      </footer>
    </div>
  )
}

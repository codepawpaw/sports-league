'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ArrowLeft, Plus, X, Settings } from 'lucide-react'
import { createSupabaseComponentClient } from '@/lib/supabase'

export default function CreateLeaguePage() {
  const router = useRouter()
  const supabase = createSupabaseComponentClient()
  const [loading, setLoading] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [user, setUser] = useState<any>(null)
  const [userLeagues, setUserLeagues] = useState<any[]>([])
  const [formData, setFormData] = useState({
    name: '',
    slug: '',
    description: '',
    setsPerMatch: 3
  })

  useEffect(() => {
    // Check authentication on load
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        setUser(session.user)
        await fetchUserLeagues()
      } else {
        router.push('/auth?redirectTo=/create-league')
        return
      }
      setAuthLoading(false)
    }

    checkAuth()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event: string, session: any) => {
      if (event === 'SIGNED_OUT') {
        router.push('/auth?redirectTo=/create-league')
      } else if (session) {
        setUser(session.user)
        await fetchUserLeagues()
        setAuthLoading(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [supabase, router])

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

  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
  }

  const handleNameChange = (value: string) => {
    setFormData(prev => ({
      ...prev,
      name: value,
      slug: generateSlug(value)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!user) {
      alert('Please sign in to create a league')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/leagues', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(formData),
      })

      const result = await response.json()

      if (response.ok) {
        router.push(`/${result.slug}/admin`)
      } else {
        alert(result.error || 'Failed to create league')
      }
    } catch (error) {
      console.error('Error creating league:', error)
      alert('Failed to create league')
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) {
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
              <Link href="/" className="flex items-center text-black hover:text-gray-600">
                <ArrowLeft className="h-5 w-5 mr-2" />
                <Trophy className="h-8 w-8 mr-3" />
                <span className="text-xl font-bold">Sports League Platform</span>
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-black mb-4">Create New League</h1>
          <p className="text-gray-600">
            Set up your sports league in minutes
          </p>
        </div>

        {userLeagues.length > 0 ? (
          <div className="card p-8 text-center">
            <div className="mb-6">
              <div className="bg-yellow-100 border border-yellow-300 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                <Trophy className="h-8 w-8 text-yellow-600" />
              </div>
              <h2 className="text-2xl font-bold text-black mb-2">You Already Have a League!</h2>
              <p className="text-gray-600 mb-6">
                You can only create one league per account. You already have "{userLeagues[0].name}".
              </p>
            </div>
            <div className="space-y-4">
              <Link 
                href={`/${userLeagues[0].slug}/admin`}
                className="btn-primary w-full"
              >
                Go to Admin Panel
              </Link>
              <Link 
                href={`/${userLeagues[0].slug}`}
                className="btn-outline w-full"
              >
                View League
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-6">
          <div className="card p-6">
            <h2 className="text-lg font-semibold text-black mb-4">League Information</h2>
            
            <div className="space-y-4">
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-black mb-1">
                  League Name *
                </label>
                <input
                  type="text"
                  id="name"
                  value={formData.name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  className="input-field"
                  placeholder="e.g., WTA Championships"
                  required
                />
              </div>

              <div>
                <label htmlFor="slug" className="block text-sm font-medium text-black mb-1">
                  League URL *
                </label>
                <div className="flex items-center">
                  <span className="text-gray-500 text-sm mr-2">
                    {typeof window !== 'undefined' ? window.location.origin : 'https://yoursite.com'}/
                  </span>
                  <input
                    type="text"
                    id="slug"
                    value={formData.slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                    className="input-field flex-1"
                    placeholder="wta-championships"
                    pattern="^[a-z0-9-]+$"
                    title="Only lowercase letters, numbers, and hyphens allowed"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  URL-friendly version of your league name
                </p>
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium text-black mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="input-field"
                  rows={3}
                  placeholder="Brief description of your league..."
                />
              </div>

              <div>
                <label htmlFor="setsPerMatch" className="block text-sm font-medium text-black mb-1">
                  Sets per Match *
                </label>
                <select
                  id="setsPerMatch"
                  value={formData.setsPerMatch}
                  onChange={(e) => setFormData(prev => ({ ...prev, setsPerMatch: Number(e.target.value) }))}
                  className="input-field"
                  required
                >
                  <option value={1}>Best of 1</option>
                  <option value={3}>Best of 3</option>
                  <option value={5}>Best of 5</option>
                </select>
              </div>
            </div>
          </div>

          <div className="card p-6">
            <h2 className="text-lg font-semibold text-black mb-4">League Administrator</h2>
            <p className="text-sm text-gray-600 mb-4">
              You will automatically be set as the admin for this league.
            </p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900">Admin Email:</p>
              <p className="text-sm text-gray-600">{user?.email}</p>
            </div>
          </div>

          <div className="flex gap-4">
            <Link href="/" className="btn-outline flex-1 text-center">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary flex-1 disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create League'}
            </button>
          </div>
          </form>
        )}
      </main>
    </div>
  )
}

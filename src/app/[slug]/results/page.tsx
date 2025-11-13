'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Trophy, ArrowLeft, Calendar } from 'lucide-react'

interface League {
  id: string
  name: string
}

interface Player {
  id: string
  name: string
}

interface MatchResult {
  id: string
  player1: Player
  player2: Player
  player1_score: number
  player2_score: number
  winner_id: string
  completed_at: string
}

interface ResultsData {
  league: League
  matches: MatchResult[]
  total: number
}

export default function ResultsPage() {
  const params = useParams()
  const slug = params.slug as string
  
  const [data, setData] = useState<ResultsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (slug) {
      fetchResults()
    }
  }, [slug])

  const fetchResults = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/leagues/${slug}/results`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch results')
      }

      const resultsData = await response.json()
      setData(resultsData)
    } catch (err) {
      console.error('Error fetching results:', err)
      setError('Failed to load match results')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getWinner = (match: MatchResult) => {
    return match.winner_id === match.player1.id ? match.player1 : match.player2
  }

  const getLoser = (match: MatchResult) => {
    return match.winner_id === match.player1.id ? match.player2 : match.player1
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="spinner mx-auto mb-4"></div>
          <p className="text-gray-600">Loading match results...</p>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-black mb-4">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Link href={`/${slug}`} className="btn-primary">
            Back to League
          </Link>
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
                <Trophy className="h-8 w-8" />
              </Link>
            </div>
            <div className="flex items-center gap-4">
              <Link href={`/${slug}`} className="btn-mobile">
                <ArrowLeft className="h-3 w-3 mr-1 sm:h-4 sm:w-4 sm:mr-2" />
                Back to League
              </Link>
            </div>
          </div>
        </div>
      </header>

      {/* League Title */}
      <div className="border-b border-gray-100 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-black break-words">{data.league.name}</h1>
            <h2 className="text-lg font-medium text-gray-600 mt-1">Match Results</h2>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
        <div className="mb-6">
          <div className="flex items-center mb-2">
            <Trophy className="h-6 w-6 text-black mr-2" />
            <h2 className="text-2xl font-bold text-black">Match Results</h2>
          </div>
          <p className="text-gray-600">
            {data.total} completed match{data.total !== 1 ? 'es' : ''}
          </p>
        </div>

        {data.matches.length === 0 ? (
          <div className="card">
            <div className="p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No completed matches</h3>
              <p className="text-gray-500">
                No matches have been completed in this league yet.
              </p>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-full">
                <thead>
                  <tr>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Match
                    </th>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Score
                    </th>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Winner
                    </th>
                    <th className="bg-gray-50 border-b border-gray-200 px-6 py-3 text-left text-xs font-semibold text-gray-900 uppercase tracking-wider">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.matches.map((match) => {
                    const winner = getWinner(match)
                    const loser = getLoser(match)
                    
                    return (
                      <tr key={match.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              {match.player1.name} vs {match.player2.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="text-sm">
                            <div className="font-semibold text-gray-900">
                              {match.player1_score} - {match.player2_score}
                            </div>
                            <div className="text-xs text-gray-500">
                              sets
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200">
                          <div className="text-sm">
                            <div className="font-medium text-green-600">
                              {winner.name}
                            </div>
                            <div className="text-xs text-gray-500">
                              defeated {loser.name}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 border-b border-gray-200 text-sm text-gray-500">
                          {formatDate(match.completed_at)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

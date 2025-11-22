import { Trophy, Calendar, Medal, Crown, Award } from 'lucide-react'

interface Participant {
  id: string
  name: string
  email: string | null
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  set_diff: number
  points: number
  current_rating?: number
  is_provisional?: boolean
  total_matches?: number
  winning_streak: number
}

interface Match {
  id: string
  player1: { id: string; name: string }
  player2: { id: string; name: string }
  player1_score: number | null
  player2_score: number | null
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  scheduled_at: string | null
  completed_at: string | null
}

interface TopPlayersBannerProps {
  participants: Participant[]
  upcomingMatches: Match[]
}

export default function TopPlayersBanner({ participants, upcomingMatches }: TopPlayersBannerProps) {
  const top3Players = participants.slice(0, 3)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    })
  }

  const getWinRate = (wins: number, losses: number) => {
    const total = wins + losses
    if (total === 0) return 0
    return Math.round((wins / total) * 100)
  }

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-6 w-6 text-black" />
      case 2:
        return <Medal className="h-6 w-6 text-gray-600" />
      case 3:
        return <Award className="h-6 w-6 text-gray-800" />
      default:
        return null
    }
  }

  const getRankBgColor = (rank: number) => {
    switch (rank) {
      case 1:
        return 'bg-gradient-to-r from-white to-gray-100 border-black border-2'
      case 2:
        return 'bg-gradient-to-r from-gray-100 to-gray-200 border-gray-600'
      case 3:
        return 'bg-gradient-to-r from-gray-200 to-gray-300 border-gray-700'
      default:
        return 'bg-gray-50 border-gray-400'
    }
  }

  return (
    <div className="card mb-8">
      <div className="bg-gradient-to-r from-black to-gray-800 text-white p-6">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left side - Top 3 Players */}
          <div className="lg:col-span-3">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold">🏆 Top Players</h2>
              <p className="text-gray-300">Current season leaders</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {top3Players.map((player, index) => (
                <div
                  key={player.id}
                  className={`${getRankBgColor(index + 1)} rounded-xl p-4 text-center border-2`}
                >
                  <div className="flex justify-center mb-3">
                    {getRankIcon(index + 1)}
                  </div>
                  <h3 className="font-bold text-lg text-black truncate" title={player.name}>
                    {player.name}
                  </h3>
                  <div className="text-black text-sm mt-2">
                    <div className="font-semibold">{player.wins}W - {player.losses}L</div>
                    <div>Win Rate: {getWinRate(player.wins, player.losses)}%</div>
                    {player.current_rating && (
                      <div className="mt-1 font-medium">
                        Rating: {Math.round(player.current_rating)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right side - Upcoming Matches */}
          <div className="lg:col-span-2">
            <div className="text-center mb-6">
              <h3 className="text-xl font-bold flex items-center justify-center gap-2">
                <Calendar className="h-5 w-5" />
                Upcoming Matches
              </h3>
            </div>
            <div className="space-y-3">
              {upcomingMatches.slice(0, 5).map((match) => (
                <div key={match.id} className="bg-white/10 rounded-lg p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="font-medium">
                      {match.player1.name} vs {match.player2.name}
                    </div>
                    <div className="text-gray-300 text-xs">
                      {match.scheduled_at && formatDate(match.scheduled_at)}
                    </div>
                  </div>
                </div>
              ))}
              {upcomingMatches.length === 0 && (
                <p className="text-gray-300 text-center text-sm">No upcoming matches</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

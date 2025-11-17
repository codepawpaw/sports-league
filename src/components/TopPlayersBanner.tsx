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

  // Find the player with the highest winning streak (minimum 3 wins)
  const winningStreakMonster = participants
    .filter(player => player.winning_streak >= 3)
    .sort((a, b) => b.winning_streak - a.winning_streak)[0]

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
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-bold">Top Rated Players</h2>
            </div>
            
            {top3Players.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {top3Players.map((player, index) => (
                  <div
                    key={player.id}
                    className={`${getRankBgColor(index + 1)} rounded-lg p-4 text-black`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-2xl font-bold text-gray-600">#{index + 1}</span>
                      {getRankIcon(index + 1)}
                    </div>
                    <div className="mb-2">
                      <h3 className="font-bold text-lg truncate" title={player.name}>
                        {player.name}
                      </h3>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Rating:</span>
                        <span className="font-semibold text-lg">{player.current_rating || 1200}{player.is_provisional ? '*' : ''}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Record:</span>
                        <span className="font-semibold">{player.wins}W-{player.losses}L</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Points:</span>
                        <span className="font-semibold">{player.points}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg opacity-75">No players yet</p>
              </div>
            )}
            
            {/* Winning Streak Monster Card */}
            {winningStreakMonster && (
              <div className="mt-6">
                <div className="flex items-center mb-3">
                  <h3 className="text-lg font-bold">Winning Streak Monster</h3>
                </div>
                <div className="bg-gradient-to-r from-orange-500 to-red-600 rounded-lg p-4 text-white">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-bold text-lg truncate" title={winningStreakMonster.name}>
                      {winningStreakMonster.name}
                    </h4>
                    <div className="bg-white/20 px-2 py-1 rounded-lg text-sm font-semibold">
                      {winningStreakMonster.winning_streak} Streak
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-sm">
                    <div>
                      <div className="font-semibold text-xs opacity-75 mb-1">TOTAL MATCHES</div>
                      <div className="text-lg font-bold">{winningStreakMonster.wins + winningStreakMonster.losses}</div>
                    </div>
                    <div>
                      <div className="font-semibold text-xs opacity-75 mb-1">WIN RATE</div>
                      <div className="text-lg font-bold">{getWinRate(winningStreakMonster.wins, winningStreakMonster.losses)}%</div>
                    </div>
                    <div>
                      <div className="font-semibold text-xs opacity-75 mb-1">STREAK</div>
                      <div className="text-lg font-bold">{winningStreakMonster.winning_streak}</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right side - Upcoming Matches */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              <h2 className="text-xl font-bold">Upcoming Matches</h2>
            </div>
            
            <div className="bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30">
              {upcomingMatches.length > 0 ? (
                <div className="space-y-3">
                  {upcomingMatches.slice(0, 4).map((match) => (
                    <div key={match.id} className="bg-white/30 rounded-lg p-3 border border-white/20">
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="font-semibold text-sm">
                            {match.player1.name} vs {match.player2.name}
                          </div>
                          {match.scheduled_at && (
                            <div className="text-xs opacity-75 mt-1">
                              {formatDate(match.scheduled_at)}
                            </div>
                          )}
                        </div>
                        <div className="ml-2">
                          <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${
                            match.status === 'scheduled' 
                              ? 'bg-white text-black' 
                              : 'bg-gray-200 text-black'
                          }`}>
                            {match.status === 'scheduled' ? 'Scheduled' : 'In Progress'}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="opacity-75">No upcoming matches</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

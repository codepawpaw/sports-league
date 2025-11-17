
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

interface WinningStreakChampionsProps {
  participants: Participant[]
}

export default function WinningStreakChampions({ participants }: WinningStreakChampionsProps) {
  // Filter players with winning streak of 3 or more
  const streakChampions = participants
    .filter(player => player.winning_streak >= 3)
    .sort((a, b) => b.winning_streak - a.winning_streak) // Sort by highest streak first
    .slice(0, 3) // Show top 3 streak holders

  if (streakChampions.length === 0) {
    return null // Don't render component if no one has a streak >= 3
  }

  const getPlayerInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getWinPercentage = (wins: number, totalMatches: number) => {
    if (!totalMatches || totalMatches === 0) return 0
    return Math.round((wins / totalMatches) * 100)
  }

  return (
    <div className="mb-8">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-800 text-center">Streak Legends</h2>
        <p className="text-gray-600 text-center text-sm">Players on winning streaks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {streakChampions.map((player, index) => {
          const totalMatches = player.total_matches || (player.wins + player.losses)
          const winPercentage = getWinPercentage(player.wins, totalMatches)
          
          return (
            <div
              key={player.id}
              className="relative bg-white rounded-3xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
              }}
            >
              {/* Curved header */}
              <div className="relative h-16 bg-gradient-to-r from-blue-400 to-blue-600">
                <div className="absolute inset-0 bg-white rounded-b-3xl"></div>
              </div>

              {/* Main content */}
              <div className="relative -mt-8 px-6 pb-6">
                <div className="flex items-start gap-4">
                  {/* Player Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-400 to-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg shadow-lg">
                      {getPlayerInitials(player.name)}
                    </div>
                  </div>

                  {/* Player Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-gray-800 truncate mt-2">
                      {player.name}
                    </h3>
                    
                    {/* Streak Badge */}
                    <div className="flex items-center gap-2 mt-1">
                      <div className="bg-blue-100 text-blue-800 px-2 py-1 rounded-lg text-xs font-semibold">
                        {player.winning_streak} WIN STREAK
                      </div>
                      {index === 0 && (
                        <div className="bg-yellow-100 text-yellow-800 px-2 py-1 rounded-lg text-xs font-semibold">
                          👑 TOP
                        </div>
                      )}
                    </div>

                    {/* Player details */}
                    <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                      <span className="bg-gray-100 px-2 py-1 rounded text-xs">
                        #{index + 1}
                      </span>
                      {player.current_rating && (
                        <span className="text-gray-700 font-medium">
                          {Math.round(player.current_rating)} ELO
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-3 gap-3 mt-6">
                  {/* Matches */}
                  <div className="text-center bg-gray-50 rounded-xl p-3">
                    <div className="text-sm text-gray-500 uppercase font-medium mb-1">MATCHES</div>
                    <div className="text-2xl font-bold text-gray-800">{totalMatches}</div>
                    <div className="text-xs text-green-600 font-medium">
                      {player.wins}W-{player.losses}L
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div className="text-center bg-gray-50 rounded-xl p-3">
                    <div className="text-sm text-gray-500 uppercase font-medium mb-1">WIN RATE</div>
                    <div className="text-2xl font-bold text-gray-800">{winPercentage}%</div>
                    <div className="text-xs text-blue-600 font-medium">
                      {player.sets_won} sets
                    </div>
                  </div>

                  {/* Score */}
                  <div className="text-center bg-gradient-to-br from-red-500 to-pink-600 text-white rounded-xl p-3">
                    <div className="text-xs uppercase font-medium mb-1 opacity-90">STREAK</div>
                    <div className="text-2xl font-bold">{player.winning_streak}</div>
                    <div className="text-xs font-medium opacity-90">
                      hot
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}


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
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-black text-center mb-2">Streak Legends</h2>
        <p className="text-gray-600 text-center">Players on winning streaks</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {streakChampions.map((player, index) => {
          const totalMatches = player.total_matches || (player.wins + player.losses)
          const winPercentage = getWinPercentage(player.wins, totalMatches)
          
          return (
            <div
              key={player.id}
              className="relative bg-white rounded-2xl border-2 border-gray-100 hover:border-green-500 transition-all duration-300 hover:shadow-xl overflow-hidden"
            >
              {/* Header with rank indicator */}
              <div className="relative bg-white p-6 pb-4">
                {index === 0 && (
                  <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold">
                    #1 STREAK
                  </div>
                )}
                
                {/* Player Avatar */}
                <div className="flex justify-center mb-4">
                  <div className="w-20 h-20 bg-black rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg">
                    {getPlayerInitials(player.name)}
                  </div>
                </div>

                {/* Player Info */}
                <div className="text-center">
                  <h3 className="text-xl font-bold text-black mb-2">
                    {player.name}
                  </h3>
                  
                  {/* Streak Badge */}
                  <div className="inline-flex items-center bg-green-100 text-green-800 px-4 py-2 rounded-full text-sm font-bold border border-green-200">
                    {player.winning_streak} WIN STREAK
                  </div>

                  {/* Player details */}
                  <div className="flex justify-center items-center gap-3 mt-3 text-sm">
                    <span className="bg-black text-white px-3 py-1 rounded-full text-xs font-medium">
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
              <div className="bg-gray-50 p-6">
                <div className="grid grid-cols-3 gap-4">
                  {/* Matches */}
                  <div className="text-center bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-2">MATCHES</div>
                    <div className="text-xl font-bold text-black">{totalMatches}</div>
                    <div className="text-xs text-green-600 font-medium mt-1">
                      {player.wins}W-{player.losses}L
                    </div>
                  </div>

                  {/* Win Rate */}
                  <div className="text-center bg-white rounded-lg p-4 border border-gray-200">
                    <div className="text-xs text-gray-500 uppercase font-bold mb-2">WIN RATE</div>
                    <div className="text-xl font-bold text-black">{winPercentage}%</div>
                    <div className="text-xs text-gray-600 font-medium mt-1">
                      {player.sets_won} sets
                    </div>
                  </div>

                  {/* Streak Highlight */}
                  <div className="text-center bg-green-500 text-white rounded-lg p-4">
                    <div className="text-xs uppercase font-bold mb-2 opacity-90">STREAK</div>
                    <div className="text-xl font-bold">{player.winning_streak}</div>
                    <div className="text-xs font-medium mt-1 opacity-90">
                      🔥 HOT
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

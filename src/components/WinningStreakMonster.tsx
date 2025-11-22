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

interface WinningStreakMonsterProps {
  participants: Participant[]
}

export default function WinningStreakMonster({ participants }: WinningStreakMonsterProps) {
  // Find the player with the highest winning streak (minimum 3 wins)
  const winningStreakMonster = participants
    .filter(player => player.winning_streak >= 3)
    .sort((a, b) => b.winning_streak - a.winning_streak)[0]

  const getWinRate = (wins: number, losses: number) => {
    const total = wins + losses
    if (total === 0) return 0
    return Math.round((wins / total) * 100)
  }

  if (!winningStreakMonster) {
    return null
  }

  return (
    <div className="card mb-8">
      <div className="p-6">
        <div className="flex items-center justify-center mb-6">
          <h2 className="text-2xl font-bold text-black">🔥 Winning Streak Monster</h2>
        </div>
        
        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-2xl p-6 text-white border-2 border-green-400 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-green-600 font-bold text-lg shadow-lg">
                {winningStreakMonster.name.split(' ').map(word => word.charAt(0)).join('').toUpperCase().slice(0, 2)}
              </div>
              <div>
                <h3 className="font-bold text-2xl truncate" title={winningStreakMonster.name}>
                  {winningStreakMonster.name}
                </h3>
                <p className="text-green-100 text-sm">Streak Champion</p>
              </div>
            </div>
            <div className="bg-white text-green-600 px-6 py-3 rounded-full text-lg font-bold shadow-lg">
              {winningStreakMonster.winning_streak} WIN STREAK
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-white/20 rounded-xl p-4 text-center backdrop-blur-sm border border-white/30">
              <div className="font-bold text-sm mb-2 text-green-100">TOTAL MATCHES</div>
              <div className="text-3xl font-bold">{winningStreakMonster.wins + winningStreakMonster.losses}</div>
              <div className="text-sm text-green-100 mt-1">{winningStreakMonster.wins}W - {winningStreakMonster.losses}L</div>
            </div>
            
            <div className="bg-white/20 rounded-xl p-4 text-center backdrop-blur-sm border border-white/30">
              <div className="font-bold text-sm mb-2 text-green-100">WIN RATE</div>
              <div className="text-3xl font-bold">{getWinRate(winningStreakMonster.wins, winningStreakMonster.losses)}%</div>
              <div className="text-sm text-green-100 mt-1">{winningStreakMonster.sets_won} sets won</div>
            </div>
            
            <div className="bg-white text-green-600 rounded-xl p-4 text-center shadow-lg border-2 border-white">
              <div className="font-bold text-sm mb-2">CURRENT STREAK</div>
              <div className="text-3xl font-bold">{winningStreakMonster.winning_streak}</div>
              <div className="text-sm font-medium mt-1">🔥 ON FIRE</div>
            </div>
          </div>
          
          {winningStreakMonster.current_rating && (
            <div className="mt-4 text-center">
              <div className="inline-flex items-center bg-white/20 rounded-full px-4 py-2 backdrop-blur-sm border border-white/30">
                <span className="text-sm font-medium text-green-100 mr-2">Current Rating:</span>
                <span className="font-bold text-lg">{Math.round(winningStreakMonster.current_rating)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

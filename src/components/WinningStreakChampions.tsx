import { Zap } from 'lucide-react'

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
    .slice(0, 5) // Show top 5 streak holders

  if (streakChampions.length === 0) {
    return null // Don't render component if no one has a streak >= 3
  }

  const getStreakIntensity = (streak: number) => {
    if (streak >= 10) return 'legendary'
    if (streak >= 7) return 'epic'
    if (streak >= 5) return 'amazing'
    return 'great'
  }

  const getStreakColors = (streak: number) => {
    if (streak >= 10) {
      return {
        background: 'bg-gradient-to-r from-purple-900 via-blue-900 to-purple-900',
        border: 'border-purple-300',
        text: 'text-purple-100',
        accent: 'text-purple-200'
      }
    }
    if (streak >= 7) {
      return {
        background: 'bg-gradient-to-r from-blue-800 via-indigo-800 to-blue-800',
        border: 'border-blue-300',
        text: 'text-blue-100',
        accent: 'text-blue-200'
      }
    }
    if (streak >= 5) {
      return {
        background: 'bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-700',
        border: 'border-indigo-300',
        text: 'text-indigo-100',
        accent: 'text-indigo-200'
      }
    }
    return {
      background: 'bg-gradient-to-r from-blue-600 via-cyan-600 to-blue-600',
      border: 'border-cyan-300',
      text: 'text-cyan-100',
      accent: 'text-cyan-200'
    }
  }

  const getStreakTitle = (streak: number) => {
    if (streak >= 10) return 'LEGENDARY DOMINATION'
    if (streak >= 7) return 'EPIC DESTROYER'
    if (streak >= 5) return 'AMAZING FORCE'
    return 'UNSTOPPABLE'
  }

  return (
    <div className="card mb-8">
      <div className="bg-gradient-to-r from-gray-900 via-black to-gray-900 text-white p-6">
        <div className="text-center mb-6">
          <div className="flex items-center justify-center mb-2">
            <Zap className="h-8 w-8 text-yellow-400 mr-2 animate-pulse" />
            <h2 className="text-3xl font-black tracking-wide">STREAK LEGENDS</h2>
            <Zap className="h-8 w-8 text-yellow-400 ml-2 animate-pulse" />
          </div>
          <p className="text-gray-300 text-lg font-semibold">
            UNSTOPPABLE FORCES ON THE RAMPAGE
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {streakChampions.map((player, index) => {
            const colors = getStreakColors(player.winning_streak)
            const intensity = getStreakIntensity(player.winning_streak)
            const title = getStreakTitle(player.winning_streak)
            
            return (
              <div
                key={player.id}
                className={`${colors.background} ${colors.border} border-2 rounded-lg p-4 relative overflow-hidden shadow-2xl transform hover:scale-105 transition-all duration-300`}
              >
                {/* Lightning bolt decorations */}
                <div className="absolute top-2 left-2">
                  <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
                </div>
                <div className="absolute top-2 right-2">
                  <Zap className="h-4 w-4 text-yellow-400 animate-pulse" />
                </div>
                <div className="absolute bottom-2 left-2">
                  <Zap className="h-4 w-4 text-yellow-300 animate-pulse" />
                </div>
                <div className="absolute bottom-2 right-2">
                  <Zap className="h-4 w-4 text-yellow-300 animate-pulse" />
                </div>

                <div className="text-center relative z-10">
                  {/* Rank indicator */}
                  <div className="flex justify-between items-start mb-3">
                    <span className={`text-sm font-bold ${colors.accent}`}>#{index + 1}</span>
                    <span className={`text-xs font-bold ${colors.accent} uppercase tracking-wider`}>
                      {title}
                    </span>
                  </div>

                  {/* Main streak number */}
                  <div className="mb-3">
                    <div className="flex items-center justify-center mb-1">
                      <Zap className="h-6 w-6 text-yellow-400 mr-1" />
                      <span className="text-5xl font-black text-yellow-400 drop-shadow-lg">
                        {player.winning_streak}
                      </span>
                      <Zap className="h-6 w-6 text-yellow-400 ml-1" />
                    </div>
                    <p className={`text-xs font-bold ${colors.text} uppercase tracking-widest`}>
                      WIN STREAK
                    </p>
                  </div>

                  {/* Player name */}
                  <div className="mb-2">
                    <h3 className={`font-bold text-lg ${colors.text} truncate`} title={player.name}>
                      {player.name}
                    </h3>
                  </div>

                  {/* Stats */}
                  <div className={`text-sm ${colors.accent} space-y-1`}>
                    <div className="flex justify-between">
                      <span>Record:</span>
                      <span className="font-bold">{player.wins}W-{player.losses}L</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Rating:</span>
                      <span className="font-bold">{player.current_rating || 1200}</span>
                    </div>
                  </div>
                </div>

                {/* Pulsing glow effect */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-10 animate-pulse"></div>
              </div>
            )
          })}
        </div>

        {/* Footer message */}
        <div className="text-center mt-6">
          <div className="flex items-center justify-center">
            <Zap className="h-5 w-5 text-yellow-400 mr-2" />
            <p className="text-gray-300 text-sm font-semibold uppercase tracking-wide">
              {streakChampions.length === 1 
                ? 'ONE WARRIOR STANDS SUPREME' 
                : `${streakChampions.length} WARRIORS UNLEASHED`}
            </p>
            <Zap className="h-5 w-5 text-yellow-400 ml-2" />
          </div>
        </div>
      </div>
    </div>
  )
}

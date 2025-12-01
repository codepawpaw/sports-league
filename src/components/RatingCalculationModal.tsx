'use client'

import { X, Calculator, Star, Award, TrendingUp } from 'lucide-react'

interface RatingCalculationModalProps {
  isOpen: boolean
  onClose: () => void
  currentTournament?: {
    id: string
    name: string
    tournament_type?: string
    settings?: any
  } | null
}

export default function RatingCalculationModal({ isOpen, onClose, currentTournament }: RatingCalculationModalProps) {
  if (!isOpen) return null

  const isUSATTSystem = currentTournament?.settings?.rating_system === 'usatt' || !currentTournament?.settings?.rating_system
  const isEloSystem = currentTournament?.settings?.rating_system === 'elo'
  const isCustomSystem = currentTournament?.settings?.rating_system === 'custom'

  const pointExchangeTable = [
    { ratingDiff: '0-12 points', expected: '8 points', upset: '8 points' },
    { ratingDiff: '13-37 points', expected: '7 points', upset: '10 points' },
    { ratingDiff: '38-62 points', expected: '6 points', upset: '13 points' },
    { ratingDiff: '63-87 points', expected: '5 points', upset: '16 points' },
    { ratingDiff: '88-112 points', expected: '4 points', upset: '20 points' },
    { ratingDiff: '113-137 points', expected: '3 points', upset: '25 points' },
    { ratingDiff: '138-162 points', expected: '2 points', upset: '30 points' },
    { ratingDiff: '163-187 points', expected: '2 points', upset: '35 points' },
    { ratingDiff: '188-212 points', expected: '1 point', upset: '40 points' },
    { ratingDiff: '213-237 points', expected: '1 point', upset: '45 points' },
    { ratingDiff: '238+ points', expected: '0 points', upset: '50 points' }
  ]

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-50 rounded-lg border-2 border-gray-200 max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-black flex items-center gap-2">
              <Calculator className="h-6 w-6 text-green-600" />
              Rating Calculation Formula
            </h2>
            <p className="text-gray-600 text-sm mt-1">
              How ratings are calculated in this tournament
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors p-1"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-80px)] p-4 space-y-4">
          {/* Tournament Info Card */}
          <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
            <div className="bg-green-600 text-white px-4 py-2">
              <h3 className="font-bold text-sm tracking-wide">TOURNAMENT SETTINGS</h3>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-sm text-gray-600 mb-1">Tournament Name</div>
                  <div className="font-medium text-black">{currentTournament?.name || 'Current Tournament'}</div>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                  <div className="text-sm text-gray-600 mb-1">Rating System</div>
                  <div className="font-medium text-black">
                    {isUSATTSystem ? 'USATT (USA Table Tennis)' : 
                     isEloSystem ? 'Elo Rating System' : 
                     isCustomSystem ? 'Custom Formula' : 'USATT (Default)'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* USATT System Explanation */}
          {isUSATTSystem && (
            <>
              {/* Overview Card */}
              <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Star className="h-4 w-4" />
                    <h3 className="font-bold text-sm tracking-wide">USATT RATING SYSTEM OVERVIEW</h3>
                  </div>
                </div>
                <div className="p-4">
                  <div className="space-y-3 text-sm">
                    <p className="text-gray-700">
                      The <strong>USATT (USA Table Tennis) Rating System</strong> is the official rating system used in competitive table tennis tournaments. 
                      It uses a sophisticated 4-pass algorithm to ensure accurate and stable ratings.
                    </p>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="font-medium text-green-800 mb-2">Key Features:</div>
                      <ul className="text-green-700 text-sm space-y-1">
                        <li>• Point exchange based on rating differences</li>
                        <li>• Handles new players intelligently</li>
                        <li>• Prevents rating deflation</li>
                        <li>• More stable than Elo system</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4-Pass Algorithm Card */}
              <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" />
                    <h3 className="font-bold text-sm tracking-wide">4-PASS CALCULATION ALGORITHM</h3>
                  </div>
                </div>
                <div className="p-4">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="font-medium text-green-800 mb-2 flex items-center gap-1">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                          Pass 1: Initial Calculation
                        </div>
                        <p className="text-green-700 text-sm">
                          Processes matches for players with existing ratings using the Point Exchange Table.
                        </p>
                      </div>
                      
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="font-medium text-green-800 mb-2 flex items-center gap-1">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                          Pass 2: New Player Integration
                        </div>
                        <p className="text-green-700 text-sm">
                          Calculates initial ratings for unrated players based on opponent ratings and results.
                        </p>
                      </div>
                      
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="font-medium text-green-800 mb-2 flex items-center gap-1">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                          Pass 3: Rating Refinement
                        </div>
                        <p className="text-green-700 text-sm">
                          Applies point exchange with Pass 2 ratings and ensures rating constraints.
                        </p>
                      </div>
                      
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="font-medium text-green-800 mb-2 flex items-center gap-1">
                          <span className="w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                          Pass 4: Final Calculation
                        </div>
                        <p className="text-green-700 text-sm">
                          Final point exchange calculation with all safety constraints applied.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Point Exchange Table Card */}
              <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                <div className="bg-gray-800 text-white px-4 py-2">
                  <div className="flex items-center gap-2">
                    <Award className="h-4 w-4" />
                    <h3 className="font-bold text-sm tracking-wide">POINT EXCHANGE TABLE</h3>
                  </div>
                </div>
                <div className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="text-left py-3 px-4 font-medium text-gray-700 text-sm">Rating Difference</th>
                          <th className="text-center py-3 px-4 font-medium text-green-700 text-sm">Expected Result</th>
                          <th className="text-center py-3 px-4 font-medium text-black text-sm">Upset Result</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pointExchangeTable.map((row, index) => (
                          <tr key={index} className={index < pointExchangeTable.length - 1 ? 'border-b border-gray-100' : ''}>
                            <td className="py-2 px-4 font-medium text-black text-sm">
                              {row.ratingDiff}
                            </td>
                            <td className="py-2 px-4 text-center text-sm">
                              <span className="font-medium text-green-600">
                                {row.expected}
                              </span>
                            </td>
                            <td className="py-2 px-4 text-center text-sm">
                              <span className="font-medium text-black">
                                {row.upset}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              {/* Example Calculation Card */}
              <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
                <div className="bg-green-600 text-white px-4 py-2">
                  <h3 className="font-bold text-sm tracking-wide">EXAMPLE CALCULATION</h3>
                </div>
                <div className="p-4">
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="space-y-3 text-sm">
                      <div className="font-medium text-black mb-2">Scenario:</div>
                      <p className="text-gray-700">
                        <strong>Player A (1500 rating)</strong> beats <strong>Player B (1400 rating)</strong>
                      </p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                        <div>
                          <div className="font-medium text-gray-700 mb-1">Calculation Steps:</div>
                          <ul className="text-gray-600 space-y-1">
                            <li>• Rating difference: 100 points</li>
                            <li>• Expected result: A wins (higher rated)</li>
                            <li>• Points exchanged: 4 points (from table)</li>
                          </ul>
                        </div>
                        <div>
                          <div className="font-medium text-gray-700 mb-1">New Ratings:</div>
                          <ul className="text-gray-600 space-y-1">
                            <li>• Player A: <span className="font-medium text-green-600">1504</span> (+4)</li>
                            <li>• Player B: <span className="font-medium text-black">1396</span> (-4)</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Elo System Explanation */}
          {isEloSystem && (
            <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2">
                <h3 className="font-bold text-sm tracking-wide">ELO RATING SYSTEM</h3>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  <p className="text-gray-700 text-sm">
                    The Elo rating system is a method for calculating the relative skill levels of players. 
                    It's simpler than USATT but more volatile in rating changes.
                  </p>
                  
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                    <div className="font-medium text-black mb-2">Formula:</div>
                    <div className="font-mono text-sm bg-white border rounded p-2 text-black">
                      New Rating = Old Rating + K-Factor × (Actual Score - Expected Score)
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="font-medium text-green-800 mb-1">K-Factor</div>
                      <p className="text-green-700 text-sm">
                        Controls rating volatility. Higher K-factor = more rating change per match.
                        Default: {currentTournament?.settings?.k_factor || '32'}
                      </p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                      <div className="font-medium text-green-800 mb-1">Expected Score</div>
                      <p className="text-green-700 text-sm">
                        Calculated using rating difference. Higher rated player has higher expected score.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Custom System Explanation */}
          {isCustomSystem && (
            <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
              <div className="bg-gray-800 text-white px-4 py-2">
                <h3 className="font-bold text-sm tracking-wide">CUSTOM RATING SYSTEM</h3>
              </div>
              <div className="p-4">
                <div className="space-y-4">
                  <p className="text-gray-700 text-sm">
                    This tournament uses a custom rating formula with the following settings:
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="font-medium text-black mb-1">Upset Bonus</div>
                      <p className="text-gray-600 text-sm">
                        {currentTournament?.settings?.custom_rules?.upset_bonus || '5'} extra points for beating higher-rated players
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="font-medium text-black mb-1">Expected Penalty</div>
                      <p className="text-gray-600 text-sm">
                        {currentTournament?.settings?.custom_rules?.expected_penalty || '3'} points lost for expected results
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="font-medium text-black mb-1">Min Rating Change</div>
                      <p className="text-gray-600 text-sm">
                        {currentTournament?.settings?.custom_rules?.min_rating_change || '1'} minimum points per match
                      </p>
                    </div>
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                      <div className="font-medium text-black mb-1">Max Rating Change</div>
                      <p className="text-gray-600 text-sm">
                        {currentTournament?.settings?.custom_rules?.max_rating_change || '50'} maximum points per match
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* General Information Card */}
          <div className="bg-white rounded-lg border-2 border-gray-200 overflow-hidden">
            <div className="bg-gray-800 text-white px-4 py-2">
              <h3 className="font-bold text-sm tracking-wide">IMPORTANT NOTES</h3>
            </div>
            <div className="p-4">
              <div className="space-y-3 text-sm text-gray-700">
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-black mb-1">Rating Updates</div>
                  <p>Ratings are recalculated after each completed match in chronological order.</p>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-black mb-1">Provisional Ratings</div>
                  <p>New players start with provisional ratings until they complete enough matches to establish their rating.</p>
                </div>
                
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-black mb-1">Rating Bounds</div>
                  <p>
                    Ratings are bounded between {currentTournament?.settings?.rating_floor || '100'} (minimum) 
                    and {currentTournament?.settings?.rating_ceiling || '3000'} (maximum).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

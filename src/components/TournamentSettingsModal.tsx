'use client'

import { useState, useEffect } from 'react'
import { X, Save, Settings, Calculator, Info, HelpCircle } from 'lucide-react'

interface Tournament {
  id: string
  league_id: string
  name: string
  slug: string
  description: string | null
  tournament_type: 'round_robin' | 'table_system' | 'exhibition' | 'single_elimination' | 'double_elimination'
  status: 'upcoming' | 'active' | 'completed' | 'cancelled'
  settings: any
}

interface TournamentRatingSettings {
  rating_system: 'usatt' | 'elo' | 'custom'
  initial_rating: number
  provisional_threshold: number
  k_factor?: number // For Elo system
  rating_floor: number
  rating_ceiling: number
  point_exchange_multiplier: number
  use_tournament_isolation: boolean
  reset_ratings: boolean
  custom_rules?: {
    upset_bonus: number
    expected_penalty: number
    min_rating_change: number
    max_rating_change: number
  }
}

interface TournamentSettingsModalProps {
  tournament: Tournament | null
  isOpen: boolean
  onClose: () => void
  onSave: (tournamentId: string, settings: TournamentRatingSettings) => void
  loading?: boolean
}

const DEFAULT_SETTINGS: TournamentRatingSettings = {
  rating_system: 'usatt',
  initial_rating: 1200,
  provisional_threshold: 2,
  k_factor: 32,
  rating_floor: 100,
  rating_ceiling: 3000,
  point_exchange_multiplier: 1.0,
  use_tournament_isolation: false,
  reset_ratings: false,
  custom_rules: {
    upset_bonus: 5,
    expected_penalty: 3,
    min_rating_change: 1,
    max_rating_change: 50
  }
}

export default function TournamentSettingsModal({
  tournament,
  isOpen,
  onClose,
  onSave,
  loading = false
}: TournamentSettingsModalProps) {
  const [settings, setSettings] = useState<TournamentRatingSettings>(DEFAULT_SETTINGS)
  const [activeTab, setActiveTab] = useState<'general' | 'advanced'>('general')

  useEffect(() => {
    if (tournament) {
      // Load existing settings from tournament.settings.rating_settings or use defaults
      const existingSettings = tournament.settings?.rating_settings
      setSettings({
        ...DEFAULT_SETTINGS,
        ...existingSettings
      })
    } else {
      setSettings(DEFAULT_SETTINGS)
    }
  }, [tournament])

  const handleSave = () => {
    if (!tournament) return
    onSave(tournament.id, settings)
  }

  const handleSettingChange = (key: keyof TournamentRatingSettings, value: any) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }))
  }

  const handleCustomRuleChange = (key: keyof NonNullable<TournamentRatingSettings['custom_rules']>, value: number) => {
    setSettings(prev => ({
      ...prev,
      custom_rules: {
        ...prev.custom_rules!,
        [key]: value
      }
    }))
  }

  if (!isOpen || !tournament) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Settings className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-black">Tournament Rating Settings</h3>
              <p className="text-sm text-gray-600">{tournament.name}</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-gray-600 hover:text-black"
            disabled={loading}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200">
          <nav className="flex px-6">
            <button
              onClick={() => setActiveTab('general')}
              className={`py-4 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'general'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Calculator className="h-4 w-4 inline mr-2" />
              General Settings
            </button>
            <button
              onClick={() => setActiveTab('advanced')}
              className={`py-4 px-4 border-b-2 font-medium text-sm ${
                activeTab === 'advanced'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <HelpCircle className="h-4 w-4 inline mr-2" />
              Advanced Options
            </button>
          </nav>
        </div>

        {/* Content */}
        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Rating System Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Rating Calculation System
                </label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    { value: 'usatt', label: 'USATT System', desc: 'Official table tennis rating system' },
                    { value: 'elo', label: 'Elo Rating', desc: 'Chess-style rating system' },
                    { value: 'custom', label: 'Custom Formula', desc: 'Define your own rules' }
                  ].map((system) => (
                    <label key={system.value} className="relative">
                      <input
                        type="radio"
                        name="rating_system"
                        value={system.value}
                        checked={settings.rating_system === system.value}
                        onChange={(e) => handleSettingChange('rating_system', e.target.value as any)}
                        className="sr-only"
                        disabled={loading}
                      />
                      <div className={`p-4 border-2 rounded-lg cursor-pointer transition-colors ${
                        settings.rating_system === system.value
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}>
                        <div className="font-medium text-black">{system.label}</div>
                        <div className="text-sm text-gray-600 mt-1">{system.desc}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Basic Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Initial Rating for New Players
                  </label>
                  <input
                    type="number"
                    value={settings.initial_rating}
                    onChange={(e) => handleSettingChange('initial_rating', parseInt(e.target.value) || 1200)}
                    className="input-field"
                    min="100"
                    max="3000"
                    step="10"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Starting rating for players with no previous ratings
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Provisional Rating Threshold
                  </label>
                  <input
                    type="number"
                    value={settings.provisional_threshold}
                    onChange={(e) => handleSettingChange('provisional_threshold', parseInt(e.target.value) || 2)}
                    className="input-field"
                    min="0"
                    max="20"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Number of matches before rating becomes established
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Rating Floor
                  </label>
                  <input
                    type="number"
                    value={settings.rating_floor}
                    onChange={(e) => handleSettingChange('rating_floor', parseInt(e.target.value) || 100)}
                    className="input-field"
                    min="0"
                    max="1000"
                    step="10"
                    disabled={loading}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Rating Ceiling
                  </label>
                  <input
                    type="number"
                    value={settings.rating_ceiling}
                    onChange={(e) => handleSettingChange('rating_ceiling', parseInt(e.target.value) || 3000)}
                    className="input-field"
                    min="1500"
                    max="5000"
                    step="10"
                    disabled={loading}
                  />
                </div>

                {settings.rating_system === 'elo' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      K-Factor
                    </label>
                    <input
                      type="number"
                      value={settings.k_factor || 32}
                      onChange={(e) => handleSettingChange('k_factor', parseInt(e.target.value) || 32)}
                      className="input-field"
                      min="1"
                      max="100"
                      disabled={loading}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Higher K-factor = more volatile ratings
                    </p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Point Exchange Multiplier
                  </label>
                  <input
                    type="number"
                    value={settings.point_exchange_multiplier}
                    onChange={(e) => handleSettingChange('point_exchange_multiplier', parseFloat(e.target.value) || 1.0)}
                    className="input-field"
                    min="0.1"
                    max="5.0"
                    step="0.1"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Multiply standard point exchanges by this factor
                  </p>
                </div>
              </div>

              {/* Tournament Options */}
              <div className="space-y-4">
                <h4 className="text-md font-medium text-black">Tournament Options</h4>
                
                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.use_tournament_isolation}
                    onChange={(e) => handleSettingChange('use_tournament_isolation', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Isolate Tournament Ratings</span>
                    <p className="text-xs text-gray-500">
                      Calculate ratings separately from league ratings
                    </p>
                  </div>
                </label>

                <label className="flex items-center space-x-3">
                  <input
                    type="checkbox"
                    checked={settings.reset_ratings}
                    onChange={(e) => handleSettingChange('reset_ratings', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    disabled={loading}
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Reset All Ratings</span>
                    <p className="text-xs text-gray-500">
                      Start all participants with initial rating
                    </p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && settings.rating_system === 'custom' && (
            <div className="space-y-6">
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-2">
                  <Info className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-amber-800">Custom Rating System</h4>
                    <p className="text-sm text-amber-700 mt-1">
                      Define custom rules for rating calculations. Use with caution as improper settings can cause rating inflation or deflation.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Upset Bonus Points
                  </label>
                  <input
                    type="number"
                    value={settings.custom_rules?.upset_bonus || 5}
                    onChange={(e) => handleCustomRuleChange('upset_bonus', parseInt(e.target.value) || 5)}
                    className="input-field"
                    min="0"
                    max="100"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Extra points for beating higher-rated players
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Expected Result Penalty
                  </label>
                  <input
                    type="number"
                    value={settings.custom_rules?.expected_penalty || 3}
                    onChange={(e) => handleCustomRuleChange('expected_penalty', parseInt(e.target.value) || 3)}
                    className="input-field"
                    min="0"
                    max="50"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Points lost for expected wins/losses
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Minimum Rating Change
                  </label>
                  <input
                    type="number"
                    value={settings.custom_rules?.min_rating_change || 1}
                    onChange={(e) => handleCustomRuleChange('min_rating_change', parseInt(e.target.value) || 1)}
                    className="input-field"
                    min="0"
                    max="20"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum points exchanged per match
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Maximum Rating Change
                  </label>
                  <input
                    type="number"
                    value={settings.custom_rules?.max_rating_change || 50}
                    onChange={(e) => handleCustomRuleChange('max_rating_change', parseInt(e.target.value) || 50)}
                    className="input-field"
                    min="10"
                    max="200"
                    disabled={loading}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum points exchanged per match
                  </p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'advanced' && settings.rating_system !== 'custom' && (
            <div className="text-center py-8">
              <Settings className="h-12 w-12 mx-auto text-gray-300 mb-4" />
              <h4 className="text-lg font-medium text-gray-900 mb-2">No Advanced Settings</h4>
              <p className="text-gray-500">
                Advanced options are only available for custom rating systems.
                Switch to "Custom Formula" in General Settings to access these options.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-6 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            Changes will apply to future rating calculations
          </div>
          <div className="flex gap-3">
            <button 
              onClick={onClose}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              onClick={handleSave}
              className="btn-primary"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Settings
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

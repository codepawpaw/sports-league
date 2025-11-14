'use client'

import { useState, useEffect } from 'react'
import { Check, Clock, UserPlus, LogIn } from 'lucide-react'
import Link from 'next/link'

interface ClaimStatus {
  status: 'none' | 'pending' | 'claimed'
  canClaim: boolean
}

interface UserClaimInfo {
  hasClaim: boolean
  claim?: {
    id: string
    player_id: string
    status: string
    player: {
      id: string
      name: string
      email?: string
    }
  } | null
}

interface PlayerClaimButtonProps {
  player: {
    id: string
    name: string
    email?: string | null
  } | null
  slug: string
  currentUserEmail: string | null
  onClaimClick: (player: { id: string; name: string }) => void
  refreshTrigger?: number
  userClaimInfo?: UserClaimInfo | null
}

export default function PlayerClaimButton({
  player,
  slug,
  currentUserEmail,
  onClaimClick,
  refreshTrigger = 0,
  userClaimInfo = null
}: PlayerClaimButtonProps) {
  const [claimStatus, setClaimStatus] = useState<ClaimStatus>({
    status: 'none',
    canClaim: true
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (player?.id) {
      checkClaimStatus()
    }
  }, [player?.id, slug, refreshTrigger])

  const checkClaimStatus = async () => {
    if (!player) return
    
    // If player already has an email, they're claimed
    if (player.email) {
      setClaimStatus({ status: 'claimed', canClaim: false })
      return
    }

    // Check if this specific player has a pending claim
    // For now, we'll assume no pending claims unless we implement a public endpoint
    // to check claim status. This keeps it simple for the initial implementation.
    setClaimStatus({ status: 'none', canClaim: true })
  }

  const handleClaimClick = () => {
    if (!currentUserEmail || !player) {
      // User not logged in or player not loaded - this will be handled by the UI showing login link
      return
    }
    
    onClaimClick({ id: player.id, name: player.name })
  }

  if (loading || !player) {
    return (
      <div className="flex items-center justify-center w-20 h-8">
        <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-300 border-t-gray-600"></div>
      </div>
    )
  }

  // Player already claimed
  if (claimStatus.status === 'claimed') {
    return (
      <div className="flex items-center text-green-700 bg-green-50 px-3 py-1 rounded-md text-xs border border-green-200">
        <Check className="h-3 w-3 mr-1" />
        <span>Claimed</span>
      </div>
    )
  }

  // Pending claim
  if (claimStatus.status === 'pending') {
    return (
      <div className="flex items-center text-yellow-700 bg-yellow-50 px-3 py-1 rounded-md text-xs border border-yellow-200">
        <Clock className="h-3 w-3 mr-1" />
        <span>Pending</span>
      </div>
    )
  }

  // User not logged in
  if (!currentUserEmail) {
    return (
      <Link
        href={`/${slug}/auth`}
        className="flex items-center text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1 rounded-md text-xs border border-blue-200 transition-colors"
      >
        <LogIn className="h-3 w-3 mr-1" />
        <span>Sign In</span>
      </Link>
    )
  }

  // Check if user already has a claim in this league
  if (userClaimInfo?.hasClaim) {
    const userClaim = userClaimInfo.claim
    
    // If this is the player the user has claimed
    if (userClaim && userClaim.player_id === player.id) {
      if (userClaim.status === 'pending') {
        return (
          <div className="flex items-center text-yellow-700 bg-yellow-50 px-3 py-1 rounded-md text-xs border border-yellow-200">
            <Clock className="h-3 w-3 mr-1" />
            <span>Pending</span>
          </div>
        )
      } else if (userClaim.status === 'approved') {
        return (
          <div className="flex items-center text-green-700 bg-green-50 px-3 py-1 rounded-md text-xs border border-green-200">
            <Check className="h-3 w-3 mr-1" />
            <span>Your Player</span>
          </div>
        )
      }
    } else {
      // User has claimed a different player, so they can't claim this one
      return (
        <div className="flex items-center text-gray-500 bg-gray-100 px-3 py-1 rounded-md text-xs border border-gray-300">
          <span>Already Claimed {userClaim?.player.name}</span>
        </div>
      )
    }
  }

  // Available to register as
  return (
    <button
      onClick={handleClaimClick}
      className="flex items-center text-gray-700 bg-gray-50 hover:bg-gray-100 px-3 py-1 rounded-md text-xs border border-gray-200 transition-colors"
    >
      <UserPlus className="h-3 w-3 mr-1" />
      <span>Register as Player</span>
    </button>
  )
}

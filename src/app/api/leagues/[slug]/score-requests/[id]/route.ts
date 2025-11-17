import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase'
import { GoogleChatNotifier, MatchCompletionData } from '@/lib/googleChat'
import { USATTRatingCalculator, MatchResult, PlayerRating } from '@/lib/usatt-rating-calculator'

export async function DELETE(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { slug, id } = params
    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Get user's participant record
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'You are not a participant in this league' }, { status: 403 })
    }

    // Get score request and verify user is the requester
    const { data: scoreRequest, error: requestError } = await supabase
      .from('match_score_requests')
      .select(`
        *,
        match:matches(id, league_id)
      `)
      .eq('id', id)
      .single()

    if (requestError || !scoreRequest) {
      return NextResponse.json({ error: 'Score request not found' }, { status: 404 })
    }

    // Verify the request is for this league
    if (scoreRequest.match?.league_id !== league.id) {
      return NextResponse.json({ error: 'Score request not found in this league' }, { status: 404 })
    }

    // Verify user is the requester (can only delete their own requests)
    if (scoreRequest.requester_id !== participant.id) {
      return NextResponse.json({ error: 'You can only delete your own score requests' }, { status: 403 })
    }

    // Verify request is still pending (can only delete pending requests)
    if (scoreRequest.status !== 'pending') {
      return NextResponse.json({ error: 'You can only delete pending score requests' }, { status: 400 })
    }

    // Delete the request
    const { error: deleteError } = await supabase
      .from('match_score_requests')
      .delete()
      .eq('id', id)

    if (deleteError) {
      console.error('Error deleting score request:', deleteError)
      return NextResponse.json({ error: 'Failed to delete score request' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      message: 'Score request deleted successfully'
    })

  } catch (error) {
    console.error('Score request delete API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { slug: string; id: string } }
) {
  try {
    const { slug, id } = params
    const supabase = createSupabaseServerClient()

    // Get current user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    
    if (userError || !user) {
      return NextResponse.json({ error: 'User not authenticated' }, { status: 401 })
    }

    // Get request body
    const body = await request.json()
    const { action } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be "approve" or "reject"' }, { status: 400 })
    }

    // Get league info
    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    // Get user's participant record
    const { data: participant, error: participantError } = await supabase
      .from('participants')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', user.email)
      .single()

    if (participantError || !participant) {
      return NextResponse.json({ error: 'You are not a participant in this league' }, { status: 403 })
    }

    // Get score request and verify user is the opponent
    const { data: scoreRequest, error: requestError } = await supabase
      .from('match_score_requests')
      .select(`
        *,
        match:matches(id, league_id)
      `)
      .eq('id', id)
      .single()

    if (requestError || !scoreRequest) {
      return NextResponse.json({ error: 'Score request not found' }, { status: 404 })
    }

    // Verify the request is for this league
    if (scoreRequest.match?.league_id !== league.id) {
      return NextResponse.json({ error: 'Score request not found in this league' }, { status: 404 })
    }

    // Verify user is the opponent (recipient) of the request
    if (scoreRequest.opponent_id !== participant.id) {
      return NextResponse.json({ error: 'You are not authorized to respond to this request' }, { status: 403 })
    }

    // Verify request is still pending
    if (scoreRequest.status !== 'pending') {
      return NextResponse.json({ error: 'This request has already been responded to' }, { status: 400 })
    }

    // If approved, update the match with final scores and complete it
    if (action === 'approve') {
      // Update the match with scores, mark as completed, and set completion timestamp
      const completedAt = new Date().toISOString()
      const { error: matchUpdateError } = await supabase
        .from('matches')
        .update({
          player1_score: scoreRequest.player1_score,
          player2_score: scoreRequest.player2_score,
          status: 'completed',
          completed_at: completedAt
        })
        .eq('id', scoreRequest.match_id)

      if (matchUpdateError) {
        console.error('Error updating match scores:', matchUpdateError)
        return NextResponse.json({ 
          error: 'Failed to update match scores' 
        }, { status: 500 })
      }

      // Update player ratings after match completion
      try {
        // Get current player ratings for the two players involved
        const { data: existingRatings, error: ratingsError } = await supabase
          .from('player_ratings')
          .select('player_id, current_rating, matches_played, is_provisional')
          .eq('league_id', league.id)
          .in('player_id', [scoreRequest.requester_id, scoreRequest.opponent_id])

        if (!ratingsError) {
          // Initialize ratings for both players
          const playerRatings = new Map<string, PlayerRating>()
          
          // Player 1 (requester)
          const requesterRating = existingRatings?.find(r => r.player_id === scoreRequest.requester_id)
          playerRatings.set(scoreRequest.requester_id, {
            player_id: scoreRequest.requester_id,
            current_rating: requesterRating?.current_rating || 1200,
            matches_played: requesterRating?.matches_played || 0,
            is_provisional: requesterRating?.is_provisional !== false
          })

          // Player 2 (opponent)
          const opponentRating = existingRatings?.find(r => r.player_id === scoreRequest.opponent_id)
          playerRatings.set(scoreRequest.opponent_id, {
            player_id: scoreRequest.opponent_id,
            current_rating: opponentRating?.current_rating || 1200,
            matches_played: opponentRating?.matches_played || 0,
            is_provisional: opponentRating?.is_provisional !== false
          })

          // Create match result for rating calculation
          const matchForRating: MatchResult = {
            id: scoreRequest.match_id,
            player1_id: scoreRequest.requester_id,
            player2_id: scoreRequest.opponent_id,
            player1_score: scoreRequest.player1_score!,
            player2_score: scoreRequest.player2_score!,
            completed_at: completedAt
          }

          // Calculate new ratings
          const calculator = new USATTRatingCalculator()
          const player1CurrentRating = playerRatings.get(scoreRequest.requester_id)!.current_rating
          const player2CurrentRating = playerRatings.get(scoreRequest.opponent_id)!.current_rating
          
          const ratingResults = calculator.calculateMatchRatings(
            matchForRating,
            player1CurrentRating,
            player2CurrentRating
          )

          // Update ratings in database
          const player1Matches = (playerRatings.get(scoreRequest.requester_id)?.matches_played || 0) + 1
          const player2Matches = (playerRatings.get(scoreRequest.opponent_id)?.matches_played || 0) + 1

          const ratingUpdates = [
            {
              player_id: scoreRequest.requester_id,
              league_id: league.id,
              current_rating: ratingResults.player1NewRating,
              matches_played: player1Matches,
              is_provisional: player1Matches < 2,
              last_updated_at: new Date().toISOString()
            },
            {
              player_id: scoreRequest.opponent_id,
              league_id: league.id,
              current_rating: ratingResults.player2NewRating,
              matches_played: player2Matches,
              is_provisional: player2Matches < 2,
              last_updated_at: new Date().toISOString()
            }
          ]

          // Use upsert to update ratings
          await supabase
            .from('player_ratings')
            .upsert(ratingUpdates, {
              onConflict: 'player_id,league_id',
              ignoreDuplicates: false
            })
        }
      } catch (error) {
        console.error('Error updating ratings after match completion:', error)
        // Don't fail the request if rating update fails
      }

      // Send Google Chat notification for match completion
      try {
        // Get match details with player names and league info
        const { data: matchDetails, error: matchDetailsError } = await supabase
          .from('matches')
          .select(`
            id,
            player1_score,
            player2_score,
            player1_id,
            player2_id,
            league_id,
            season_id
          `)
          .eq('id', scoreRequest.match_id)
          .single()

        if (!matchDetailsError && matchDetails) {
          // Get player names
          const { data: playersData, error: playersError } = await supabase
            .from('participants')
            .select('id, name')
            .in('id', [matchDetails.player1_id, matchDetails.player2_id])

          // Get league info
          const { data: leagueData, error: leagueDataError } = await supabase
            .from('leagues')
            .select('id, name, slug')
            .eq('id', matchDetails.league_id)
            .single()

          // Get season info if exists
          let seasonData = null
          if (matchDetails.season_id) {
            const { data: seasonResult, error: seasonError } = await supabase
              .from('seasons')
              .select('id, name')
              .eq('id', matchDetails.season_id)
              .single()
            
            if (!seasonError) seasonData = seasonResult
          }

          // Get chat integration settings
          const { data: chatIntegration, error: chatError } = await supabase
            .from('league_chat_integrations')
            .select('webhook_url, enabled, notify_match_completions')
            .eq('league_id', league.id)
            .eq('enabled', true)
            .eq('notify_match_completions', true)
            .single()

          if (!playersError && playersData && !leagueDataError && leagueData && !chatError && chatIntegration) {
            // Map players by ID
            const playersMap = playersData.reduce((acc, player) => {
              acc[player.id] = player
              return acc
            }, {} as Record<string, { id: string; name: string }>)

            // Determine winner
            const player1Score = scoreRequest.player1_score!
            const player2Score = scoreRequest.player2_score!
            const player1Name = playersMap[matchDetails.player1_id]?.name || 'Player 1'
            const player2Name = playersMap[matchDetails.player2_id]?.name || 'Player 2'
            
            let winnerName = 'Draw'
            if (player1Score > player2Score) {
              winnerName = player1Name
            } else if (player2Score > player1Score) {
              winnerName = player2Name
            }

            const notificationData: MatchCompletionData = {
              leagueName: leagueData.name,
              seasonName: seasonData?.name,
              player1Name: player1Name,
              player2Name: player2Name,
              player1Score: player1Score,
              player2Score: player2Score,
              winnerName: winnerName,
              completedAt: completedAt,
              leagueSlug: slug,
              appUrl: process.env.NEXT_PUBLIC_APP_URL || 'https://app.example.com'
            }

            // Send notification (don't block the response if it fails)
            GoogleChatNotifier.notifyMatchCompleted(chatIntegration.webhook_url, notificationData)
              .catch(error => console.error('Failed to send match completion notification:', error))
          }
        }
      } catch (error) {
        console.error('Error sending Google Chat notification:', error)
        // Don't fail the request if notification fails
      }

      // Delete the approved score request
      const { error: deleteError } = await supabase
        .from('match_score_requests')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('Error deleting approved score request:', deleteError)
        return NextResponse.json({ 
          error: 'Failed to delete approved request' 
        }, { status: 500 })
      }

      return NextResponse.json({ 
        success: true,
        action: action,
        message: 'Score request approved and match completed'
      })
    }

    // For rejected requests, update status
    const { data: updatedRequest, error: updateError } = await supabase
      .from('match_score_requests')
      .update({
        status: 'rejected',
        reviewed_at: new Date().toISOString(),
        reviewed_by: user.email
      })
      .eq('id', id)
      .select(`
        *,
        requester:participants!match_score_requests_requester_id_fkey(id, name),
        opponent:participants!match_score_requests_opponent_id_fkey(id, name),
        match:matches(
          id,
          player1:participants!matches_player1_id_fkey(id, name),
          player2:participants!matches_player2_id_fkey(id, name)
        )
      `)
      .single()

    if (updateError) {
      console.error('Error updating score request:', updateError)
      return NextResponse.json({ error: 'Failed to update score request' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true,
      score_request: updatedRequest,
      action: action
    })

  } catch (error) {
    console.error('Score request response API error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

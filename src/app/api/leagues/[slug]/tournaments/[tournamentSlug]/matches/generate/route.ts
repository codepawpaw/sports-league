import { createSupabaseServerClient } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

type TournamentType =
  | 'round_robin'
  | 'table_system'
  | 'exhibition'
  | 'single_elimination'
  | 'double_elimination'

interface Participant {
  id: string
  name: string
  seed_position: number | null
}

interface MatchPair {
  player1_id: string
  player2_id: string
}

export async function POST(
  request: NextRequest,
  { params }: { params: { slug: string; tournamentSlug: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const { slug, tournamentSlug } = params

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }

    const { data: league, error: leagueError } = await supabase
      .from('leagues')
      .select('id')
      .eq('slug', slug)
      .single()

    if (leagueError || !league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 })
    }

    const { data: adminData } = await supabase
      .from('league_admins')
      .select('id')
      .eq('league_id', league.id)
      .eq('email', session.user.email)
      .single()

    if (!adminData) {
      return NextResponse.json(
        { error: 'Unauthorized - Admin access required' },
        { status: 403 }
      )
    }

    const { data: tournament, error: tournamentError } = await supabase
      .from('tournaments')
      .select('id, tournament_type')
      .eq('league_id', league.id)
      .eq('slug', tournamentSlug)
      .single()

    if (tournamentError || !tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 })
    }

    const body = await request.json().catch(() => ({}))
    const clearExisting: boolean = Boolean(body?.clearExisting)

    const { data: tParticipantsRaw, error: participantsError } = await supabase
      .from('tournament_participants')
      .select(`
        seed_position,
        participants:participant_id ( id, name )
      `)
      .eq('tournament_id', tournament.id)
      .order('seed_position', { ascending: true, nullsFirst: false })

    if (participantsError) {
      console.error('Error fetching tournament participants:', participantsError)
      return NextResponse.json(
        { error: 'Failed to fetch tournament participants' },
        { status: 500 }
      )
    }

    const participants: Participant[] = (tParticipantsRaw || [])
      .map((row: any) => ({
        id: row.participants?.id,
        name: row.participants?.name,
        seed_position: row.seed_position ?? null,
      }))
      .filter((p) => p.id)

    if (participants.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 participants are required to generate matches' },
        { status: 400 }
      )
    }

    if (clearExisting) {
      const { error: deleteError } = await supabase
        .from('matches')
        .delete()
        .eq('tournament_id', tournament.id)

      if (deleteError) {
        console.error('Error clearing tournament matches:', deleteError)
        return NextResponse.json(
          { error: 'Failed to clear existing matches' },
          { status: 500 }
        )
      }
    }

    const { data: existingMatches } = await supabase
      .from('matches')
      .select('player1_id, player2_id')
      .eq('tournament_id', tournament.id)

    const tournamentType = tournament.tournament_type as TournamentType
    const generated = generateMatchesForType(tournamentType, participants)

    const existingPairs = new Set<string>()
    for (const m of existingMatches || []) {
      existingPairs.add(pairKey(m.player1_id, m.player2_id))
    }

    const newPairs = generated.filter(
      (p) => !existingPairs.has(pairKey(p.player1_id, p.player2_id))
    )

    if (newPairs.length === 0) {
      return NextResponse.json({
        success: true,
        matchesCreated: 0,
        tournamentType,
        message: 'No new matches to create. All matches for this tournament type already exist.',
      })
    }

    const inserts = newPairs.map((p) => ({
      league_id: league.id,
      tournament_id: tournament.id,
      player1_id: p.player1_id,
      player2_id: p.player2_id,
      status: 'scheduled' as const,
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('matches')
      .insert(inserts)
      .select('id')

    if (insertError) {
      console.error('Error inserting generated matches:', insertError)
      return NextResponse.json(
        { error: 'Failed to create matches' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      matchesCreated: inserted?.length || 0,
      tournamentType,
    })
  } catch (error) {
    console.error('Error in POST tournaments/[tournamentSlug]/matches/generate:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}

function generateMatchesForType(
  type: TournamentType,
  participants: Participant[]
): MatchPair[] {
  switch (type) {
    case 'round_robin':
    case 'table_system':
    case 'exhibition':
      return generateRoundRobin(participants)
    case 'single_elimination':
    case 'double_elimination':
      return generateFirstRoundBracket(participants)
    default:
      return generateRoundRobin(participants)
  }
}

function generateRoundRobin(participants: Participant[]): MatchPair[] {
  const pairs: MatchPair[] = []
  for (let i = 0; i < participants.length; i++) {
    for (let j = i + 1; j < participants.length; j++) {
      pairs.push({
        player1_id: participants[i].id,
        player2_id: participants[j].id,
      })
    }
  }
  return pairs
}

// Seeded first-round bracket: 1 vs N, 2 vs N-1, ...
// Unseeded participants are appended after seeded ones in their existing order.
// If the participant count is odd, the lowest-seeded player gets a bye (skipped).
function generateFirstRoundBracket(participants: Participant[]): MatchPair[] {
  const seeded = participants
    .filter((p) => p.seed_position != null)
    .sort((a, b) => (a.seed_position! - b.seed_position!))
  const unseeded = participants.filter((p) => p.seed_position == null)
  const ordered = [...seeded, ...unseeded]

  const pairs: MatchPair[] = []
  let left = 0
  let right = ordered.length - 1

  // If odd, the bottom seed sits out the first round.
  if (ordered.length % 2 === 1) {
    right -= 1
  }

  while (left < right) {
    pairs.push({
      player1_id: ordered[left].id,
      player2_id: ordered[right].id,
    })
    left++
    right--
  }

  return pairs
}

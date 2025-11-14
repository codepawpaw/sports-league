import { createClient } from '@supabase/supabase-js'
import { createClientComponentClient, createServerComponentClient } from '@supabase/auth-helpers-nextjs'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// For client-side usage
export const createSupabaseClient = () =>
  createClient(supabaseUrl, supabaseAnonKey)

// For client components
export const createSupabaseComponentClient = () =>
  createClientComponentClient()

// For server components
export const createSupabaseServerClient = () => {
  const { cookies } = require('next/headers')
  return createServerComponentClient({ cookies })
}

// Database types will be auto-generated
export type Database = {
  public: {
    Tables: {
      leagues: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          sets_per_match: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          sets_per_match?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          sets_per_match?: number
          created_at?: string
          updated_at?: string
        }
      }
      league_admins: {
        Row: {
          id: string
          league_id: string
          email: string
          created_at: string
        }
        Insert: {
          id?: string
          league_id: string
          email: string
          created_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          email?: string
          created_at?: string
        }
      }
      participants: {
        Row: {
          id: string
          league_id: string
          name: string
          email: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          league_id: string
          name: string
          email?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          name?: string
          email?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      matches: {
        Row: {
          id: string
          league_id: string
          player1_id: string
          player2_id: string
          player1_score: number | null
          player2_score: number | null
          status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at: string | null
          completed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          league_id: string
          player1_id: string
          player2_id: string
          player1_score?: number | null
          player2_score?: number | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          player1_id?: string
          player2_id?: string
          player1_score?: number | null
          player2_score?: number | null
          status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
          scheduled_at?: string | null
          completed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      match_sets: {
        Row: {
          id: string
          match_id: string
          set_number: number
          player1_score: number
          player2_score: number
          created_at: string
        }
        Insert: {
          id?: string
          match_id: string
          set_number: number
          player1_score: number
          player2_score: number
          created_at?: string
        }
        Update: {
          id?: string
          match_id?: string
          set_number?: number
          player1_score?: number
          player2_score?: number
          created_at?: string
        }
      }
      match_requests: {
        Row: {
          id: string
          league_id: string
          season_id: string
          requesting_player_id: string
          requested_player_id: string
          status: 'pending' | 'approved' | 'rejected'
          message: string | null
          requested_at: string
          reviewed_by_admin_id: string | null
          reviewed_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          league_id: string
          season_id: string
          requesting_player_id: string
          requested_player_id: string
          status?: 'pending' | 'approved' | 'rejected'
          message?: string | null
          requested_at?: string
          reviewed_by_admin_id?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          season_id?: string
          requesting_player_id?: string
          requested_player_id?: string
          status?: 'pending' | 'approved' | 'rejected'
          message?: string | null
          requested_at?: string
          reviewed_by_admin_id?: string | null
          reviewed_at?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      seasons: {
        Row: {
          id: string
          league_id: string
          name: string
          slug: string
          description: string | null
          is_active: boolean
          is_finished: boolean
          start_date: string | null
          end_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          league_id: string
          name: string
          slug: string
          description?: string | null
          is_active?: boolean
          is_finished?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          league_id?: string
          name?: string
          slug?: string
          description?: string | null
          is_active?: boolean
          is_finished?: boolean
          start_date?: string | null
          end_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

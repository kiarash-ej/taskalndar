// Generated from the Supabase project (herhqlqicakwqoicgbtw) with
// `supabase gen types typescript`, plus `tasks.date` from
// supabase/migrations/20261001120000_add_task_date.sql. Regenerate after schema changes.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      goal_logs: {
        Row: {
          amount: number
          date: string
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          amount: number
          date: string
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          amount?: number
          date?: string
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goal_logs_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          period: string
          target_value: number
          title: string
          unit: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          period?: string
          target_value: number
          title: string
          unit: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          period?: string
          target_value?: number
          title?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      task_completions: {
        Row: {
          date: string
          done: boolean
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          date: string
          done?: boolean
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          date?: string
          done?: boolean
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          archived_at: string | null
          created_at: string
          date: string
          id: string
          is_recurring: boolean
          title: string
          user_id: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          title: string
          user_id: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
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
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicTables = Database["public"]["Tables"]

export type Tables<T extends keyof PublicTables> = PublicTables[T]["Row"]
export type TablesInsert<T extends keyof PublicTables> = PublicTables[T]["Insert"]
export type TablesUpdate<T extends keyof PublicTables> = PublicTables[T]["Update"]

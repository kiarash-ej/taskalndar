// Generated from the Supabase project (herhqlqicakwqoicgbtw) with
// `supabase gen types typescript`, extended by hand for the committed
// ownership/history, profiles/daily_notes and weekly-schedule migrations.
// Regenerate against the project after applying those migrations.

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
      daily_notes: {
        Row: {
          body: string
          created_at: string
          day: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          day: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          day?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
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
            columns: ["goal_id", "user_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id", "user_id"]
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
          start_date: string
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
          start_date?: string
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
          start_date?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          background_kind: string
          background_value: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          background_kind?: string
          background_value?: string | null
          created_at?: string
          id: string
          updated_at?: string
        }
        Update: {
          background_kind?: string
          background_value?: string | null
          created_at?: string
          id?: string
          updated_at?: string
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
            columns: ["task_id", "user_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id", "user_id"]
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
          weekdays: number[] | null
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          title: string
          user_id: string
          weekdays?: number[] | null
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          date?: string
          id?: string
          is_recurring?: boolean
          title?: string
          user_id?: string
          weekdays?: number[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      jalali_weekday: {
        Args: { d: string }
        Returns: number
      }
      update_task_schedule: {
        Args: {
          p_task_id: string
          p_title: string
          p_is_recurring: boolean
          p_effective_date: string
          p_weekdays?: number[] | null
        }
        Returns: string
      }
      weekdays_are_canonical: {
        Args: { w: number[] }
        Returns: boolean
      }
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

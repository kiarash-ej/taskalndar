// Generated from the Supabase project (herhqlqicakwqoicgbtw) with
// `supabase gen types typescript` after applying every migration in
// supabase/migrations (2026-10-21). Regenerate after each new migration.

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
      day_template_blocks: {
        Row: {
          end_time: string
          id: string
          start_time: string
          tags: string[]
          template_id: string
          title: string
          user_id: string
        }
        Insert: {
          end_time: string
          id?: string
          start_time: string
          tags?: string[]
          template_id: string
          title: string
          user_id: string
        }
        Update: {
          end_time?: string
          id?: string
          start_time?: string
          tags?: string[]
          template_id?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "day_template_blocks_template_id_fkey"
            columns: ["template_id", "user_id"]
            isOneToOne: false
            referencedRelation: "day_templates"
            referencedColumns: ["id", "user_id"]
          },
        ]
      }
      day_templates: {
        Row: {
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
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
          start_date: string
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
          start_date?: string
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
          start_date?: string
          target_value?: number
          title?: string
          unit?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_channels: {
        Row: {
          chat_id: string | null
          created_at: string
          enabled: boolean
          id: string
          include_blocks: boolean
          include_note: boolean
          include_tasks: boolean
          kind: string
          last_sent_on: string | null
          link_code: string | null
          link_code_expires_at: string | null
          linked_at: string | null
          send_time: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          include_blocks?: boolean
          include_note?: boolean
          include_tasks?: boolean
          kind: string
          last_sent_on?: string | null
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          send_time?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          include_blocks?: boolean
          include_note?: boolean
          include_tasks?: boolean
          kind?: string
          last_sent_on?: string | null
          link_code?: string | null
          link_code_expires_at?: string | null
          linked_at?: string | null
          send_time?: string
          updated_at?: string
          user_id?: string
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
      reminder_settings: {
        Row: {
          created_at: string
          enabled: boolean
          include_sleep: boolean
          lead_minutes: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          include_sleep?: boolean
          lead_minutes?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          include_sleep?: boolean
          lead_minutes?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_proposals: {
        Row: {
          bed_at: string
          created_at: string
          night: string
          user_id: string
          wake_at: string
        }
        Insert: {
          bed_at: string
          created_at?: string
          night: string
          user_id: string
          wake_at: string
        }
        Update: {
          bed_at?: string
          created_at?: string
          night?: string
          user_id?: string
          wake_at?: string
        }
        Relationships: []
      }
      sleep_schedules: {
        Row: {
          bedtime: string
          created_at: string
          user_id: string
          wake_time: string
          weekday: number
        }
        Insert: {
          bedtime: string
          created_at?: string
          user_id: string
          wake_time: string
          weekday: number
        }
        Update: {
          bedtime?: string
          created_at?: string
          user_id?: string
          wake_time?: string
          weekday?: number
        }
        Relationships: []
      }
      sleep_settings: {
        Row: {
          created_at: string
          hook_token_hash: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hook_token_hash?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hook_token_hash?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sleep_skips: {
        Row: {
          created_at: string
          night: string
          user_id: string
        }
        Insert: {
          created_at?: string
          night: string
          user_id: string
        }
        Update: {
          created_at?: string
          night?: string
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
          replaced_by: string | null
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
          replaced_by?: string | null
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
          replaced_by?: string | null
          title?: string
          user_id?: string
          weekdays?: number[] | null
        }
        Relationships: []
      }
      time_blocks: {
        Row: {
          amount: number | null
          cost: number | null
          created_at: string
          day: string
          description: string
          done: boolean
          end_at: string
          id: string
          remind: boolean
          reminded_at: string | null
          reminder_minutes: number | null
          sleep_night: string | null
          source: string
          start_at: string
          tags: string[]
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          cost?: number | null
          created_at?: string
          day: string
          description?: string
          done?: boolean
          end_at: string
          id?: string
          remind?: boolean
          reminded_at?: string | null
          reminder_minutes?: number | null
          sleep_night?: string | null
          source?: string
          start_at: string
          tags?: string[]
          title: string
          unit?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          cost?: number | null
          created_at?: string
          day?: string
          description?: string
          done?: boolean
          end_at?: string
          id?: string
          remind?: boolean
          reminded_at?: string | null
          reminder_minutes?: number | null
          sleep_night?: string | null
          source?: string
          start_at?: string
          tags?: string[]
          title?: string
          unit?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      apply_day_template: {
        Args: { p_day: string; p_template_id: string }
        Returns: {
          amount: number | null
          cost: number | null
          created_at: string
          day: string
          description: string
          done: boolean
          end_at: string
          id: string
          remind: boolean
          reminded_at: string | null
          reminder_minutes: number | null
          sleep_night: string | null
          source: string
          start_at: string
          tags: string[]
          title: string
          unit: string | null
          updated_at: string
          user_id: string
        }[]
        SetofOptions: {
          from: "*"
          to: "time_blocks"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      claim_due_reminders: {
        Args: never
        Returns: {
          block_id: string
          end_at: string
          is_sleep: boolean
          start_at: string
          title: string
          user_id: string
        }[]
      }
      delete_future_task_chain: { Args: { p_task_id: string }; Returns: undefined }
      delete_task: { Args: { p_task_id: string }; Returns: string }
      jalali_weekday: { Args: { d: string }; Returns: number }
      link_notification_channel: {
        Args: { p_chat_id: string; p_code: string; p_kind: string }
        Returns: boolean
      }
      save_sleep_schedule: {
        Args: { p_bedtimes: string[]; p_wake_times: string[]; p_weekdays: number[] }
        Returns: undefined
      }
      set_sleep_night: {
        Args: { p_bed_at: string; p_night: string; p_user: string; p_wake_at: string }
        Returns: undefined
      }
      sleep_minutes: {
        Args: { p_bedtime: string; p_wake_time: string }
        Returns: number
      }
      sleep_night_start: {
        Args: { p_bedtime: string; p_night: string }
        Returns: string
      }
      tags_are_canonical: { Args: { t: string[] }; Returns: boolean }
      unlink_notification_chat: {
        Args: { p_chat_id: string; p_kind: string }
        Returns: number
      }
      update_task_schedule: {
        Args: {
          p_effective_date: string
          p_is_recurring: boolean
          p_task_id: string
          p_title: string
          p_weekdays?: number[]
        }
        Returns: string
      }
      user_tags: {
        Args: never
        Returns: {
          tag: string
          uses: number
        }[]
      }
      weekdays_are_canonical: { Args: { w: number[] }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

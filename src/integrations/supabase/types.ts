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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      catalog_items: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          price: number
          unit: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          name: string
          owner_user_id: string
          price?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          price?: number
          unit?: string
          updated_at?: string
        }
        Relationships: []
      }
      company_profile: {
        Row: {
          banking: Json
          billing: Json
          company: Json
          created_at: string
          density: string
          migrated_at: string | null
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          banking?: Json
          billing?: Json
          company?: Json
          created_at?: string
          density?: string
          migrated_at?: string | null
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          banking?: Json
          billing?: Json
          company?: Json
          created_at?: string
          density?: string
          migrated_at?: string | null
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          address: string | null
          created_at: string
          email: string
          id: string
          name: string
          owner_user_id: string
          phone: string
          tax_number: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          email?: string
          id: string
          name: string
          owner_user_id: string
          phone?: string
          tax_number?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          owner_user_id?: string
          phone?: string
          tax_number?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      docs: {
        Row: {
          archived: boolean
          created_at: string
          customer: Json
          day_order: number | null
          deposit_paid: boolean
          deposit_pct: number
          distance_km: number | null
          from_address: string | null
          from_coords: Json | null
          id: string
          items: Json
          notes: string | null
          number: string
          owner_user_id: string
          paid_at: string | null
          payment_method: string | null
          scheduled_date: string | null
          scheduled_end_date: string | null
          status: string
          to_address: string | null
          to_coords: Json | null
          type: string
          updated_at: string
        }
        Insert: {
          archived?: boolean
          created_at?: string
          customer?: Json
          day_order?: number | null
          deposit_paid?: boolean
          deposit_pct?: number
          distance_km?: number | null
          from_address?: string | null
          from_coords?: Json | null
          id: string
          items?: Json
          notes?: string | null
          number: string
          owner_user_id: string
          paid_at?: string | null
          payment_method?: string | null
          scheduled_date?: string | null
          scheduled_end_date?: string | null
          status?: string
          to_address?: string | null
          to_coords?: Json | null
          type: string
          updated_at?: string
        }
        Update: {
          archived?: boolean
          created_at?: string
          customer?: Json
          day_order?: number | null
          deposit_paid?: boolean
          deposit_pct?: number
          distance_km?: number | null
          from_address?: string | null
          from_coords?: Json | null
          id?: string
          items?: Json
          notes?: string | null
          number?: string
          owner_user_id?: string
          paid_at?: string | null
          payment_method?: string | null
          scheduled_date?: string | null
          scheduled_end_date?: string | null
          status?: string
          to_address?: string | null
          to_coords?: Json | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      expense_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_user_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_user_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_user_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          date: string
          description: string | null
          id: string
          linked_doc_id: string | null
          notes: string | null
          owner_user_id: string
          payment_method: string | null
          receipt_image: string | null
          updated_at: string
          vat_amount: number | null
          vendor: string
        }
        Insert: {
          amount?: number
          category?: string
          created_at?: string
          date: string
          description?: string | null
          id: string
          linked_doc_id?: string | null
          notes?: string | null
          owner_user_id: string
          payment_method?: string | null
          receipt_image?: string | null
          updated_at?: string
          vat_amount?: number | null
          vendor?: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          date?: string
          description?: string | null
          id?: string
          linked_doc_id?: string | null
          notes?: string | null
          owner_user_id?: string
          payment_method?: string | null
          receipt_image?: string | null
          updated_at?: string
          vat_amount?: number | null
          vendor?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          data: Json
          id: string
          owner_token: string
          owner_user_id: string | null
          updated_at: string
        }
        Insert: {
          data?: Json
          id?: string
          owner_token?: string
          owner_user_id?: string | null
          updated_at?: string
        }
        Update: {
          data?: Json
          id?: string
          owner_token?: string
          owner_user_id?: string | null
          updated_at?: string
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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

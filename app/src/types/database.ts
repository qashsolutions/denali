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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      appeal_levels: {
        Row: {
          created_at: string | null
          decision_timeframe: string
          description: string
          effective_date: string
          id: string
          level: number
          name: string
          success_rate: string | null
          time_limit: string
        }
        Insert: {
          created_at?: string | null
          decision_timeframe: string
          description: string
          effective_date?: string
          id?: string
          level: number
          name: string
          success_rate?: string | null
          time_limit: string
        }
        Update: {
          created_at?: string | null
          decision_timeframe?: string
          description?: string
          effective_date?: string
          id?: string
          level?: number
          name?: string
          success_rate?: string | null
          time_limit?: string
        }
        Relationships: []
      }
      appeal_outcomes: {
        Row: {
          appeal_id: string | null
          cpt_codes: string[] | null
          created_at: string | null
          days_to_resolution: number | null
          denial_reason: string | null
          documentation_gaps: string[] | null
          email: string | null
          icd10_codes: string[] | null
          id: string
          lcd_refs: string[] | null
          ncd_refs: string[] | null
          outcome: string | null
          outcome_reported_at: string | null
          phone: string | null
          successful_arguments: string[] | null
        }
        Insert: {
          appeal_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string | null
          days_to_resolution?: number | null
          denial_reason?: string | null
          documentation_gaps?: string[] | null
          email?: string | null
          icd10_codes?: string[] | null
          id?: string
          lcd_refs?: string[] | null
          ncd_refs?: string[] | null
          outcome?: string | null
          outcome_reported_at?: string | null
          phone?: string | null
          successful_arguments?: string[] | null
        }
        Update: {
          appeal_id?: string | null
          cpt_codes?: string[] | null
          created_at?: string | null
          days_to_resolution?: number | null
          denial_reason?: string | null
          documentation_gaps?: string[] | null
          email?: string | null
          icd10_codes?: string[] | null
          id?: string
          lcd_refs?: string[] | null
          ncd_refs?: string[] | null
          outcome?: string | null
          outcome_reported_at?: string | null
          phone?: string | null
          successful_arguments?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "appeal_outcomes_appeal_id_fkey"
            columns: ["appeal_id"]
            isOneToOne: false
            referencedRelation: "appeals"
            referencedColumns: ["id"]
          },
        ]
      }
      appeals: {
        Row: {
          appeal_letter: string
          carc_codes: string[] | null
          conversation_id: string
          cpt_codes: string[] | null
          created_at: string
          deadline: string | null
          denial_date: string | null
          denial_reason: string | null
          email: string | null
          icd10_codes: string[] | null
          id: string
          lcd_refs: string[] | null
          ncd_refs: string[] | null
          paid: boolean | null
          phone: string | null
          pubmed_refs: string[] | null
          rarc_codes: string[] | null
          service_description: string | null
          status: string | null
          stripe_payment_id: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          appeal_letter: string
          carc_codes?: string[] | null
          conversation_id: string
          cpt_codes?: string[] | null
          created_at?: string
          deadline?: string | null
          denial_date?: string | null
          denial_reason?: string | null
          email?: string | null
          icd10_codes?: string[] | null
          id?: string
          lcd_refs?: string[] | null
          ncd_refs?: string[] | null
          paid?: boolean | null
          phone?: string | null
          pubmed_refs?: string[] | null
          rarc_codes?: string[] | null
          service_description?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          appeal_letter?: string
          carc_codes?: string[] | null
          conversation_id?: string
          cpt_codes?: string[] | null
          created_at?: string
          deadline?: string | null
          denial_date?: string | null
          denial_reason?: string | null
          email?: string | null
          icd10_codes?: string[] | null
          id?: string
          lcd_refs?: string[] | null
          ncd_refs?: string[] | null
          paid?: boolean | null
          phone?: string | null
          pubmed_refs?: string[] | null
          rarc_codes?: string[] | null
          service_description?: string | null
          status?: string | null
          stripe_payment_id?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appeals_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appeals_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      carc_codes: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string
          effective_date: string
          group_code: string | null
          is_active: boolean | null
          plain_english: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description: string
          effective_date: string
          group_code?: string | null
          is_active?: boolean | null
          plain_english?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string
          effective_date?: string
          group_code?: string | null
          is_active?: boolean | null
          plain_english?: string | null
        }
        Relationships: []
      }
      conversation_patterns: {
        Row: {
          created_at: string | null
          id: string
          intent: string
          last_used_at: string | null
          question_sequence: Json
          success_rate: number | null
          trigger_phrase: string
          use_count: number | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intent: string
          last_used_at?: string | null
          question_sequence: Json
          success_rate?: number | null
          trigger_phrase: string
          use_count?: number | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intent?: string
          last_used_at?: string | null
          question_sequence?: Json
          success_rate?: number | null
          trigger_phrase?: string
          use_count?: number | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          completed_at: string | null
          created_at: string
          device_fingerprint: string | null
          id: string
          is_appeal: boolean | null
          phone: string | null
          started_at: string
          status: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          is_appeal?: boolean | null
          phone?: string | null
          started_at?: string
          status?: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          device_fingerprint?: string | null
          id?: string
          is_appeal?: boolean | null
          phone?: string | null
          started_at?: string
          status?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      coverage_paths: {
        Row: {
          contractor_id: string | null
          cpt_code: string
          created_at: string
          documentation_required: string[] | null
          icd10_code: string
          id: string
          last_used_at: string
          lcd_id: string | null
          ncd_id: string | null
          outcome: string
          use_count: number
        }
        Insert: {
          contractor_id?: string | null
          cpt_code: string
          created_at?: string
          documentation_required?: string[] | null
          icd10_code: string
          id?: string
          last_used_at?: string
          lcd_id?: string | null
          ncd_id?: string | null
          outcome: string
          use_count?: number
        }
        Update: {
          contractor_id?: string | null
          cpt_code?: string
          created_at?: string
          documentation_required?: string[] | null
          icd10_code?: string
          id?: string
          last_used_at?: string
          lcd_id?: string | null
          ncd_id?: string | null
          outcome?: string
          use_count?: number
        }
        Relationships: []
      }
      denial_patterns: {
        Row: {
          appeal_deadline_days: number
          appeal_strategy: string
          category: string
          common_cpts: string[] | null
          common_diagnoses: string[] | null
          created_at: string | null
          documentation_checklist: string[] | null
          effective_date: string
          estimated_success_rate: string | null
          id: string
          is_active: boolean | null
          reason: string
          reason_codes: string[] | null
        }
        Insert: {
          appeal_deadline_days?: number
          appeal_strategy: string
          category: string
          common_cpts?: string[] | null
          common_diagnoses?: string[] | null
          created_at?: string | null
          documentation_checklist?: string[] | null
          effective_date?: string
          estimated_success_rate?: string | null
          id?: string
          is_active?: boolean | null
          reason: string
          reason_codes?: string[] | null
        }
        Update: {
          appeal_deadline_days?: number
          appeal_strategy?: string
          category?: string
          common_cpts?: string[] | null
          common_diagnoses?: string[] | null
          created_at?: string | null
          documentation_checklist?: string[] | null
          effective_date?: string
          estimated_success_rate?: string | null
          id?: string
          is_active?: boolean | null
          reason?: string
          reason_codes?: string[] | null
        }
        Relationships: []
      }
      eob_denial_mappings: {
        Row: {
          carc_code: string
          created_at: string | null
          effective_date: string
          eob_code: string
          eob_description: string | null
          id: string
          rarc_code: string | null
        }
        Insert: {
          carc_code: string
          created_at?: string | null
          effective_date: string
          eob_code: string
          eob_description?: string | null
          id?: string
          rarc_code?: string | null
        }
        Update: {
          carc_code?: string
          created_at?: string | null
          effective_date?: string
          eob_code?: string
          eob_description?: string | null
          id?: string
          rarc_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eob_denial_mappings_carc_code_effective_date_fkey"
            columns: ["carc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "carc_codes"
            referencedColumns: ["code", "effective_date"]
          },
          {
            foreignKeyName: "eob_denial_mappings_carc_code_effective_date_fkey"
            columns: ["carc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "carc_codes_latest"
            referencedColumns: ["code", "effective_date"]
          },
          {
            foreignKeyName: "eob_denial_mappings_rarc_code_effective_date_fkey"
            columns: ["rarc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "rarc_codes"
            referencedColumns: ["code", "effective_date"]
          },
          {
            foreignKeyName: "eob_denial_mappings_rarc_code_effective_date_fkey"
            columns: ["rarc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "rarc_codes_latest"
            referencedColumns: ["code", "effective_date"]
          },
        ]
      }
      landing_content: {
        Row: {
          content: Json | null
          created_at: string | null
          display_order: number | null
          id: string
          is_published: boolean | null
          section_key: string
          subtitle: string | null
          title: string | null
          updated_at: string | null
        }
        Insert: {
          content?: Json | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_published?: boolean | null
          section_key: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Update: {
          content?: Json | null
          created_at?: string | null
          display_order?: number | null
          id?: string
          is_published?: boolean | null
          section_key?: string
          subtitle?: string | null
          title?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      learning_queue: {
        Row: {
          attempts: number | null
          completed_at: string | null
          created_at: string | null
          id: string
          job_data: Json
          job_type: string
          last_error: string | null
          max_attempts: number | null
          priority: number | null
          started_at: string | null
          status: string | null
        }
        Insert: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_data: Json
          job_type: string
          last_error?: string | null
          max_attempts?: number | null
          priority?: number | null
          started_at?: string | null
          status?: string | null
        }
        Update: {
          attempts?: number | null
          completed_at?: string | null
          created_at?: string | null
          id?: string
          job_data?: Json
          job_type?: string
          last_error?: string | null
          max_attempts?: number | null
          priority?: number | null
          started_at?: string | null
          status?: string | null
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          cpt_codes: string[] | null
          created_at: string
          icd10_codes: string[] | null
          id: string
          npi: string | null
          policy_refs: string[] | null
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          cpt_codes?: string[] | null
          created_at?: string
          icd10_codes?: string[] | null
          id?: string
          npi?: string | null
          policy_refs?: string[] | null
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          cpt_codes?: string[] | null
          created_at?: string
          icd10_codes?: string[] | null
          id?: string
          npi?: string | null
          policy_refs?: string[] | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      policy_cache: {
        Row: {
          change_summary: string | null
          content_hash: string | null
          contractor_id: string | null
          coverage_requirements: Json | null
          covered_codes: string[] | null
          created_at: string | null
          effective_date: string | null
          id: string
          last_changed_at: string | null
          last_checked_at: string | null
          policy_id: string
          policy_type: string
          title: string | null
          version: number | null
        }
        Insert: {
          change_summary?: string | null
          content_hash?: string | null
          contractor_id?: string | null
          coverage_requirements?: Json | null
          covered_codes?: string[] | null
          created_at?: string | null
          effective_date?: string | null
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          policy_id: string
          policy_type: string
          title?: string | null
          version?: number | null
        }
        Update: {
          change_summary?: string | null
          content_hash?: string | null
          contractor_id?: string | null
          coverage_requirements?: Json | null
          covered_codes?: string[] | null
          created_at?: string | null
          effective_date?: string | null
          id?: string
          last_changed_at?: string | null
          last_checked_at?: string | null
          policy_id?: string
          policy_type?: string
          title?: string | null
          version?: number | null
        }
        Relationships: []
      }
      pricing_plans: {
        Row: {
          billing_period: string | null
          created_at: string | null
          display_order: number | null
          features: Json | null
          id: string
          is_active: boolean | null
          is_popular: boolean | null
          name: string
          price_cents: number
          stripe_price_id: string | null
        }
        Insert: {
          billing_period?: string | null
          created_at?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name: string
          price_cents: number
          stripe_price_id?: string | null
        }
        Update: {
          billing_period?: string | null
          created_at?: string | null
          display_order?: number | null
          features?: Json | null
          id?: string
          is_active?: boolean | null
          is_popular?: boolean | null
          name?: string
          price_cents?: number
          stripe_price_id?: string | null
        }
        Relationships: []
      }
      procedure_mappings: {
        Row: {
          confidence: number
          cpt_code: string
          cpt_description: string | null
          created_at: string
          id: string
          last_used_at: string
          phrase: string
          use_count: number
        }
        Insert: {
          confidence?: number
          cpt_code: string
          cpt_description?: string | null
          created_at?: string
          id?: string
          last_used_at?: string
          phrase: string
          use_count?: number
        }
        Update: {
          confidence?: number
          cpt_code?: string
          cpt_description?: string | null
          created_at?: string
          id?: string
          last_used_at?: string
          phrase?: string
          use_count?: number
        }
        Relationships: []
      }
      rarc_codes: {
        Row: {
          category: string | null
          code: string
          created_at: string | null
          description: string
          effective_date: string
          is_active: boolean | null
          plain_english: string | null
        }
        Insert: {
          category?: string | null
          code: string
          created_at?: string | null
          description: string
          effective_date: string
          is_active?: boolean | null
          plain_english?: string | null
        }
        Update: {
          category?: string | null
          code?: string
          created_at?: string | null
          description?: string
          effective_date?: string
          is_active?: boolean | null
          plain_english?: string | null
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          category: string | null
          created_at: string | null
          id: string
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          id?: string
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          id?: string
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          id: string
          plan: string
          started_at: string
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          id?: string
          plan?: string
          started_at?: string
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      symptom_mappings: {
        Row: {
          confidence: number
          created_at: string
          icd10_code: string
          icd10_description: string | null
          id: string
          last_used_at: string
          phrase: string
          use_count: number
        }
        Insert: {
          confidence?: number
          created_at?: string
          icd10_code: string
          icd10_description?: string | null
          id?: string
          last_used_at?: string
          phrase: string
          use_count?: number
        }
        Update: {
          confidence?: number
          created_at?: string
          icd10_code?: string
          icd10_description?: string | null
          id?: string
          last_used_at?: string
          phrase?: string
          use_count?: number
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          author_name: string
          author_title: string | null
          content: string
          created_at: string | null
          id: string
          is_featured: boolean | null
          is_published: boolean | null
          rating: number | null
          source: string | null
        }
        Insert: {
          author_name: string
          author_title?: string | null
          content: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          rating?: number | null
          source?: string | null
        }
        Update: {
          author_name?: string
          author_title?: string | null
          content?: string
          created_at?: string | null
          id?: string
          is_featured?: boolean | null
          is_published?: boolean | null
          rating?: number | null
          source?: string | null
        }
        Relationships: []
      }
      usage: {
        Row: {
          appeal_count: number
          created_at: string
          device_fingerprint: string | null
          email: string | null
          id: string
          last_appeal_at: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          appeal_count?: number
          created_at?: string
          device_fingerprint?: string | null
          email?: string | null
          id?: string
          last_appeal_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          appeal_count?: number
          created_at?: string
          device_fingerprint?: string | null
          email?: string | null
          id?: string
          last_appeal_at?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_events: {
        Row: {
          appeal_id: string | null
          conversation_id: string | null
          created_at: string | null
          device_fingerprint: string | null
          event_data: Json | null
          event_type: string
          id: string
          phone: string | null
        }
        Insert: {
          appeal_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          phone?: string | null
        }
        Update: {
          appeal_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          device_fingerprint?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_events_appeal_id_fkey"
            columns: ["appeal_id"]
            isOneToOne: false
            referencedRelation: "appeals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_events_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_feedback: {
        Row: {
          correction: string | null
          created_at: string
          feedback_type: string | null
          id: string
          message_id: string
          rating: string
          user_id: string | null
        }
        Insert: {
          correction?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          message_id: string
          rating: string
          user_id?: string | null
        }
        Update: {
          correction?: string | null
          created_at?: string
          feedback_type?: string | null
          id?: string
          message_id?: string
          rating?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_feedback_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_feedback_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_verification: {
        Row: {
          created_at: string
          email_verified: boolean
          email_verified_at: string | null
          id: string
          phone_verified: boolean
          phone_verified_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          email_verified?: boolean
          email_verified_at?: string | null
          id?: string
          phone_verified?: boolean
          phone_verified_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          email_verified?: boolean
          email_verified_at?: string | null
          id?: string
          phone_verified?: boolean
          phone_verified_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_verification_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      users: {
        Row: {
          autoplay_media: boolean | null
          created_at: string
          email: string
          high_contrast: boolean | null
          id: string
          notifications_enabled: boolean | null
          phone: string | null
          plan: string
          reduce_motion: boolean | null
          text_size: number | null
          theme: string | null
          updated_at: string
          voiceover_optimization: boolean | null
        }
        Insert: {
          autoplay_media?: boolean | null
          created_at?: string
          email: string
          high_contrast?: boolean | null
          id: string
          notifications_enabled?: boolean | null
          phone?: string | null
          plan?: string
          reduce_motion?: boolean | null
          text_size?: number | null
          theme?: string | null
          updated_at?: string
          voiceover_optimization?: boolean | null
        }
        Update: {
          autoplay_media?: boolean | null
          created_at?: string
          email?: string
          high_contrast?: boolean | null
          id?: string
          notifications_enabled?: boolean | null
          phone?: string | null
          plan?: string
          reduce_motion?: boolean | null
          text_size?: number | null
          theme?: string | null
          updated_at?: string
          voiceover_optimization?: boolean | null
        }
        Relationships: []
      }
    }
    Views: {
      appeal_levels_latest: {
        Row: {
          created_at: string | null
          decision_timeframe: string | null
          description: string | null
          effective_date: string | null
          id: string | null
          level: number | null
          name: string | null
          success_rate: string | null
          time_limit: string | null
        }
        Insert: {
          created_at?: string | null
          decision_timeframe?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string | null
          level?: number | null
          name?: string | null
          success_rate?: string | null
          time_limit?: string | null
        }
        Update: {
          created_at?: string | null
          decision_timeframe?: string | null
          description?: string | null
          effective_date?: string | null
          id?: string | null
          level?: number | null
          name?: string | null
          success_rate?: string | null
          time_limit?: string | null
        }
        Relationships: []
      }
      carc_codes_latest: {
        Row: {
          category: string | null
          code: string | null
          created_at: string | null
          description: string | null
          effective_date: string | null
          group_code: string | null
          is_active: boolean | null
          plain_english: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          effective_date?: string | null
          group_code?: string | null
          is_active?: boolean | null
          plain_english?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          effective_date?: string | null
          group_code?: string | null
          is_active?: boolean | null
          plain_english?: string | null
        }
        Relationships: []
      }
      denial_patterns_latest: {
        Row: {
          appeal_deadline_days: number | null
          appeal_strategy: string | null
          category: string | null
          common_cpts: string[] | null
          common_diagnoses: string[] | null
          created_at: string | null
          documentation_checklist: string[] | null
          effective_date: string | null
          estimated_success_rate: string | null
          id: string | null
          is_active: boolean | null
          reason: string | null
          reason_codes: string[] | null
        }
        Insert: {
          appeal_deadline_days?: number | null
          appeal_strategy?: string | null
          category?: string | null
          common_cpts?: string[] | null
          common_diagnoses?: string[] | null
          created_at?: string | null
          documentation_checklist?: string[] | null
          effective_date?: string | null
          estimated_success_rate?: string | null
          id?: string | null
          is_active?: boolean | null
          reason?: string | null
          reason_codes?: string[] | null
        }
        Update: {
          appeal_deadline_days?: number | null
          appeal_strategy?: string | null
          category?: string | null
          common_cpts?: string[] | null
          common_diagnoses?: string[] | null
          created_at?: string | null
          documentation_checklist?: string[] | null
          effective_date?: string | null
          estimated_success_rate?: string | null
          id?: string | null
          is_active?: boolean | null
          reason?: string | null
          reason_codes?: string[] | null
        }
        Relationships: []
      }
      eob_denial_mappings_latest: {
        Row: {
          carc_code: string | null
          created_at: string | null
          effective_date: string | null
          eob_code: string | null
          eob_description: string | null
          id: string | null
          rarc_code: string | null
        }
        Insert: {
          carc_code?: string | null
          created_at?: string | null
          effective_date?: string | null
          eob_code?: string | null
          eob_description?: string | null
          id?: string | null
          rarc_code?: string | null
        }
        Update: {
          carc_code?: string | null
          created_at?: string | null
          effective_date?: string | null
          eob_code?: string | null
          eob_description?: string | null
          id?: string | null
          rarc_code?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "eob_denial_mappings_carc_code_effective_date_fkey"
            columns: ["carc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "carc_codes"
            referencedColumns: ["code", "effective_date"]
          },
          {
            foreignKeyName: "eob_denial_mappings_carc_code_effective_date_fkey"
            columns: ["carc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "carc_codes_latest"
            referencedColumns: ["code", "effective_date"]
          },
          {
            foreignKeyName: "eob_denial_mappings_rarc_code_effective_date_fkey"
            columns: ["rarc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "rarc_codes"
            referencedColumns: ["code", "effective_date"]
          },
          {
            foreignKeyName: "eob_denial_mappings_rarc_code_effective_date_fkey"
            columns: ["rarc_code", "effective_date"]
            isOneToOne: false
            referencedRelation: "rarc_codes_latest"
            referencedColumns: ["code", "effective_date"]
          },
        ]
      }
      rarc_codes_latest: {
        Row: {
          category: string | null
          code: string | null
          created_at: string | null
          description: string | null
          effective_date: string | null
          is_active: boolean | null
          plain_english: string | null
        }
        Insert: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          effective_date?: string | null
          is_active?: boolean | null
          plain_english?: string | null
        }
        Update: {
          category?: string | null
          code?: string | null
          created_at?: string | null
          description?: string | null
          effective_date?: string | null
          is_active?: boolean | null
          plain_english?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      check_appeal_access: { Args: { p_email: string }; Returns: string }
      claim_learning_job: {
        Args: never
        Returns: {
          job_data: Json
          job_id: string
          job_type: string
        }[]
      }
      complete_learning_job: {
        Args: { p_error?: string; p_job_id: string; p_success: boolean }
        Returns: undefined
      }
      custom_access_token_hook: { Args: { event: Json }; Returns: Json }
      delete_user_cascade: {
        Args: { target_user_id: string }
        Returns: undefined
      }
      get_appeal_context: {
        Args: { p_cpt_codes: string[]; p_icd10_codes: string[] }
        Returns: Json
      }
      get_appeal_count: { Args: { p_email: string }; Returns: number }
      get_current_practice_id: { Args: never; Returns: string }
      get_denial_pattern_for_carc: {
        Args: { carc_code_input: string }
        Returns: {
          appeal_deadline_days: number
          appeal_strategy: string
          category: string
          documentation_checklist: string[]
          estimated_success_rate: string
          reason: string
        }[]
      }
      get_denial_patterns_for_cpt: {
        Args: { cpt_code_input: string }
        Returns: {
          appeal_deadline_days: number
          appeal_strategy: string
          category: string
          common_cpts: string[]
          common_diagnoses: string[]
          created_at: string
          documentation_checklist: string[]
          effective_date: string
          estimated_success_rate: string
          id: string
          is_active: boolean
          reason: string
          reason_codes: string[]
        }[]
      }
      get_learning_context: {
        Args: {
          p_cpt_codes?: string[]
          p_icd10_codes?: string[]
          p_limit?: number
          p_symptom_phrases?: string[]
        }
        Returns: Json
      }
      increment_appeal_count: {
        Args: {
          p_device_fingerprint?: string
          p_email: string
          p_user_id?: string
        }
        Returns: number
      }
      is_admin: { Args: never; Returns: boolean }
      process_feedback: {
        Args: {
          p_correction?: string
          p_feedback_type?: string
          p_message_id: string
          p_rating?: string
          p_user_id?: string
        }
        Returns: string
      }
      prune_weak_mappings: {
        Args: {
          p_days_inactive?: number
          p_min_confidence?: number
          p_min_use_count?: number
        }
        Returns: {
          pruned_coverage_paths: number
          pruned_procedures: number
          pruned_symptoms: number
        }[]
      }
      queue_learning_job: {
        Args: { p_job_data: Json; p_job_type: string; p_priority?: number }
        Returns: string
      }
      record_appeal_outcome: {
        Args: {
          p_appeal_id: string
          p_days_to_resolution?: number
          p_denial_reason?: string
          p_documentation_gaps?: string[]
          p_email: string
          p_outcome: string
          p_successful_arguments?: string[]
        }
        Returns: string
      }
      search_denial_codes: {
        Args: { search_text: string }
        Returns: {
          category: string
          code: string
          code_type: string
          description: string
          plain_english: string
        }[]
      }
      track_user_event: {
        Args: {
          p_appeal_id?: string
          p_conversation_id?: string
          p_device_fingerprint?: string
          p_event_data?: Json
          p_event_type?: string
          p_phone?: string
        }
        Returns: string
      }
      update_conversation_pattern: {
        Args: {
          p_intent: string
          p_question_sequence: Json
          p_trigger_phrase: string
          p_was_successful: boolean
        }
        Returns: undefined
      }
      update_coverage_path: {
        Args: {
          p_contractor_id?: string
          p_cpt_code: string
          p_documentation_required?: string[]
          p_icd10_code: string
          p_lcd_id?: string
          p_ncd_id?: string
          p_outcome: string
        }
        Returns: undefined
      }
      update_procedure_mapping: {
        Args: {
          p_confidence_boost?: number
          p_cpt_code: string
          p_cpt_description?: string
          p_phrase: string
        }
        Returns: undefined
      }
      update_symptom_mapping: {
        Args: {
          p_confidence_boost?: number
          p_icd10_code: string
          p_icd10_description?: string
          p_phrase: string
        }
        Returns: undefined
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
